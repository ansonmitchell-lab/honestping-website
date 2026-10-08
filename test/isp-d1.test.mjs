import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPlatformProxy } from "wrangler";
import { confirmSuggestion, rejectSuggestion } from "../isp/src/admin.js";
import { buildSuggestions } from "../isp/src/cluster.js";
import { handleIspRequest } from "../isp/src/index.js";
import { ingestSharedTrace } from "../isp/src/ingest.js";
import { traceFingerprint } from "../isp/src/jcs.js";
import { applyIspMigrations } from "../isp/src/migrate.js";
import { addNodeWithRange } from "../isp/src/admin.js";
import {
  enrichmentFor,
  hopsForRun,
  listSuggestions,
  ownerTraceCounts,
  saveSuggestion,
  upsertEnrichment,
} from "../isp/src/queries.js";
import { rebuildSuggestions } from "../isp/src/cron.js";

const fixture = JSON.parse(readFileSync(new URL("../isp/seed/fixtures/example-slow-aggregation.json", import.meta.url), "utf8"));

function envFor(db, extra = {}) {
  return {
    DB: db,
    ALLOW_ISP_PREVIEW: "1",
    KEEP_ISP_PRIVATE_HOPS: "true",
    K_MIN: "10",
    HOUSEHOLD_SALT: "test-salt",
    ISP_ORG_TOKENS: JSON.stringify({ "token-a": "isp-a", "token-b": "isp-b" }),
    ...extra,
  };
}

async function resign(trace) {
  const next = structuredClone(trace);
  next.integrity.fingerprint = await traceFingerprint(next);
  return next;
}

async function clear(db) {
  for (const table of [
    "trace_ingest_warnings", "trace_hops", "shared_traces", "shared_reports",
    "node_suggestions", "hop_enrichment", "isp_node_ranges", "isp_nodes", "isp_integrations",
  ]) {
    await db.prepare(`DELETE FROM ${table}`).run();
  }
}

