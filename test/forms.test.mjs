import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleSubmit, retryUnsent } from "../functions/lib/submit.js";
import worker from "../worker/index.js";

const IP = "203.0.113.9";

function statement(state, sql, args) {
  return {
    async run() {
      state.sql.push(sql);
      if (sql.includes("INSERT INTO waitlist")) {
        const [email, createdAt, sourcePage, userAgentHash] = args;
        const duplicate = state.waitlist.has(email);
        if (!duplicate) {
          state.waitlist.set(email, { email, createdAt, sourcePage, userAgentHash, args, notifiedAt: null });
        }
        return { meta: { changes: duplicate ? 0 : 1 } };
      }
      if (sql.includes("INSERT INTO isp_inquiries")) {
        const email = args[0];
        const duplicate = state.isp.some((row) => row[0] === email);
        if (!duplicate) state.isp.push(args);
        return { meta: { changes: duplicate ? 0 : 1 } };
      }
      if (sql.startsWith("UPDATE waitlist")) {
        const [notifiedAt, email] = args;
        const row = state.waitlist.get(email);
        const changed = Boolean(row && row.notifiedAt == null);
        if (changed) row.notifiedAt = notifiedAt;
        return { meta: { changes: changed ? 1 : 0 } };
      }
      if (sql.startsWith("UPDATE isp_inquiries")) {
        const [notifiedAt, email] = args;
        const exists = state.isp.some((row) => row[0] === email);
        const changed = exists && !state.ispNotified.has(email);
        if (changed) state.ispNotified.set(email, notifiedAt);
        return { meta: { changes: changed ? 1 : 0 } };
      }
      throw new Error("unexpected sql");
    },
    async first() {
      state.sql.push(sql);
      if (sql.includes("FROM waitlist WHERE email")) {
        const row = state.waitlist.get(args[0]);
        if (!row) return null;
        return {
          email: row.email,
          created_at: row.createdAt,
          source_page: row.sourcePage,
          notified_at: row.notifiedAt,
        };
      }
      if (sql.includes("FROM isp_inquiries WHERE email")) {
        const found = state.isp.find((row) => row[0] === args[0]);
        if (!found) return null;
        return {
          email: found[0],
          name: found[1],
          company: found[2],
          subscribers: found[3],
          message: found[4],
          created_at: found[5],
          source_page: found[6],
          notified_at: state.ispNotified.get(found[0]) || null,
        };
      }
      throw new Error("unexpected sql");
    },
    async all() {
      state.sql.push(sql);
      if (sql.includes("FROM waitlist WHERE notified_at IS NULL")) {
        const results = [...state.waitlist.values()]
          .filter((row) => row.notifiedAt == null)
          .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
          .slice(0, 10)
          .map((row) => ({
            email: row.email,
            created_at: row.createdAt,
            source_page: row.sourcePage,
          }));
        return { results };
      }
      if (sql.includes("FROM isp_inquiries WHERE notified_at IS NULL")) {
        const results = state.isp
          .filter((row) => !state.ispNotified.has(row[0]))
          .map((row) => ({
            email: row[0],
            name: row[1],
            company: row[2],
            subscribers: row[3],
            message: row[4],
            created_at: row[5],
            source_page: row[6],
          }))
          .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
          .slice(0, 10);
        return { results };
      }
      throw new Error("unexpected sql");
    },
  };
}

function fakeEnv(state) {
  return {
    TURNSTILE_SECRET: "test-secret",
    TURNSTILE_HOSTNAMES: "www.honestping.com,honestping.com",
    DB: {
      prepare(sql) {
        const unbound = statement(state, sql, []);
        return {
          bind(...args) {
            return statement(state, sql, args);
          },
          run: () => unbound.run(),
          first: () => unbound.first(),
          all: () => unbound.all(),
        };
      },
    },
    EMAIL: {
      async send(message) {
        state.emails.push(message);
        return { messageId: "local-1" };
      },
    },
  };
}

function state() {
  return { waitlist: new Map(), isp: [], ispNotified: new Map(), emails: [], sql: [] };
}

