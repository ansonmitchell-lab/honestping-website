import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { getPlatformProxy } from "wrangler";
import { handleSubmit, retryUnsent } from "../functions/lib/submit.js";

test("local D1 accepts the migration and a duplicate waitlist row", async () => {
  const proxy = await getPlatformProxy({
    configPath: "wrangler.worker.jsonc",
    remoteBindings: false,
    envFiles: [],
    persist: { path: ".wrangler/state/forms-test" },
  });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    action: "waitlist",
    hostname: "www.honestping.com",
  }), { status: 200, headers: { "content-type": "application/json" } });
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
          if (!/duplicate column name/i.test(message)) throw error;
        }
      }
    }
    proxy.env.TURNSTILE_SECRET = "test-secret";
    proxy.env.TURNSTILE_HOSTNAMES = "www.honestping.com,honestping.com";
    let sent = 0;
    proxy.env.EMAIL = {
      async send() {
        sent += 1;
      },
    };
    await proxy.env.DB.prepare("DELETE FROM waitlist WHERE email = ?").bind("local@example.com").run();
    await proxy.env.DB.prepare("DELETE FROM waitlist WHERE email = ?").bind("queued@example.com").run();
    const request = () => new Request("https://www.honestping.com/api/waitlist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "LocalTest/1.0",
        "cf-connecting-ip": "203.0.113.9",
      },
      body: JSON.stringify({
        email: "Local@Example.com",
        "cf-turnstile-response": "token-ok",
        source_page: "/",
      }),
    });
    const first = await handleSubmit(request(), proxy.env);
    const second = await handleSubmit(request(), proxy.env);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await first.json()).message, (await second.json()).message);
    assert.equal(sent, 1);
    const marked = await proxy.env.DB.prepare(
      "SELECT notified_at FROM waitlist WHERE email = ?",
    ).bind("local@example.com").first();
    assert.equal(typeof marked.notified_at, "string");
    proxy.env.EMAIL.send = async () => {
      throw new Error("mailbox unavailable");
    };
    const failed = await handleSubmit(request(), proxy.env);
    assert.equal(failed.status, 200);
    assert.equal(sent, 1);
    await proxy.env.DB.prepare(
      "UPDATE waitlist SET notified_at = NULL WHERE email = ?",
    ).bind("local@example.com").run();
    const stillUnsent = await handleSubmit(request(), proxy.env);
    assert.equal(stillUnsent.status, 200);
    assert.match((await stillUnsent.json()).message, /You're on the list/);
    assert.equal(sent, 1);
    const unmarked = await proxy.env.DB.prepare(
      "SELECT notified_at FROM waitlist WHERE email = ?",
    ).bind("local@example.com").first();
    assert.equal(unmarked.notified_at, null);
    let sentAgain = 0;
    proxy.env.EMAIL.send = async () => {
      sentAgain += 1;
      sent += 1;
    };
    const retried = await handleSubmit(request(), proxy.env);
    assert.equal(retried.status, 200);
    assert.equal(sentAgain, 1);
    const rows = await proxy.env.DB.prepare(
      "SELECT email, source_page, user_agent_hash, notified_at FROM waitlist WHERE email = ?",
    ).bind("local@example.com").all();
    assert.equal(rows.results.length, 1);
    assert.equal(rows.results[0].source_page, "/");
    assert.equal(rows.results[0].user_agent_hash.length, 64);
    assert.equal(typeof rows.results[0].notified_at, "string");
    assert.equal(JSON.stringify(rows.results).includes("203.0.113.9"), false);
    await proxy.env.DB.prepare("DELETE FROM isp_inquiries WHERE email = ?").bind("isp@example.com").run();
    const insertIsp = (stamp) => proxy.env.DB.prepare(
      "INSERT INTO isp_inquiries (email, name, company, subscribers, message, created_at, source_page, user_agent_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING",
    ).bind("isp@example.com", "Ada", "Example ISP", null, "Hello " + stamp, new Date().toISOString(), "/isp", null).run();
    const firstIsp = await insertIsp("one");
    const secondIsp = await insertIsp("two");
    assert.equal(Number(firstIsp.meta.changes), 1);
    assert.equal(Number(secondIsp.meta.changes), 0);
    const ispRows = await proxy.env.DB.prepare(
      "SELECT message FROM isp_inquiries WHERE email = ?",
    ).bind("isp@example.com").all();
    assert.equal(ispRows.results.length, 1);
    assert.equal(ispRows.results[0].message, "Hello one");
    const columns = await proxy.env.DB.prepare("PRAGMA table_info(waitlist)").all();
    assert.deepEqual(columns.results.map((column) => column.name), [
      "email",
      "created_at",
      "source_page",
      "user_agent_hash",
      "notified_at",
    ]);
    await proxy.env.DB.prepare(
      "UPDATE isp_inquiries SET notified_at = ? WHERE notified_at IS NULL",
    ).bind("2026-10-08T00:00:00.000Z").run();
    await proxy.env.DB.prepare("DELETE FROM waitlist WHERE notified_at IS NULL").run();
    await proxy.env.DB.prepare(
      "INSERT INTO waitlist (email, created_at, source_page, user_agent_hash) VALUES (?, ?, ?, ?)",
    ).bind("queued@example.com", "2026-10-08T00:00:00.000Z", "/", null).run();
    const cron = await retryUnsent(proxy.env);
    assert.equal(cron.waitlist, 1);
    assert.equal(cron.isp, 0);
    const queued = await proxy.env.DB.prepare(
      "SELECT notified_at FROM waitlist WHERE email = ?",
    ).bind("queued@example.com").first();
    assert.equal(typeof queued.notified_at, "string");
    const secondCron = await retryUnsent(proxy.env);
    assert.deepEqual(secondCron, { waitlist: 0, isp: 0 });
  } finally {
    globalThis.fetch = original;
    await proxy.dispose();
  }
});
