import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { getPlatformProxy } from "wrangler";
import { teamIssuer, verifyAccessJwt } from "../owner/src/auth.js";
import { ispCsv, waitlistCsv } from "../owner/src/csv.js";
import {
  CANT_SEE,
  CONNECT_ANALYTICS,
  DOWNLOADS_NOT_CONNECTED,
  NOT_CONNECTED_YET,
  renderDashboard,
} from "../owner/src/html.js";
import { handleOwnerRequest } from "../owner/src/index.js";
import { formatCount, suppressSmallGroups } from "../owner/src/kanon.js";
import { attachDuplicates, buildGroups, titlesClose } from "../owner/src/feedback.js";
import { accessRows, ispRows, logAccess, saveStatus, waitlistSources } from "../owner/src/queries.js";

const TEAM = "https://honestping.cloudflareaccess.com";
const AUD = "aud-tag-test";
const NOW = Date.parse("2026-10-08T12:00:00.000Z");

let privateKey;
let publicJwk;

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlJson(value) {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signJwt(payload, options = {}) {
  const alg = options.alg || "RS256";
  const header = { alg, kid: options.kid || "test-key-1", typ: "JWT" };
  const data = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  if (alg === "none") return `${data}.`;
  const key = options.key || privateKey;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

function claims(overrides = {}) {
  return {
    iss: TEAM,
    aud: [AUD],
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000),
    email: "hello@honestping.com",
    ...overrides,
  };
}

function accessEnv(extra = {}) {
  return { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ...extra };
}

function certFetch(jwk = publicJwk) {
  const calls = [];
  const impl = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href === `${TEAM}/cdn-cgi/access/certs`) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unexpected fetch ${href}`);
  };
  impl.calls = calls;
  return impl;
}

function deps(fetchImpl) {
  return { fetch: fetchImpl, now: () => new Date(NOW) };
}

test.before(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  privateKey = pair.privateKey;
  publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  publicJwk.kid = "test-key-1";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  delete publicJwk.key_ops;
});

test("team domain must be an https issuer with no path or credentials", () => {
  assert.equal(teamIssuer("https://honestping.cloudflareaccess.com"), TEAM);
  assert.equal(teamIssuer("honestping.cloudflareaccess.com"), TEAM);
  assert.equal(teamIssuer("http://honestping.cloudflareaccess.com"), null);
  assert.equal(teamIssuer("https://user:pass@honestping.cloudflareaccess.com"), null);
  assert.equal(teamIssuer("https://honestping.cloudflareaccess.com/cdn-cgi/access/certs"), null);
  assert.equal(teamIssuer(""), null);
});

test("access JWT fails closed without config, a token, a matching audience, or a valid signature", async () => {
  const fetchImpl = certFetch();
  const token = await signJwt(claims());
  const missingConfig = await verifyAccessJwt(token, {}, { fetch: fetchImpl, nowMs: NOW });
  assert.equal(missingConfig.ok, false);
  assert.equal(missingConfig.reason, "missing_config");

  const missingAud = await verifyAccessJwt(token, { ACCESS_TEAM_DOMAIN: TEAM }, { fetch: fetchImpl, nowMs: NOW });
  assert.equal(missingAud.reason, "missing_config");

  const missingToken = await verifyAccessJwt(null, accessEnv(), { fetch: fetchImpl, nowMs: NOW });
  assert.equal(missingToken.reason, "missing_token");

  const noneAlg = await verifyAccessJwt(await signJwt(claims(), { alg: "none" }), accessEnv(), {
    fetch: fetchImpl,
    nowMs: NOW,
  });
  assert.equal(noneAlg.reason, "invalid_token");

  const wrongAud = await verifyAccessJwt(await signJwt(claims({ aud: ["other-aud"] })), accessEnv(), {
    fetch: fetchImpl,
    nowMs: NOW,
  });
  assert.equal(wrongAud.reason, "invalid_token");

  const wrongIss = await verifyAccessJwt(await signJwt(claims({ iss: "https://evil.example" })), accessEnv(), {
    fetch: fetchImpl,
    nowMs: NOW,
  });
  assert.equal(wrongIss.reason, "invalid_token");

  const expired = await verifyAccessJwt(
    await signJwt(claims({ exp: Math.floor(NOW / 1000) - 120 })),
    accessEnv(),
    { fetch: fetchImpl, nowMs: NOW },
  );
  assert.equal(expired.reason, "expired");
  assert.equal(fetchImpl.calls.length, 0);

  const badKey = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const wrongJwk = await crypto.subtle.exportKey("jwk", badKey.publicKey);
  wrongJwk.kid = "test-key-1";
  wrongJwk.alg = "RS256";
  wrongJwk.use = "sig";
  const badSignature = await verifyAccessJwt(token, accessEnv(), { fetch: certFetch(wrongJwk), nowMs: NOW });
  assert.equal(badSignature.ok, false);

  const jwksDown = await verifyAccessJwt(token, accessEnv(), {
    fetch: async () => new Response("no", { status: 500 }),
    nowMs: NOW,
  });
  assert.equal(jwksDown.reason, "jwks_unavailable");

  const accepted = await verifyAccessJwt(token, accessEnv(), { fetch: certFetch(), nowMs: NOW });
  assert.deepEqual(accepted, { ok: true, email: "hello@honestping.com" });
});

test("dashboard requests fail closed before any database read", async () => {
  let prepared = 0;
  const env = {
    ...accessEnv(),
    DB: {
      prepare() {
        prepared += 1;
        throw new Error("database should not be read");
      },
    },
  };
  const denied = await handleOwnerRequest(
    new Request("https://owner.honestping.com/export/waitlist.csv"),
    env,
    deps(certFetch()),
  );
  assert.equal(denied.status, 401);
  const body = await denied.text();
  assert.match(body, /Sign in required/);
  assert.equal(body.includes("ada@example.com"), false);
  assert.equal(prepared, 0);

  const posted = await handleOwnerRequest(new Request("https://owner.honestping.com/isp/status", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://owner.honestping.com" },
    body: "inquiry_id=1&status=partner",
  }), env, deps(certFetch()));
  assert.equal(posted.status, 401);
  assert.equal(prepared, 0);

  const queue = await handleOwnerRequest(
    new Request("https://owner.honestping.com/requests"),
    env,
    deps(certFetch()),
  );
  assert.equal(queue.status, 401);
  const detail = await handleOwnerRequest(
    new Request("https://owner.honestping.com/requests/4"),
    env,
    deps(certFetch()),
  );
  assert.equal(detail.status, 401);
  const shot = await handleOwnerRequest(
    new Request("https://owner.honestping.com/requests/4/screenshot"),
    env,
    deps(certFetch()),
  );
  assert.equal(shot.status, 401);
  const statusPost = await handleOwnerRequest(new Request("https://owner.honestping.com/requests/status", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://owner.honestping.com" },
    body: "feedback_id=4&status=done",
  }), env, deps(certFetch()));
  assert.equal(statusPost.status, 401);
  assert.equal(prepared, 0);
});

function scriptedDb({ first, all, run } = {}) {
  return {
    prepare(sql) {
      const compact = sql.replace(/\s+/g, " ").trim();
      let args = [];
      return {
        bind(...next) {
          args = next;
          return this;
        },
        async first() {
          return first ? first(compact, args) : null;
        },
        async all() {
          return { results: all ? all(compact, args) : [] };
        },
        async run() {
          if (run) run(compact, args);
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };
}

test("overview hides groups under 5 and keeps emails off that tab", async () => {
  const db = scriptedDb({
    first(sql) {
      if (/from waitlist/i.test(sql)) return { count: 4 };
      if (/from isp_inquiries/i.test(sql)) return { count: 6 };
      return null;
    },
    all(sql) {
      if (/\bemail\b/i.test(sql)) throw new Error(`overview selected email: ${sql}`);
      if (/substr/i.test(sql)) {
        return [
          { label: "2026-10-01", count: 6 },
          { label: "2026-10-02", count: 2 },
        ];
      }
      if (/strftime/i.test(sql)) return [{ label: "2026-40", count: 1 }];
      if (/source_page/i.test(sql)) return [{ label: "/secret-page", count: 4 }];
      if (/isp_pipeline/i.test(sql)) {
        return [
          { label: "new", count: 6 },
          { label: "pilot", count: 2 },
        ];
      }
      return [];
    },
  });
  const token = await signJwt(claims());
  const response = await handleOwnerRequest(new Request("https://owner.honestping.com/", {
    headers: { "cf-access-jwt-assertion": token },
  }), { ...accessEnv(), DB: db }, deps(certFetch()));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(
    CANT_SEE,
    "This dashboard can't see: IP addresses, who is behind an install, Wi-Fi names, devices on home networks, individual test results, precise location, browsing",
  );
  assert.equal(html.includes(CANT_SEE.replaceAll("'", "&#39;")), true);
  assert.equal(html.includes(CONNECT_ANALYTICS), true);
  assert.equal(html.includes(DOWNLOADS_NOT_CONNECTED), true);
  assert.equal(html.includes(NOT_CONNECTED_YET), true);
  assert.equal(html.includes("2026-10-01"), true);
  assert.equal(html.includes("2026-10-02"), false);
  assert.equal(html.includes("2026-40"), false);
  assert.equal(html.includes("/secret-page"), false);
  assert.equal(html.includes(">Pilot<"), false);
  assert.equal(html.includes(">New<"), true);
  assert.equal(html.includes("ada@example.com"), false);
  assert.equal(html.includes("/export/waitlist.csv"), false);
  assert.equal(html.includes("\u2013"), false);
  assert.equal(html.includes("\u2014"), false);
});

test("owner preview config cannot take the production hostname", () => {
  const config = readFileSync(new URL("../owner/wrangler.jsonc", import.meta.url), "utf8");
  const preview = config.slice(config.indexOf('"env"'));
  assert.match(config, /"name": "honestping-owner"/);
  assert.match(preview, /"routes": \[\]/);
  assert.match(preview, /"workers_dev": true/);
  assert.match(preview, /"database_id": "834af7c2-165f-4fb4-92b9-49b1aa0b3eb6"/);
  assert.equal(preview.includes("c732d15a-f4c9-4f7d-8588-41f7774d41d1"), false);
  assert.equal(preview.includes("owner.honestping.com"), false);
  assert.match(config, /"pattern": "owner\.honestping\.com"/);
});

test("waitlist tab shows submitted emails while the total under 5 stays hidden", async () => {
  const db = scriptedDb({
    first() {
      return { count: 3 };
    },
    all(sql) {
      if (/email/i.test(sql)) {
        return [{
          email: "ada@example.com",
          created_at: "2026-10-08T00:00:00.000Z",
          source_page: "/secret-page",
        }];
      }
      return [];
    },
  });
  const token = await signJwt(claims());
  const response = await handleOwnerRequest(new Request("https://owner.honestping.com/waitlist", {
    headers: { "cf-access-jwt-assertion": token },
  }), { ...accessEnv(), DB: db }, deps(certFetch()));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ada@example\.com/);
  assert.match(html, /\/secret-page/);
  assert.match(html, /href="\/export\/waitlist\.csv"/);
  assert.match(html, />Hidden</);
});

test("groups under 5 are hidden and a group of 5 is shown", () => {
  assert.equal(formatCount(0), "None yet");
  assert.equal(formatCount(4), "Hidden");
  assert.equal(formatCount(5), "5");
  assert.deepEqual(suppressSmallGroups([{ label: "solo", count: 4 }]), [
    { label: "Hidden", count: null, hidden: true },
  ]);
  assert.deepEqual(suppressSmallGroups([{ label: "enough", count: 5 }]), [
    { label: "enough", count: 5, hidden: false },
  ]);
  assert.deepEqual(suppressSmallGroups([
    { label: "a", count: 2 },
    { label: "b", count: 3 },
  ]), [{ label: "Hidden", count: 5, hidden: true }]);
  assert.deepEqual(suppressSmallGroups([
    { label: "a", count: 2 },
    { label: "b", count: 2 },
  ]), [{ label: "Hidden", count: null, hidden: true }]);
  assert.deepEqual(suppressSmallGroups([
    { label: "shown", count: 6 },
    { label: "tiny", count: 1 },
  ]), [
    { label: "shown", count: 6, hidden: false },
    { label: "Hidden", count: null, hidden: true },
  ]);
  assert.deepEqual(suppressSmallGroups([{ label: "empty", count: 0 }]), []);
});

test("download counts under 5 are hidden on the downloads tab", () => {
  const html = renderDashboard({
    tab: "downloads",
    email: "hello@honestping.com",
    downloads: {
      connected: true,
      groups: [
        { label: "v1 HonestPing-Setup.exe", count: 3 },
        { label: "v1 HonestPing.dmg", count: 8 },
      ],
    },
  });
  assert.equal(html.includes("HonestPing-Setup.exe"), false);
  assert.match(html, /HonestPing\.dmg/);
  assert.match(html, />8</);
  assert.match(html, /Hidden/);
});

test("CSV export escapes quotes, commas, newlines, and formula characters", async () => {
  const csv = waitlistCsv([{
    email: 'a"b,c@example.com',
    created_at: "2026-10-01T00:00:00.000Z",
    source_page: "=1+1",
  }]);
  assert.equal(csv.includes("email,created_at,source_page"), true);
  assert.equal(csv.includes('"a""b,c@example.com"'), true);
  assert.equal(csv.includes("'=1+1"), true);

  const isp = ispCsv([{
    name: "Ada",
    company: "Example, ISP",
    email: "ada@example.com",
    subscribers: null,
    message: "Hello\r\nthere",
    created_at: "2026-10-01T00:00:00.000Z",
    source_page: "@sheet",
    status: "talking",
  }]);
  assert.equal(isp.includes('"Example, ISP"'), true);
  assert.equal(isp.includes('"Hello\r\nthere"'), true);
  assert.equal(isp.includes("'@sheet"), true);
  assert.equal(isp.includes("ada@example.com"), true);

  const logged = [];
  const db = scriptedDb({
    all() {
      return [{
        email: 'a"b,c@example.com',
        created_at: "2026-10-01T00:00:00.000Z",
        source_page: "=1+1",
      }];
    },
    run(_sql, args) {
      logged.push(args);
    },
  });
  const token = await signJwt(claims());
  const response = await handleOwnerRequest(new Request("https://owner.honestping.com/export/waitlist.csv", {
    headers: { "cf-access-jwt-assertion": token },
  }), { ...accessEnv(), DB: db }, deps(certFetch()));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  assert.match(response.headers.get("content-disposition"), /waitlist\.csv/);
  const body = await response.text();
  assert.equal(body.includes('"a""b,c@example.com"'), true);
  assert.equal(body.includes("'=1+1"), true);
  assert.equal(logged.some((args) => args[0] === "hello@honestping.com" && args[1] === "export"), true);
});

test("a status save without a same origin header does not write", async () => {
  let prepared = 0;
  const token = await signJwt(claims());
  const response = await handleOwnerRequest(new Request("https://owner.honestping.com/isp/status", {
    method: "POST",
    headers: {
      "cf-access-jwt-assertion": token,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "inquiry_id=4&status=partner",
  }), {
    ...accessEnv(),
    DB: {
      prepare() {
        prepared += 1;
        throw new Error("should not write");
      },
    },
  }, deps(certFetch()));
  assert.equal(response.status, 403);
  assert.equal(prepared, 0);
});

function applySqlFiles(db, dir) {
  const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const statements = [];
  for (const name of files) {
    const sql = readFileSync(`${dir}/${name}`, "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      statements.push(statement);
    }
  }
  return statements.reduce(async (previous, statement) => {
    await previous;
    try {
      await db.prepare(statement).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column name|no such column/i.test(message)) throw error;
    }
  }, Promise.resolve());
}

test("owner migration stores ISP status and the access log on local D1", async () => {
  const proxy = await getPlatformProxy({
    configPath: "owner/wrangler.jsonc",
    remoteBindings: false,
    envFiles: [],
    persist: { path: ".wrangler/state/owner-test" },
  });
  try {
    await applySqlFiles(proxy.env.DB, "migrations");
    await applySqlFiles(proxy.env.DB, "owner/migrations");
    await proxy.env.DB.prepare("DELETE FROM owner_access_log").run();
    await proxy.env.DB.prepare("DELETE FROM isp_pipeline").run();
    await proxy.env.DB.prepare("DELETE FROM isp_inquiries WHERE email = ?").bind("owner-isp@example.com").run();
    await proxy.env.DB.prepare("DELETE FROM waitlist WHERE email LIKE 'owner-test-%'").run();
    const insertWaitlist = (email, source) => proxy.env.DB.prepare(
      "INSERT INTO waitlist (email, created_at, source_page, user_agent_hash) VALUES (?, ?, ?, ?)",
    ).bind(email, "2026-10-08T00:00:00.000Z", source, null).run();
    for (let i = 0; i < 4; i += 1) {
      await insertWaitlist(`owner-test-few-${i}@example.com`, "/secret-page");
    }
    for (let i = 0; i < 6; i += 1) {
      await insertWaitlist(`owner-test-many-${i}@example.com`, "/");
    }
    const shown = suppressSmallGroups(await waitlistSources(proxy.env.DB));
    assert.equal(shown.some((row) => row.label === "/secret-page"), false);
    assert.equal(shown.some((row) => row.label === "/" && row.count >= 6), true);

    await proxy.env.DB.prepare(
      "INSERT INTO isp_inquiries (email, name, company, subscribers, message, created_at, source_page, user_agent_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "owner-isp@example.com",
      "Ada",
      "Example ISP",
      null,
      "Hello there",
      "2026-10-08T00:00:00.000Z",
      "/isp",
      null,
    ).run();
    const inquiry = await proxy.env.DB.prepare(
      "SELECT id FROM isp_inquiries WHERE email = ?",
    ).bind("owner-isp@example.com").first();
    const saved = await saveStatus(
      proxy.env.DB,
      inquiry.id,
      "pilot",
      "hello@honestping.com",
      "2026-10-08T01:00:00.000Z",
    );
    assert.equal(saved.changed, true);
    const repeat = await saveStatus(
      proxy.env.DB,
      inquiry.id,
      "pilot",
      "hello@honestping.com",
      "2026-10-08T02:00:00.000Z",
    );
    assert.equal(repeat.changed, false);
    const list = await ispRows(proxy.env.DB);
    const match = list.rows.find((row) => row.email === "owner-isp@example.com");
    assert.equal(match.status, "pilot");
    await assert.rejects(proxy.env.DB.prepare(
      "INSERT INTO isp_pipeline (inquiry_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?)",
    ).bind(inquiry.id + 1000, "nope", "2026-10-08T00:00:00.000Z", "hello@honestping.com").run());
    await logAccess(proxy.env.DB, "hello@honestping.com", "status", `inquiry ${inquiry.id} pilot`, "2026-10-08T01:00:00.000Z");
    const log = await accessRows(proxy.env.DB);
    assert.equal(log.ready, true);
    assert.equal(log.rows[0].actor_email, "hello@honestping.com");
    assert.equal(log.rows[0].action, "status");
  } finally {
    await proxy.dispose();
  }
});

test("issue groups count 7 and 30 days, split by source, and flag close titles", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  const groups = buildGroups([
    { issue_type: "speed_test", day: "2026-10-08", source: "app", count: 3 },
    { issue_type: "speed_test", day: "2026-10-02", source: "isp", count: 1 },
    { issue_type: "trace", day: "2026-10-01", source: "app", count: 2 },
  ], now);
  const speed = groups.find((group) => group.issueType === "speed_test");
  const trace = groups.find((group) => group.issueType === "trace");
  assert.equal(speed.days7, 4);
  assert.equal(speed.days30, 4);
  assert.equal(speed.app, 3);
  assert.equal(speed.isp, 1);
  assert.equal(speed.spark.length, 30);
  assert.equal(speed.spark.at(-1), 3);
  assert.equal(trace.days7, 0);
  assert.equal(trace.days30, 2);
  assert.equal(trace.app, 2);
  assert.equal(groups[0].issueType, "speed_test");

  assert.equal(titlesClose("Speed test looked wrong", "The speed test looked wrong again"), true);
  assert.equal(titlesClose("Speed test looked wrong", "Monitor alerts never arrive"), false);
  const rows = attachDuplicates([
    { id: 1, issue_type: "speed_test", title: "Speed test looked wrong" },
    { id: 2, issue_type: "speed_test", title: "Speed test looked wrong again" },
    { id: 3, issue_type: "trace", title: "Speed test looked wrong again" },
  ]);
  assert.deepEqual(rows[0].similar, [2]);
  assert.deepEqual(rows[1].similar, [1]);
  assert.deepEqual(rows[2].similar, []);
});

test("the review queue shows an Auto badge, a log box, and records status changes", async () => {
  const html = renderDashboard({
    tab: "requests",
    email: "hello@honestping.com",
    requests: {
      ready: true,
      mode: "detail",
      detail: {
        id: 9,
        source: "app",
        kind: "crash",
        issue_type: "startup_freeze",
        title: "Closed during startup",
        description: "The window closed.",
        expected_behavior: null,
        page_context: "Startup",
        app_version: "1.8.48",
        os: "Windows 10",
        isp_org: null,
        screenshot_key: null,
        auto_sent: 1,
        status: "new",
        created_at: "2026-10-08T15:00:00.000Z",
        diagnostics: { log_excerpt: "startup step 2\nsecond line", screen: "Startup" },
        similar: [{ id: 4, title: "Closed during startup again" }],
      },
    },
  });
  assert.match(html, /class="badge-auto">Auto</);
  assert.match(html, /© <span id="year">2026<\/span> Honest Ping LLC/);
  assert.equal(/anson|mitchell|matt lewis/i.test(html), false);
  assert.match(html, /class="logbox"/);
  assert.match(html, /startup step 2/);
  assert.match(html, /HP-4/);
  assert.equal(html.includes("\u2013"), false);
  assert.equal(html.includes("\u2014"), false);

  const writes = [];
  const db = scriptedDb({
    first(sql) {
      if (/from feedback/i.test(sql)) return { status: "new" };
      return null;
    },
    run(sql, args) {
      writes.push({ sql, args });
    },
  });
  const token = await signJwt(claims());
  const saved = await handleOwnerRequest(new Request("https://owner.honestping.com/requests/status", {
    method: "POST",
    headers: {
      "cf-access-jwt-assertion": token,
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://owner.honestping.com",
    },
    body: "feedback_id=9&status=reviewing",
  }), { ...accessEnv(), DB: db }, deps(certFetch()));
  assert.equal(saved.status, 303);
  assert.match(saved.headers.get("location"), /\/requests\/9$/);
  assert.equal(writes.some((entry) => /UPDATE feedback/i.test(entry.sql) && entry.args[0] === "reviewing"), true);
  const logged = writes.find((entry) => /owner_access_log/i.test(entry.sql));
  assert.ok(logged);
  assert.equal(logged.args[0], "hello@honestping.com");
  assert.equal(logged.args[1], "status");
  assert.equal(logged.args[2], "feedback 9 reviewing");

  const quiet = [];
  const same = await handleOwnerRequest(new Request("https://owner.honestping.com/requests/status", {
    method: "POST",
    headers: {
      "cf-access-jwt-assertion": token,
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://owner.honestping.com",
    },
    body: "feedback_id=9&status=new",
  }), {
    ...accessEnv(),
    DB: scriptedDb({
      first() { return { status: "new" }; },
      run(sql) { quiet.push(sql); },
    }),
  }, deps(certFetch()));
  assert.equal(same.status, 303);
  assert.equal(quiet.some((sql) => /owner_access_log/i.test(sql)), false);
});
