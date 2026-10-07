import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleSubmit } from "../functions/lib/submit.js";
import worker from "../worker/index.js";

const IP = "203.0.113.9";

function fakeEnv(state) {
  return {
    TURNSTILE_SECRET: "test-secret",
    TURNSTILE_HOSTNAMES: "www.honestping.com,honestping.com",
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                state.sql.push(sql);
                if (sql.includes("INSERT INTO waitlist")) {
                  const [email, createdAt, sourcePage, userAgentHash] = args;
                  const duplicate = state.waitlist.has(email);
                  if (!duplicate) {
                    state.waitlist.set(email, { email, createdAt, sourcePage, userAgentHash, args });
                  }
                  return { meta: { changes: duplicate ? 0 : 1 } };
                }
                if (sql.includes("INSERT INTO isp_inquiries")) {
                  state.isp.push(args);
                  return { meta: { changes: 1 } };
                }
                throw new Error("unexpected sql");
              },
            };
          },
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
  return { waitlist: new Map(), isp: [], emails: [], sql: [] };
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

test("waitlist saves a lowercased email and notifies Anson", async () => {
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
    assert.equal(saved.emails[0].to, "ansonmitchell@gmail.com");
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
    assert.equal(saved.emails.length, 2);
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
  } finally {
    restore();
  }
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
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url).startsWith("https://raw.githubusercontent.com/"), true);
    return new Response("body", { status: 200 });
  };
  try {
    const missing = await worker.fetch(new Request("https://www.honestping.com/api/waitlist"));
    assert.equal(missing.status, 405);
    const file = await worker.fetch(new Request("https://www.honestping.com/styles.css"));
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(await file.text(), "body");
  } finally {
    globalThis.fetch = original;
  }
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
