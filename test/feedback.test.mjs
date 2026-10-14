import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { getPlatformProxy } from "wrangler";
import { sha256Hex } from "../functions/lib/digest.js";
import { LIMITS } from "../functions/lib/feedback-contract.js";
import { handleFeedback } from "../functions/lib/feedback.js";
import { showGroupCount } from "../functions/lib/k-min.js";
import { RATE_LIMIT_TTL_SECONDS } from "../functions/lib/rate-limit.js";
import { redactText } from "../functions/lib/redact.js";
import { crashBodyCutoff, reportBodyCutoff, retainFeedback } from "../functions/lib/retention.js";
import { HELP_COPY, renderIspPreview } from "../isp-preview/render.js";
import { loadRequestList, REQUEST_LIST_COLUMNS } from "../owner/src/feedback.js";
import worker from "../worker/index.js";

const NOW = new Date("2026-10-08T15:00:00.000Z");
const SALT = "test-salt-feedback";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function memoryDb() {
  const rows = [];
  let nextId = 1;
  return {
    rows,
    prepare(sql) {
      const compact = sql.replace(/\s+/g, " ").trim();
      let args = [];
      return {
        bind(...next) {
          args = next;
          return this;
        },
        async first() {
          return null;
        },
        async run() {
          if (!compact.startsWith("INSERT INTO feedback")) throw new Error(compact);
          const id = nextId;
          nextId += 1;
          rows.push({
            id,
            source: args[0],
            kind: args[1],
            issue_type: args[2],
            title: args[3],
            description: args[4],
            expected_behavior: args[5],
            page_context: args[6],
            app_version: args[7],
            os: args[8],
            screenshot_key: args[9],
            diagnostics: args[10],
            auto_sent: args[11],
            exception_type: args[12],
            frames_hash: args[13],
            created_at: args[14],
            status: "new",
          });
          return { meta: { last_row_id: id, changes: 1 } };
        },
      };
    },
  };
}