test("isp migrations, isolation, k-min, and ingest", async (t) => {
  const proxy = await getPlatformProxy({
    configPath: "isp/wrangler.jsonc",
    remoteBindings: false,
    envFiles: [],
    persist: { path: ".wrangler/state/isp-trace-test" },
  });
  const db = proxy.env.DB;
  try {
    const applied = await applyIspMigrations(db);
    assert.deepEqual(applied, [
      "0001_isp_nodes.sql",
      "0002_shared_traces.sql",
      "0003_node_discovery.sql",
    ]);
    await clear(db);

    await t.test("schema has no sender address column", async () => {
      const columns = await db.prepare("PRAGMA table_info(shared_traces)").all();
      const names = columns.results.map((column) => column.name);
      for (const banned of ["sender_ip", "client_ip", "remote_ip", "user_agent"]) {
        assert.equal(names.includes(banned), false);
      }
      assert.equal(names.includes("home_summary"), true);
      assert.equal(names.includes("run_id"), true);
    });

    await t.test("cidr match, redaction, run isolation, and no sender address", async () => {
      await addNodeWithRange(db, "isp-a", {
        id: "wide", name: "Wide", area: "Area 1", role: "access", cidr: "10.0.0.0/8", source: "manual",
      });
      await addNodeWithRange(db, "isp-a", {
        id: "tight", name: "Aggregation North", area: "Area 3", role: "aggregation", cidr: "10.212.4.0/24", source: "manual",
      });
      await addNodeWithRange(db, "isp-b", {
        id: "other", name: "Other", area: "Area 9", role: "access", cidr: "10.88.0.0/16", source: "manual",
      });
      const logs = [];
      const first = await resign(fixture.trace);
      const stored = await ingestSharedTrace(db, first, {
        ispOrg: "isp-a",
        example: true,
        householdSalt: "test-salt",
        senderIp: "192.0.2.55",
        clientIp: "192.0.2.55",
        log: (entry) => logs.push(entry),
      });
      assert.equal(stored.status, 201);
      assert.equal(stored.verdict, "core");
      const hops = await hopsForRun(db, "isp-a", first.run_id);
      assert.equal(hops.find((hop) => hop.ttl === 3).matched_node_id, "tight");
      assert.equal(hops.find((hop) => hop.ttl === 3).ip, "10.212.4.1");
      assert.equal(hops.find((hop) => hop.ttl === 1).ip, null);
      assert.equal(await hopsForRun(db, "isp-b", first.run_id), []);

      const second = await resign({
        ...structuredClone(fixture.trace),
        run_id: "11111111-1111-4111-8111-111111111111",
        report: { ...fixture.trace.report, report_id: "r_other" },
        hops: fixture.trace.hops.map((hop) => hop.ttl === 3 ? { ...hop, ip: "10.88.1.9" } : hop),
      });
      const other = await ingestSharedTrace(db, second, { ispOrg: "isp-b", example: true, householdSalt: "test-salt" });
      assert.equal(other.ok, true);
      const own = await hopsForRun(db, "isp-a", first.run_id);
      const theirs = await hopsForRun(db, "isp-b", second.run_id);
      assert.equal(own.some((hop) => hop.ip === "10.88.1.9"), false);
      assert.equal(theirs.some((hop) => hop.ip === "10.212.4.1"), false);
      assert.equal(theirs.some((hop) => hop.ip === "10.88.1.9"), true);

      const leaked = await resign({
        ...structuredClone(fixture.trace),
        run_id: "22222222-2222-4222-8222-222222222222",
        report: { ...fixture.trace.report, report_id: "r_home" },
        hops: fixture.trace.hops.map((hop) => hop.ttl === 1 ? { ...hop, ip: "192.168.1.1" } : hop),
      });
      const warned = await ingestSharedTrace(db, leaked, {
        ispOrg: "isp-a", example: true, householdSalt: "test-salt", log: (entry) => logs.push(entry),
      });
      assert.equal(warned.warnings.some((warning) => warning.code === "home_hop_unredacted"), true);
      const home = await hopsForRun(db, "isp-a", leaked.run_id);
      assert.equal(home.find((hop) => hop.ttl === 1).ip, null);

      const killedTrace = await resign({
        ...structuredClone(fixture.trace),
        run_id: "33333333-3333-4333-8333-333333333333",
        report: { ...fixture.trace.report, report_id: "r_kill" },
      });
      await ingestSharedTrace(db, killedTrace, {
        ispOrg: "isp-a", example: true, householdSalt: "test-salt", keepIspPrivate: false,
      });
      const killed = await hopsForRun(db, "isp-a", killedTrace.run_id);
      assert.equal(killed.find((hop) => hop.ttl === 3).ip, null);

      const blob = JSON.stringify({
        traces: (await db.prepare("SELECT * FROM shared_traces").all()).results,
        hops: (await db.prepare("SELECT * FROM trace_hops").all()).results,
        warnings: (await db.prepare("SELECT * FROM trace_ingest_warnings").all()).results,
        logs,
      });
      assert.equal(blob.includes("192.0.2.55"), false);
      assert.equal(blob.includes("192.168.1.1"), false);
      const counts = await ownerTraceCounts(db);
      assert.equal(typeof counts.traces, "number");
      assert.equal(JSON.stringify(counts).includes("10.212.4.1"), false);
    });

    await t.test("suggestions and enrichment stay inside the ISP org", async () => {
      await upsertEnrichment(db, {
        isp_org: "isp-a", ip: "203.0.113.10", ptr: "core1.example.net", asn: 64500,
        prefix: "203.0.113.0/24", ixp_id: null, fetched_at: 1_700_000_000,
      });
      assert.equal(await enrichmentFor(db, "isp-b", "203.0.113.10"), null);
      assert.equal((await enrichmentFor(db, "isp-a", "203.0.113.10")).ptr, "core1.example.net");
      await saveSuggestion(db, {
        id: "sug-a", isp_org: "isp-a", fingerprint: "fp-a", suggested_name: "agg-east",
        suggested_layer: "aggregation", ip_ranges: ["192.0.2.10/32"], neighbors: [],
        confidence: 0.7, evidence: { example: true }, households: 12, source: "trace",
        first_seen: 1, last_seen: 2,
      });
      await saveSuggestion(db, {
        id: "sug-small", isp_org: "isp-a", fingerprint: "fp-small", suggested_name: "too-small",
        suggested_layer: "access", ip_ranges: ["192.0.2.31/32"], neighbors: [],
        confidence: 0.4, evidence: {}, households: 9, source: "trace", first_seen: 1, last_seen: 2,
      });
      const visible = await listSuggestions(db, "isp-a", "suggested", 10);
      assert.equal(visible.some((row) => row.suggested_name === "agg-east"), true);
      assert.equal(visible.some((row) => row.suggested_name === "too-small"), false);
      assert.equal((await listSuggestions(db, "isp-b", "suggested", 10)).length, 0);
      const rejected = await rejectSuggestion(db, "isp-a", "sug-a", "preview");
      assert.equal(rejected.ok, true);
      const again = await saveSuggestion(db, {
        id: "sug-a2", isp_org: "isp-a", fingerprint: "fp-a", suggested_name: "agg-east-again",
        suggested_layer: "aggregation", ip_ranges: ["192.0.2.10/32"], neighbors: [],
        confidence: 0.9, evidence: {}, households: 20, source: "trace", first_seen: 1, last_seen: 3,
      });
      assert.equal(again.skipped, true);
      assert.equal((await listSuggestions(db, "isp-a", "suggested", 10)).some((row) => row.fingerprint === "fp-a"), false);
    });

    await t.test("confirm creates a trace sourced node", async () => {
      await saveSuggestion(db, {
        id: "sug-ok", isp_org: "isp-a", fingerprint: "fp-ok", suggested_name: "agg-east",
        suggested_layer: "aggregation", ip_ranges: ["192.0.2.10/32"], neighbors: [],
        confidence: 0.7, evidence: {}, households: 12, source: "trace", first_seen: 1, last_seen: 2,
      });
      const confirmed = await confirmSuggestion(db, "isp-a", "sug-ok", "Node East", "preview", new Date(), 10);
      assert.equal(confirmed.ok, true);
      const node = await db.prepare("SELECT name, source FROM isp_nodes WHERE isp_org = ? AND id = ?")
        .bind("isp-a", confirmed.node_id).first();
      assert.equal(node.name, "Node East");
      assert.equal(node.source, "trace");
      const low = await saveSuggestion(db, {
        id: "sug-low", isp_org: "isp-a", fingerprint: "fp-low", suggested_name: "low",
        suggested_layer: "access", ip_ranges: ["192.0.2.40/32"], neighbors: [],
        confidence: 0.2, evidence: {}, households: 9, source: "trace", first_seen: 1, last_seen: 2,
      });
      assert.equal(low.created, true);
      const refused = await confirmSuggestion(db, "isp-a", "sug-low", "Nope", "preview", new Date(), 10);
      assert.equal(refused.error, "below_minimum");
    });

    await t.test("nightly clustering does not cross run ids or the group minimum", async () => {
      const runs = [];
      for (let index = 0; index < 10; index += 1) {
        const trace = await resign({
          ...structuredClone(fixture.trace),
          run_id: `44444444-4444-4444-8444-${index.toString(16).padStart(12, "0")}`,
          report: { ...fixture.trace.report, report_id: `r_cluster_${index}` },
          outcome: { ...fixture.trace.outcome, hop_count: 3 },
          hops: [
            fixture.trace.hops[0],
            { ...fixture.trace.hops[1], ip: "203.0.113.40", scope: "public", role: "past_router" },
            { ...fixture.trace.hops[2], ip: "203.0.113.41", scope: "public", role: "past_router" },
          ],
        });
        await ingestSharedTrace(db, trace, { ispOrg: "isp-a", example: true, householdSalt: "test-salt" });
        runs.push(index);
      }
      await upsertEnrichment(db, {
        isp_org: "isp-a", ip: "203.0.113.40", ptr: "ae0.agg9.example.net", asn: 64500,
        prefix: "203.0.113.0/24", ixp_id: null, fetched_at: 1_700_000_000,
      });
      await upsertEnrichment(db, {
        isp_org: "isp-a", ip: "203.0.113.41", ptr: "ae1.agg9.example.net", asn: 64500,
        prefix: "203.0.113.0/24", ixp_id: null, fetched_at: 1_700_000_000,
      });
      const rebuilt = await rebuildSuggestions(db, "isp-a", new Date("2026-10-08T00:00:00Z"), 10);
      assert.equal(rebuilt.drafted >= 1, true);
      const rows = await listSuggestions(db, "isp-a", "suggested", 10);
      assert.equal(rows.some((row) => (row.ip_ranges || []).includes("203.0.113.40/32")), true);
      const separate = await buildSuggestions({
        runs: ["h1", "h2"].flatMap((householdHash) => ([
          { householdHash, startedAt: "2026-10-07T00:00:00Z", hops: [{ ttl: 1, ip: "203.0.113.40", role: "past_router" }] },
          { householdHash, startedAt: "2026-10-07T01:00:00Z", hops: [{ ttl: 1, ip: "198.51.100.40", role: "past_router" }] },
        ])),
        enrichment: new Map([
          ["203.0.113.40", { ptr: "agg9.example.net", asn: 64500 }],
          ["198.51.100.40", { ptr: "edge9.example.net", asn: 64500 }],
        ]),
        ispOrg: "isp-a",
        now: Date.parse("2026-10-08T00:00:00Z"),
        minHouseholds: 2,
      });
      const agg = separate.find((row) => row.suggested_name === "agg9");
      const edge = separate.find((row) => row.suggested_name === "edge9");
      assert.equal(agg.neighbors.some((row) => row.fingerprint === edge.fingerprint), false);
      assert.equal(runs.length, 10);
    });

    await t.test("no public route returns hop addresses", async () => {
      const env = envFor(db);
      const closed = await handleIspRequest(new Request("https://preview.example/isp-preview/support"), { DB: db });
      assert.equal(closed.status, 404);
      assert.equal((await closed.text()).includes("10.212.4.1"), false);
      const denied = await handleIspRequest(new Request("https://preview.example/isp-preview/paths"), env);
      assert.equal(denied.status, 401);
      assert.equal((await denied.text()).includes("10.212.4.1"), false);
      const root = await handleIspRequest(new Request("https://preview.example/"), env);
      assert.equal(root.status, 404);
      assert.equal((await root.text()).includes("10."), false);
      const missing = await handleIspRequest(new Request("https://preview.example/api/isp/traces", { method: "GET" }), env);
      assert.equal(missing.status, 404);
      const foreign = await handleIspRequest(new Request("https://preview.example/api/isp/traces/6f1c2b9e-4a7d-4c1e-9b2a-3d5e8f0a1c47", {
        headers: { authorization: "Bearer token-b" },
      }), env);
      assert.equal(foreign.status, 404);
      const foreignBody = await foreign.text();
      assert.equal(foreignBody.includes("10.212.4.1"), false);
      assert.equal(foreignBody.includes("10.88.1.9"), false);
      const owned = await handleIspRequest(new Request("https://preview.example/api/isp/traces/6f1c2b9e-4a7d-4c1e-9b2a-3d5e8f0a1c47", {
        headers: { authorization: "Bearer token-a" },
      }), env);
      assert.equal(owned.status, 200);
      assert.match(await owned.text(), /10\.212\.4\.1/);
      const page = await handleIspRequest(new Request("https://preview.example/isp-preview/support?run=11111111-1111-4111-8111-111111111111", {
        headers: { authorization: "Bearer token-a" },
      }), env);
      const html = await page.text();
      assert.equal(html.includes("10.88.1.9"), false);
    });
  } finally {
    await proxy.dispose();
  }
});