function post(path, fields, { host = "www.honestping.com", headers = {} } = {}) {
  return new Request(`https://${host}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "TestAgent/1.0",
      "cf-connecting-ip": IP,
      ...headers,
    },
    body: JSON.stringify({ "cf-turnstile-response": "token-ok", ...fields }),
  });
}

function mockVerify(result, capture) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capture.calls.push({ url, init });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return () => {
    globalThis.fetch = original;
  };
}

const pass = { success: true, action: "waitlist", hostname: "www.honestping.com" };

test("waitlist saves a lowercased email and notifies hello@honestping.com", async () => {
  const saved = state();
  const capture = { calls: [] };
  const restore = mockVerify(pass, capture);
  try {
    const response = await handleSubmit(post("/api/waitlist", {
      email: " Person@Example.com ",
      source_page: "/",
    }), fakeEnv(saved));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.match(body.message, /You're on the list/);
    assert.equal(saved.waitlist.size, 1);
    const row = saved.waitlist.get("person@example.com");
    assert.equal(row.sourcePage, "/");
    assert.equal(row.userAgentHash.length, 64);
    assert.notEqual(row.userAgentHash, "TestAgent/1.0");
    assert.equal(row.args.includes(IP), false);
    assert.equal(saved.emails.length, 1);
    assert.equal(saved.emails[0].subject, "HonestPing waitlist");
    assert.equal(saved.emails[0].to, "hello@honestping.com");
    assert.equal(saved.emails[0].from.email, "waitlist@honestping.com");
    assert.equal(saved.emails[0].replyTo, "person@example.com");
    assert.equal(saved.emails[0].text.includes(IP), false);
    assert.match(saved.emails[0].text, /person@example.com/);
    const sent = new URLSearchParams(capture.calls[0].init.body);
    assert.equal(sent.get("secret"), "test-secret");
    assert.equal(sent.get("remoteip"), IP);
    assert.equal(saved.sql[0].includes("person@example.com"), false);
  } finally {
    restore();
  }
});

test("a duplicate waitlist address gets the same thank-you and one row", async () => {
  const saved = state();
  const restore = mockVerify(pass, { calls: [] });
  try {
    const env = fakeEnv(saved);
    const first = await handleSubmit(post("/api/waitlist", { email: "a@example.com" }), env);
    const second = await handleSubmit(post("/api/waitlist", { email: "A@Example.com" }), env);
    assert.equal((await first.json()).message, (await second.json()).message);
    assert.equal(saved.waitlist.size, 1);
    assert.equal(saved.emails.length, 1);
    assert.equal(second.status, 200);
  } finally {
    restore();
  }
});

test("rejects a bad email, a bad token, the wrong action, and the wrong hostname", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  const cases = [
    [pass, "not-an-email", 400],
    [{ success: false, action: "waitlist", hostname: "www.honestping.com" }, "a@example.com", 403],
    [{ success: true, action: "login", hostname: "www.honestping.com" }, "a@example.com", 403],
    [{ success: true, action: "waitlist", hostname: "evil.example" }, "a@example.com", 403],
  ];
  for (const [result, email, status] of cases) {
    const restore = mockVerify(result, { calls: [] });
    try {
      const response = await handleSubmit(post("/api/waitlist", { email }), env);
      assert.equal(response.status, status);
    } finally {
      restore();
    }
  }
  assert.equal(saved.waitlist.size, 0);
  assert.equal(saved.emails.length, 0);
});

test("production ignores a localhost hostname even if the allowlist includes it", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  env.TURNSTILE_HOSTNAMES = "www.honestping.com,localhost,127.0.0.1";
  const restore = mockVerify(
    { success: true, action: "waitlist", hostname: "localhost" },
    { calls: [] },
  );
  try {
    const response = await handleSubmit(post("/api/waitlist", { email: "a@example.com" }), env);
    assert.equal(response.status, 403);
    assert.equal(saved.waitlist.size, 0);
  } finally {
    restore();
  }
});

test("preview accepts the workers.dev host", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  env.TURNSTILE_HOSTNAMES = "honestping-web-preview.honestping.workers.dev";
  const restore = mockVerify(
    { success: true, action: "waitlist", hostname: "honestping-web-preview.honestping.workers.dev" },
    { calls: [] },
  );
  try {
    const response = await handleSubmit(
      post("/api/waitlist", { email: "a@example.com" }, {
        host: "honestping-web-preview.honestping.workers.dev",
      }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(saved.emails.length, 1);
  } finally {
    restore();
  }
});

test("preview accepts a Pages hostname suffix", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  env.TURNSTILE_HOSTNAMES = ".honestping.pages.dev";
  const restore = mockVerify(
    { success: true, action: "waitlist", hostname: "cursor-waitlist.honestping.pages.dev" },
    { calls: [] },
  );
  try {
    const response = await handleSubmit(
      post("/api/waitlist", { email: "a@example.com", source_page: "/index.html" }, {
        host: "cursor-waitlist.honestping.pages.dev",
      }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(saved.waitlist.get("a@example.com").sourcePage, "/index.html");
  } finally {
    restore();
  }
});

test("ISP notes go in their own table with the partnership subject", async () => {
  const saved = state();
  const restore = mockVerify(
    { success: true, action: "isp", hostname: "www.honestping.com" },
    { calls: [] },
  );
  try {
    const response = await handleSubmit(post("/api/isp", {
      name: "Ada",
      company: "Example ISP",
      email: "Ada@ISP.example",
      subscribers: "1200",
      message: "We want fewer repeat calls.",
      source_page: "/isp",
    }), fakeEnv(saved));
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /partnering/);
    assert.equal(saved.waitlist.size, 0);
    assert.equal(saved.isp.length, 1);
    assert.deepEqual(saved.isp[0].slice(0, 5), [
      "ada@isp.example",
      "Ada",
      "Example ISP",
      "1200",
      "We want fewer repeat calls.",
    ]);
    assert.equal(saved.isp[0].includes(IP), false);
    assert.equal(saved.emails[0].subject, "ISP partnership");
    assert.equal(saved.emails[0].text.includes(IP), false);
    const again = await handleSubmit(post("/api/isp", {
      name: "Ada",
      company: "Example ISP",
      email: "ada@isp.example",
      subscribers: "1200",
      message: "A second note from the same address.",
      source_page: "/isp",
    }), fakeEnv(saved));
    assert.equal(again.status, 200);
    assert.match((await again.json()).message, /partnering/);
    assert.equal(saved.isp.length, 1);
    assert.equal(saved.emails.length, 1);
  } finally {
    restore();
  }
});

test("a saved sign-up still thanks the visitor when email fails", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  const errors = [];
  env.EMAIL.send = async () => {
    throw new Error("mailbox unavailable");
  };
  const restore = mockVerify(pass, { calls: [] });
  const originalError = console.error;
  console.error = (line) => errors.push(String(line));
  try {
    const response = await handleSubmit(post("/api/waitlist", { email: "a@example.com" }), env);
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /You're on the list/);
    assert.equal(saved.waitlist.size, 1);
    assert.equal(saved.waitlist.get("a@example.com").notifiedAt, null);
    assert.equal(saved.emails.length, 0);
    assert.match(errors.join("\n"), /email_send_failed/);
    assert.equal(errors.join("\n").includes("a@example.com"), false);
  } finally {
    console.error = originalError;
    restore();
  }
});

test("a repeat submit retries an unsent waitlist notice once", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  env.EMAIL.send = async () => {
    throw new Error("mailbox unavailable");
  };
  const restore = mockVerify(pass, { calls: [] });
  const originalError = console.error;
  console.error = () => {};
  try {
    const first = await handleSubmit(post("/api/waitlist", {
      email: "a@example.com",
      source_page: "/",
    }), env);
    assert.equal(first.status, 200);
    assert.equal(saved.waitlist.get("a@example.com").notifiedAt, null);
    env.EMAIL.send = async (message) => {
      saved.emails.push(message);
    };
    const second = await handleSubmit(post("/api/waitlist", { email: "a@example.com" }), env);
    assert.equal(second.status, 200);
    assert.match((await second.json()).message, /You're on the list/);
    assert.equal(saved.emails.length, 1);
    assert.match(saved.emails[0].text, /a@example.com/);
    assert.notEqual(saved.waitlist.get("a@example.com").notifiedAt, null);
    const third = await handleSubmit(post("/api/waitlist", { email: "a@example.com" }), env);
    assert.equal(third.status, 200);
    assert.equal(saved.emails.length, 1);
  } finally {
    console.error = originalError;
    restore();
  }
});

test("a repeat ISP submit retries the saved note, not the new one", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  let failSend = true;
  env.EMAIL.send = async (message) => {
    if (failSend) throw new Error("mailbox unavailable");
    saved.emails.push(message);
  };
  const restore = mockVerify(
    { success: true, action: "isp", hostname: "www.honestping.com" },
    { calls: [] },
  );
  const originalError = console.error;
  console.error = () => {};
  const fields = {
    name: "Ada",
    company: "Example ISP",
    email: "ada@isp.example",
    subscribers: "1200",
    source_page: "/isp",
  };
  try {
    const first = await handleSubmit(post("/api/isp", {
      ...fields,
      message: "The saved note.",
    }), env);
    assert.equal(first.status, 200);
    failSend = false;
    const second = await handleSubmit(post("/api/isp", {
      ...fields,
      message: "A later note that is not stored.",
    }), env);
    assert.equal(second.status, 200);
    assert.match((await second.json()).message, /partnering/);
    assert.equal(saved.isp.length, 1);
    assert.equal(saved.isp[0][4], "The saved note.");
    assert.equal(saved.emails.length, 1);
    assert.match(saved.emails[0].text, /The saved note/);
    assert.equal(saved.emails[0].text.includes("A later note"), false);
    const third = await handleSubmit(post("/api/isp", {
      ...fields,
      message: "The saved note.",
    }), env);
    assert.equal(third.status, 200);
    assert.equal(saved.emails.length, 1);
  } finally {
    console.error = originalError;
    restore();
  }
});

test("the cron sends a small batch of unsent notices", async () => {
  const saved = state();
  for (let index = 0; index < 11; index += 1) {
    const email = `p${String(index).padStart(2, "0")}@example.com`;
    saved.waitlist.set(email, {
      email,
      createdAt: `2026-10-08T00:${String(index).padStart(2, "0")}:00.000Z`,
      sourcePage: "/",
      userAgentHash: "abc",
      args: [],
      notifiedAt: null,
    });
  }
  saved.waitlist.set("done@example.com", {
    email: "done@example.com",
    createdAt: "2026-10-07T00:00:00.000Z",
    sourcePage: "/",
    userAgentHash: "abc",
    args: [],
    notifiedAt: "2026-10-07T00:01:00.000Z",
  });
  saved.isp.push([
    "isp@example.com",
    "Ada",
    "Example ISP",
    null,
    "Saved note",
    "2026-10-08T00:00:00.000Z",
    "/isp",
    null,
  ]);
  const env = fakeEnv(saved);
  const ctx = { waitUntil() {} };
  await worker.scheduled({ cron: "*/15 * * * *" }, env, ctx);
  const waitlistMail = () => saved.emails.filter((message) => message.subject === "HonestPing waitlist");
  const ispMail = () => saved.emails.filter((message) => message.subject === "ISP partnership");
  assert.equal(waitlistMail().length, 10);
  assert.equal(ispMail().length, 1);
  assert.equal(saved.emails.some((message) => message.replyTo === "done@example.com"), false);
  assert.match(ispMail()[0].text, /Saved note/);
  assert.deepEqual(await retryUnsent({}), { waitlist: 0, isp: 0 });
  await worker.scheduled({ cron: "*/15 * * * *" }, env, ctx);
  assert.equal(waitlistMail().length, 11);
  assert.equal(ispMail().length, 1);
  assert.equal([...saved.waitlist.values()].every((row) => row.notifiedAt), true);
});

test("missing Turnstile config fails closed", async () => {
  const saved = state();
  const env = fakeEnv(saved);
  env.TURNSTILE_SECRET = "";
  const response = await handleSubmit(post("/api/waitlist", { email: "a@example.com" }), env);
  assert.equal(response.status, 503);
  assert.equal(saved.waitlist.size, 0);
});

test("the worker answers the API and still proxies other paths", async () => {
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return new Response("body", { status: 200 });
  };
  try {
    const missing = await worker.fetch(new Request("https://www.honestping.com/api/waitlist"));
    assert.equal(missing.status, 405);
    const file = await worker.fetch(new Request("https://www.honestping.com/styles.css"));
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(await file.text(), "body");
    assert.match(seen[0], /^https:\/\/raw\.githubusercontent\.com\/ansonmitchell-lab\/honestping-website\/main\/styles\.css\?v=/);
    seen.length = 0;
    const preview = await worker.fetch(new Request("https://honestping-web-preview.honestping.workers.dev/index.html"), {
      ORIGIN_BASE: "https://raw.githubusercontent.com/ansonmitchell-lab/honestping-website/cursor/waitlist-d1-bbe4",
    });
    assert.equal(preview.status, 200);
    assert.match(seen[0], /^https:\/\/raw\.githubusercontent\.com\/ansonmitchell-lab\/honestping-website\/cursor\/waitlist-d1-bbe4\/index\.html\?v=/);
    const blocked = await worker.fetch(new Request("https://www.honestping.com/styles.css"), {
      ORIGIN_BASE: "https://example.com/not-github",
    });
    assert.equal(blocked.status, 500);
    assert.equal(seen.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("preview worker config is separate from production and Pages mail", () => {
  const workerConfig = readFileSync(new URL("../wrangler.worker.jsonc", import.meta.url), "utf8");
  const pagesConfig = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const preview = workerConfig.slice(workerConfig.indexOf('"env"'));
  assert.match(preview, /"routes": \[\]/);
  assert.match(preview, /"database_id": "834af7c2-165f-4fb4-92b9-49b1aa0b3eb6"/);
  assert.equal(preview.includes("c732d15a-f4c9-4f7d-8588-41f7774d41d1"), false);
  assert.match(preview, /honestping-web-preview\.honestping\.workers\.dev/);
  assert.match(preview, /ORIGIN_BASE/);
  assert.match(preview, /cursor\/waitlist-d1-bbe4/);
  assert.match(preview, /"crons": \["\*\/15 \* \* \* \*"\]/);
  assert.match(workerConfig.slice(0, workerConfig.indexOf('"env"')), /"crons": \["\*\/15 \* \* \* \*"\]/);
  assert.match(workerConfig, /"name": "honestping-web"/);
  assert.equal(workerConfig.includes("hello@honestping.com"), true);
  assert.equal(workerConfig.includes("ansonmitchell@gmail.com"), false);
  assert.equal(pagesConfig.includes("\"send_email\""), false);
  assert.match(pagesConfig, /Pages Functions cannot use a send_email binding/);
});

test("the page keeps a mailto fallback and does not open the mail app from script", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../waitlist.js", import.meta.url), "utf8");
  const footer = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /action="\/api\/waitlist"/);
  assert.match(html, /method="post"/);
  assert.match(html, /href="mailto:hello@honestping\.com\?subject=HonestPing%20waitlist"/);
  assert.match(footer, /Waitlist mail is only used to notify you when HonestPing is available/);
  assert.equal(script.includes("mailto:"), false);
  assert.equal(html.includes("\u2014") || html.includes("\u2013"), false);
  const isp = readFileSync(new URL("../isp-contact.js", import.meta.url), "utf8");
  assert.equal(isp.includes("mailto:"), false);
  assert.match(isp, /\/api\/isp/);
});