function memoryR2() {
  const objects = new Map();
  return {
    objects,
    async put(key, body, options) {
      const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
      objects.set(key, { bytes, httpMetadata: options && options.httpMetadata });
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

function memoryKv() {
  const store = new Map();
  return {
    store,
    async get(key) {
      const row = store.get(key);
      if (!row) return null;
      if (row.expires <= Date.now()) {
        store.delete(key);
        return null;
      }
      return row.value;
    },
    async put(key, value, options) {
      const ttl = options && options.expirationTtl;
      if (!Number.isInteger(ttl) || ttl < 60 || ttl > RATE_LIMIT_TTL_SECONDS) {
        throw new Error("ttl");
      }
      store.set(key, { value: String(value), expires: Date.now() + ttl * 1000, ttl });
    },
  };
}

function testEnv(db = memoryDb(), extra = {}) {
  return {
    DB: db,
    FEEDBACK_IP_SALT: SALT,
    FEEDBACK_LIMITS: memoryKv(),
    SCREENSHOTS: memoryR2(),
    ...extra,
  };
}

function post(body, headers = {}) {
  return new Request("https://www.honestping.com/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "cf-connecting-ip": "203.0.113.44",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function send(body, env, headers) {
  return handleFeedback(post(body, headers), env, { now: () => NOW });
}

test("redaction removes emails, MACs, private addresses, and Windows user paths", () => {
  const input = [
    "C:\\Users\\Ada\\AppData\\PingTray\\crash.log",
    "C:/Users/Ada/Desktop/note.txt",
    "ada@example.com",
    "AA:BB:CC:DD:EE:FF",
    "aa-bb-cc-dd-ee-ff",
    "aabb.ccdd.eeff",
    "10.1.2.3",
    "192.168.1.20",
    "172.16.5.5",
    "172.31.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "fe80::1",
    "fd12:3456::abcd",
    "host ::1",
  ].join(" ");
  const cleaned = redactText(input);
  assert.equal(cleaned.includes("Ada"), false);
  assert.equal(cleaned.includes("ada@example.com"), false);
  assert.equal(cleaned.includes("AA:BB:CC:DD:EE:FF"), false);
  assert.equal(cleaned.includes("192.168.1.20"), false);
  assert.equal(cleaned.includes("172.16.5.5"), false);
  assert.equal(cleaned.includes("fe80::1"), false);
  assert.match(cleaned, /\[user\]/);
  assert.match(cleaned, /\[email\]/);
  assert.match(cleaned, /\[mac\]/);
  assert.match(cleaned, /\[private-ip\]/);
  const network = [
    "public 8.8.8.8 and 172.15.1.1 and 1.8.48",
    "2001:4860:4860::8888",
    "SSID: FamilyWifi",
    "isp: Example Fiber",
    "hostname: desk.home.lan",
    "machine DESKTOP-AB12CD",
    "install_id=abc-123-key",
    "15:00:00",
  ].join(" ");
  const stripped = redactText(network);
  assert.equal(stripped.includes("8.8.8.8"), false);
  assert.equal(stripped.includes("172.15.1.1"), false);
  assert.equal(stripped.includes("2001:4860"), false);
  assert.equal(stripped.includes("FamilyWifi"), false);
  assert.equal(stripped.includes("Example Fiber"), false);
  assert.equal(stripped.includes("desk.home.lan"), false);
  assert.equal(stripped.includes("DESKTOP-AB12CD"), false);
  assert.equal(stripped.includes("abc-123-key"), false);
  assert.match(stripped, /1\.8\.48/);
  assert.match(redactText("at App.Main()"), /App\.Main/);
  assert.match(stripped, /15:00:00/);
  assert.match(stripped, /\[ip\]/);
  assert.match(stripped, /\[ssid\]/);
  assert.match(stripped, /\[isp\]/);
  assert.match(stripped, /\[host\]/);
  assert.match(stripped, /\[machine\]/);
  assert.match(stripped, /\[install\]/);
});

test("feedback validation rejects bad fields and accepts bug, feature, and auto crash", async () => {
  const db = memoryDb();
  const env = testEnv(db);
  const missingTitle = await send({ source: "isp", kind: "feature", title: "  " }, env);
  assert.equal(missingTitle.status, 400);
  assert.match((await missingTitle.json()).error, /Title is required/);
  assert.match(missingTitle.headers.get("access-control-allow-origin"), /\*/);

  const longTitle = await send({ source: "app", kind: "feature", title: "a".repeat(81) }, env);
  assert.equal(longTitle.status, 400);
  assert.match((await longTitle.json()).error, /80 characters/);

  const longDescription = await send({
    source: "isp",
    kind: "feature",
    title: "Shorter queue",
    description: "a".repeat(2001),
  }, env);
  assert.equal(longDescription.status, 400);

  const badKind = await send({ source: "app", kind: "idea", title: "Hello" }, env);
  assert.equal(badKind.status, 400);

  const mismatch = await send({
    source: "app",
    kind: "bug",
    issue_type: "claim_queue",
    title: "Wrong type",
  }, env);
  assert.equal(mismatch.status, 400);
  assert.match((await mismatch.json()).error, /does not match/);

  const needsType = await send({ source: "isp", kind: "bug", title: "Missing type" }, env);
  assert.equal(needsType.status, 400);

  const badAuto = await send({
    source: "app",
    kind: "crash",
    issue_type: "startup_freeze",
    title: "Closed on launch",
    auto_sent: "true",
  }, env);
  assert.equal(badAuto.status, 400);

  const extraDiag = await send({
    source: "app",
    kind: "bug",
    issue_type: "speed_test",
    title: "Speed test stalled",
    diagnostics: { log_excerpt: "fine", wifi: "secret" },
  }, env);
  assert.equal(extraDiag.status, 400);

  const hugeDiag = await send({
    source: "app",
    kind: "bug",
    issue_type: "trace",
    title: "Trace log is huge",
    diagnostics: { log_excerpt: "é".repeat(40000) },
  }, env);
  assert.equal(hugeDiag.status, 400);
  assert.match((await hugeDiag.json()).error, /64 KB/);

  const gif = await send({
    source: "isp",
    kind: "feature",
    title: "A gif",
    screenshot: Buffer.from("GIF89a").toString("base64"),
  }, env);
  assert.equal(gif.status, 400);
  assert.equal(db.rows.length, 0);

  const feature = await send({
    source: "isp",
    kind: "feature",
    title: "Export the claim queue",
    description: "A Monday export would help.",
    page_context: "Claim queue",
  }, env);
  assert.equal(feature.status, 200);
  assert.deepEqual(await feature.json(), { id: 1, status: "new" });

  const crash = await send({
    source: "app",
    kind: "crash",
    issue_type: "startup_freeze",
    title: "Closed during startup",
    auto_sent: true,
    app_version: "1.8.48",
    exception_type: "System.InvalidOperationException",
    top_frames: ["at App.Main()", "C:\\Users\\Ada\\AppData"],
    isp_org: "Example Fiber",
    diagnostics: {
      os: "Windows 10",
      screen: "Startup",
      install_id: "should-not-store",
      ssid: "FamilyWifi",
      log_excerpt: "C:\\Users\\Ada\\AppData at 192.168.1.20 mac AA:BB:CC:DD:EE:FF ada@example.com via 8.8.8.8 hostname: desk.home.lan",
    },
  }, env);
  assert.equal(crash.status, 200);
  const saved = db.rows[1];
  assert.equal(saved.auto_sent, 1);
  assert.equal(saved.kind, "crash");
  assert.equal(saved.app_version, "1.8.48");
  assert.equal(saved.os, "Windows 10");
  assert.equal(saved.exception_type, "System.InvalidOperationException");
  assert.equal(saved.frames_hash, await sha256Hex("at App.Main()\n[user]\\AppData"));
  assert.match(saved.diagnostics, /\[user\]/);
  assert.match(saved.diagnostics, /\[private-ip\]/);
  assert.match(saved.diagnostics, /\[mac\]/);
  assert.match(saved.diagnostics, /\[email\]/);
  assert.match(saved.diagnostics, /\[ip\]/);
  assert.match(saved.diagnostics, /\[host\]/);
  assert.equal(saved.diagnostics.includes("8.8.8.8"), false);
  assert.equal(saved.diagnostics.includes("should-not-store"), false);
  assert.equal(saved.diagnostics.includes("FamilyWifi"), false);
  assert.equal(JSON.stringify(saved).includes("203.0.113.44"), false);
  assert.equal(JSON.stringify(saved).includes("192.168.1.20"), false);
  assert.equal(JSON.stringify(saved).includes("Example Fiber"), false);
  assert.equal(Object.hasOwn(saved, "ip_hash"), false);
  for (const key of env.FEEDBACK_LIMITS.store.keys()) {
    assert.equal(key.includes("203.0.113.44"), false);
    assert.equal(env.FEEDBACK_LIMITS.store.get(key).ttl, RATE_LIMIT_TTL_SECONDS);
  }
});

test("crash posts are capped at 5 per hashed IP per day and other kinds stay separate", async () => {
  const db = memoryDb();
  const env = testEnv(db);
  const crash = {
    source: "app",
    kind: "crash",
    issue_type: "startup_freeze",
    title: "Closed during startup",
    auto_sent: true,
  };
  for (let i = 0; i < LIMITS.crashPerDay; i += 1) {
    const response = await send(crash, env);
    assert.equal(response.status, 200);
  }
  const limited = await send(crash, env);
  assert.equal(limited.status, 429);
  assert.match(limited.headers.get("access-control-allow-origin"), /\*/);
  assert.match((await limited.json()).error, /crash reports/);

  const otherNetwork = await send(crash, env, { "cf-connecting-ip": "203.0.113.45" });
  assert.equal(otherNetwork.status, 200);

  const feature = await send({
    source: "isp",
    kind: "feature",
    title: "Still room for a feature",
  }, env);
  assert.equal(feature.status, 200);

  for (let i = 0; i < LIMITS.reportsPerDay - 1; i += 1) {
    const response = await send({ source: "app", kind: "bug", issue_type: "other", title: `Bug ${i} title` }, env);
    assert.equal(response.status, 200);
  }
  const tooMany = await send({ source: "isp", kind: "feature", title: "One more idea" }, env);
  assert.equal(tooMany.status, 429);

  const nextDay = await handleFeedback(post(crash), env, {
    now: () => new Date("2026-10-09T00:10:00.000Z"),
  });
  assert.equal(nextDay.status, 200);
  assert.equal(JSON.stringify(db.rows).includes("ip_hash"), false);
});

test("a screenshot is stored only as an R2 object and a missing binding is a clear error", async () => {
  assert.equal(PNG[0], 0x89);
  const db = memoryDb();
  const bucket = memoryR2();
  const env = testEnv(db, { SCREENSHOTS: bucket });
  const saved = await send({
    source: "isp",
    kind: "bug",
    issue_type: "display_layout",
    title: "Badge wraps",
    screenshot: PNG.toString("base64"),
  }, env);
  assert.equal(saved.status, 200);
  assert.equal(bucket.objects.size, 1);
  const row = db.rows[0];
  assert.match(row.screenshot_key, /^feedback\/.+\.png$/);
  assert.equal(JSON.stringify(row).includes(PNG.toString("base64").slice(0, 24)), false);

  const unbound = await send({
    source: "isp",
    kind: "feature",
    title: "With a picture",
    screenshot: PNG.toString("base64"),
  }, testEnv(memoryDb(), { SCREENSHOTS: undefined }));
  assert.equal(unbound.status, 503);
  const body = await unbound.json();
  assert.match(body.error, /Screenshot storage/);
});

test("feedback responses stay JSON with CORS and the preview shell is unlinked", async () => {
  const options = await handleFeedback(new Request("https://www.honestping.com/api/feedback", { method: "OPTIONS" }), {});
  assert.equal(options.status, 204);
  assert.match(options.headers.get("access-control-allow-methods"), /POST/);

  const htmlType = await send({ source: "isp", kind: "feature", title: "Hi" }, testEnv(), {
    "content-type": "text/plain",
  });
  assert.equal(htmlType.status, 415);

  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return new Response("upstream", { status: 200 });
  };
  try {
    const preview = await worker.fetch(new Request("https://www.honestping.com/isp-preview/"));
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get("x-robots-tag"), /noindex/);
    assert.match(preview.headers.get("content-type"), /text\/html/);
    const page = await preview.text();
    assert.match(page, /noindex/);
    assert.match(page, /Suggest a feature/);
    assert.match(page, /Report a bug/);
    assert.match(page, /Example data/);
    assert.match(page, /source: "isp"/);
    assert.match(page, /7-day report/);
    assert.match(page, /groups of 10 or more households/);
    assert.match(page, /14 households/);
    assert.match(page, /© <span id="year">2026<\/span> Honest Ping LLC/);
    assert.match(page, /mailto:hello@honestping\.com/);
    assert.equal(page.includes("waitlist@"), false);
    assert.equal(/anson|mitchell|matt lewis/i.test(page), false);
    for (const copy of Object.values(HELP_COPY)) assert.match(page, new RegExp(copy.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(page.includes("\u2013"), false);
    assert.equal(page.includes("\u2014"), false);
    assert.equal(/netflix|youtube|hulu|disney|certified|official/i.test(page), false);
    assert.equal(seen.length, 0);

    const feedback = await worker.fetch(new Request("https://www.honestping.com/api/feedback", { method: "GET" }));
    assert.equal(feedback.status, 405);
    assert.match(feedback.headers.get("content-type"), /json/);
    assert.equal(seen.length, 0);
  } finally {
    globalThis.fetch = original;
  }

  const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const about = readFileSync(new URL("../about.html", import.meta.url), "utf8");
  assert.equal(home.includes("/isp-preview"), false);
  assert.equal(about.includes("/isp-preview"), false);
  assert.equal(REQUEST_LIST_COLUMNS.includes("ip_hash"), false);
});

test("migration 0004 stores redacted feedback in local D1 and a private R2 object", async () => {
  const proxy = await getPlatformProxy({
    configPath: "wrangler.worker.jsonc",
    remoteBindings: false,
    envFiles: [],
    persist: { path: ".wrangler/state/feedback-test" },
  });
  try {
    const migrations = new URL("../migrations/", import.meta.url);
    const files = readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort();
    for (const name of files) {
      const sql = readFileSync(new URL(name, migrations), "utf8");
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        try {
          await proxy.env.DB.prepare(statement).run();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/duplicate column name|no such column|already exists/i.test(message)) throw error;
        }
      }
    }
    await proxy.env.DB.prepare("DELETE FROM feedback").run();
    await proxy.env.DB.prepare("DELETE FROM crash_signatures").run();
    proxy.env.FEEDBACK_IP_SALT = `${SALT}-${Date.now()}`;
    assert.equal(typeof proxy.env.SCREENSHOTS.put, "function");
    const bug = await handleFeedback(post({
      source: "isp",
      kind: "bug",
      issue_type: "claim_detail",
      title: "Evidence badge wraps",
      description: "Seen from 192.168.0.8 isp: Example Fiber",
      expected_behavior: "The badge stays on one line.",
      page_context: "Claim detail",
      isp_org: "Example network",
      screenshot: PNG.toString("base64"),
      diagnostics: {
        app_version: "1.8.48",
        os: "Windows 10",
        screen: "Claim detail",
        log_excerpt: "C:\\Users\\Ada\\log AA:BB:CC:DD:EE:FF ada@isp.example",
      },
    }), proxy.env, { now: () => NOW });
    assert.equal(bug.status, 200);
    const saved = await bug.json();
    assert.equal(saved.status, "new");
    const row = await proxy.env.DB.prepare("SELECT * FROM feedback WHERE id = ?").bind(saved.id).first();
    assert.equal(row.kind, "bug");
    assert.equal(row.auto_sent, 0);
    assert.equal(row.status, "new");
    assert.match(row.description, /\[private-ip\]/);
    assert.match(row.description, /\[isp\]/);
    assert.equal(row.description.includes("Example Fiber"), false);
    assert.match(row.diagnostics, /\[user\]/);
    assert.match(row.diagnostics, /\[mac\]/);
    assert.match(row.diagnostics, /\[email\]/);
    assert.equal(JSON.stringify(row).includes("203.0.113.44"), false);
    assert.equal(JSON.stringify(row).includes("192.168.0.8"), false);
    assert.equal(JSON.stringify(row).includes("Example network"), false);
    assert.equal(Object.hasOwn(row, "ip_hash"), false);
    assert.equal(Object.hasOwn(row, "isp_org"), false);
    const object = await proxy.env.SCREENSHOTS.get(row.screenshot_key);
    assert.ok(object);
    assert.equal(object.httpMetadata.contentType, "image/png");
    const bytes = new Uint8Array(await object.arrayBuffer());
    assert.equal(bytes[0], 0x89);

    for (let i = 0; i < 5; i += 1) {
      const crash = await handleFeedback(post({
        source: "app",
        kind: "crash",
        issue_type: "startup_freeze",
        title: "Closed during startup",
        auto_sent: true,
      }), proxy.env, { now: () => NOW });
      assert.equal(crash.status, 200);
      assert.equal((await crash.json()).status, "new");
    }
    const limited = await handleFeedback(post({
      source: "app",
      kind: "crash",
      issue_type: "startup_freeze",
      title: "Closed during startup",
      auto_sent: true,
    }), proxy.env, { now: () => NOW });
    assert.equal(limited.status, 429);

    const list = await loadRequestList(proxy.env.DB, { source: "", kind: "", status: "" }, NOW);
    const crashes = list.groups.find((group) => group.issueType === "startup_freeze");
    assert.ok(crashes);
    assert.equal(crashes.days7, 5);
    assert.equal(crashes.app, 5);
    assert.equal(list.rows.some((row) => row.auto_sent === 1 && row.kind === "crash"), true);
    assert.equal(JSON.stringify(list.rows).includes("ip_hash"), false);
  } finally {
    await proxy.dispose();
  }
});

test("household counts use K_MIN and hide groups under the minimum", () => {
  const shown = renderIspPreview();
  assert.match(shown, /groups of 10 or more households/);
  assert.match(shown, /14 households/);
  assert.match(shown, /14 nearby households/);
  const hidden = renderIspPreview({ kMin: 15 });
  assert.match(hidden, /groups of 15 or more households/);
  assert.equal(hidden.includes("14 households"), false);
  assert.equal(hidden.includes("14 nearby"), false);
  assert.match(hidden, /Hidden/);
  assert.equal(showGroupCount(9), null);
  assert.equal(showGroupCount(10), 10);
  assert.equal(hidden.includes("\u2013"), false);
  assert.equal(hidden.includes("\u2014"), false);
});

test("retention deletes old crash bodies and old reports, and keeps a signature count", () => {
  const now = new Date("2026-10-08T03:15:00.000Z");
  assert.equal(crashBodyCutoff(now), "2026-07-10T03:15:00.000Z");
  assert.equal(reportBodyCutoff(now), "2025-10-08T03:15:00.000Z");
});

test("the nightly cron reduces stored crash bodies and drops old bug reports", async () => {
  const proxy = await getPlatformProxy({
    configPath: "wrangler.worker.jsonc",
    remoteBindings: false,
    envFiles: [],
    persist: { path: ".wrangler/state/feedback-retention" },
  });
  try {
    const migrations = new URL("../migrations/", import.meta.url);
    const files = readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort();
    for (const name of files) {
      const sql = readFileSync(new URL(name, migrations), "utf8");
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        try {
          await proxy.env.DB.prepare(statement).run();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/duplicate column name|no such column|already exists/i.test(message)) throw error;
        }
      }
    }
    await proxy.env.DB.prepare("DELETE FROM feedback").run();
    await proxy.env.DB.prepare("DELETE FROM crash_signatures").run();
    proxy.env.FEEDBACK_IP_SALT = `${SALT}-retain-${Date.now()}`;
    const crash = await handleFeedback(post({
      source: "app",
      kind: "crash",
      issue_type: "startup_freeze",
      title: "Closed during startup",
      auto_sent: true,
      exception_type: "System.InvalidOperationException",
      top_frames: ["at App.Main()"],
      screenshot: PNG.toString("base64"),
    }), proxy.env, { now: () => NOW });
    assert.equal(crash.status, 200);
    const crashId = (await crash.json()).id;
    const crashRow = await proxy.env.DB.prepare("SELECT screenshot_key FROM feedback WHERE id = ?").bind(crashId).first();
    const oldBug = await handleFeedback(post({
      source: "isp",
      kind: "bug",
      issue_type: "claim_detail",
      title: "Old badge wrap",
      screenshot: PNG.toString("base64"),
    }, { "cf-connecting-ip": "203.0.113.77" }), proxy.env, { now: () => NOW });
    assert.equal(oldBug.status, 200);
    const bugId = (await oldBug.json()).id;
    const bugRow = await proxy.env.DB.prepare("SELECT screenshot_key FROM feedback WHERE id = ?").bind(bugId).first();
    const recent = await handleFeedback(post({
      source: "isp",
      kind: "feature",
      title: "Keep this idea",
    }, { "cf-connecting-ip": "203.0.113.78" }), proxy.env, { now: () => NOW });
    assert.equal(recent.status, 200);
    const recentId = (await recent.json()).id;
    await proxy.env.DB.prepare("UPDATE feedback SET created_at = ? WHERE id = ?").bind("2026-07-01T00:00:00.000Z", crashId).run();
    await proxy.env.DB.prepare("UPDATE feedback SET created_at = ? WHERE id = ?").bind("2025-09-01T00:00:00.000Z", bugId).run();
    const result = await retainFeedback(proxy.env, NOW);
    assert.equal(result.crashesReduced, 1);
    assert.equal(result.reportsDeleted, 1);
    const goneCrash = await proxy.env.DB.prepare("SELECT id FROM feedback WHERE id = ?").bind(crashId).first();
    const goneBug = await proxy.env.DB.prepare("SELECT id FROM feedback WHERE id = ?").bind(bugId).first();
    const kept = await proxy.env.DB.prepare("SELECT id, title FROM feedback WHERE id = ?").bind(recentId).first();
    assert.equal(goneCrash, null);
    assert.equal(goneBug, null);
    assert.equal(kept.title, "Keep this idea");
    const signature = await proxy.env.DB.prepare("SELECT exception_type, count, frames_hash FROM crash_signatures").first();
    assert.equal(signature.exception_type, "System.InvalidOperationException");
    assert.equal(signature.count, 1);
    assert.equal(signature.frames_hash, await sha256Hex("at App.Main()"));
    assert.equal(await proxy.env.SCREENSHOTS.get(crashRow.screenshot_key), null);
    assert.equal(await proxy.env.SCREENSHOTS.get(bugRow.screenshot_key), null);
    const again = await retainFeedback(proxy.env, NOW);
    assert.equal(again.crashesReduced, 0);
    assert.equal(again.reportsDeleted, 0);
    const still = await proxy.env.DB.prepare("SELECT count FROM crash_signatures").first();
    assert.equal(still.count, 1);

    const ctx = { waitUntil() {} };
    await worker.scheduled({ cron: "15 3 * * *" }, proxy.env, ctx);
    await worker.scheduled({ cron: "*/15 * * * *" }, proxy.env, ctx);
  } finally {
    await proxy.dispose();
  }
});
