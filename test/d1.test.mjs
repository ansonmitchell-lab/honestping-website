import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPlatformProxy } from "wrangler";
import { handleSubmit } from "../functions/lib/submit.js";

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
    const sql = readFileSync(new URL("../migrations/0001_forms.sql", import.meta.url), "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await proxy.env.DB.prepare(statement).run();
    }
    proxy.env.TURNSTILE_SECRET = "test-secret";
    proxy.env.TURNSTILE_HOSTNAMES = "www.honestping.com,honestping.com";
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
    const rows = await proxy.env.DB.prepare(
      "SELECT email, source_page, user_agent_hash FROM waitlist WHERE email = ?",
    ).bind("local@example.com").all();
    assert.equal(rows.results.length, 1);
    assert.equal(rows.results[0].source_page, "/");
    assert.equal(rows.results[0].user_agent_hash.length, 64);
    assert.equal(JSON.stringify(rows.results).includes("203.0.113.9"), false);
    const columns = await proxy.env.DB.prepare("PRAGMA table_info(waitlist)").all();
    assert.deepEqual(columns.results.map((column) => column.name), [
      "email",
      "created_at",
      "source_page",
      "user_agent_hash",
    ]);
  } finally {
    globalThis.fetch = original;
    await proxy.dispose();
  }
});
