import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSuggestions, ptrStem, scoreConfidence } from "../isp/src/cluster.js";
import { exampleNetworkModel, exampleSupportModel } from "../isp/src/example-model.js";
import { enrichPublicIp } from "../isp/src/enrich.js";
import { classifyHops } from "../isp/src/classify.js";
import { areaSentence, kMin, K_MIN_DEFAULT, presentHouseholds } from "../isp/src/households.js";
import { ipInCidr, matchLongest, parseCidr } from "../isp/src/ip.js";
import { sha256Hex, traceFingerprint } from "../isp/src/jcs.js";
import { explainFault, localizePath, minRtt } from "../isp/src/localize.js";
import { SQL } from "../isp/src/queries.js";
import { keepIspPrivateHops, redactHops } from "../isp/src/redact.js";
import { parseNodeCsv } from "../isp/src/upload.js";
import { validateSharedTrace } from "../isp/src/validate.js";
import { renderNetworkAdmin } from "../isp/src/views/network-admin.js";
import { renderPathCard } from "../isp/src/views/path-card.js";
import { renderPreviewPage } from "../isp/src/views/page.js";
import { renderSupportView } from "../isp/src/views/support-view.js";
import { displayHop } from "../isp/src/views/format.js";

const fixture = JSON.parse(readFileSync(new URL("../isp/seed/fixtures/example-slow-aggregation.json", import.meta.url), "utf8"));
const example = fixture.trace;

const NODES = [
  { id: "node_3b", role: "access", cidrs: ["100.92.0.0/16", "10.0.0.0/8"] },
  { id: "node_agg", role: "aggregation", cidrs: ["10.212.4.0/24"] },
  { id: "node_core", role: "core", cidrs: ["203.0.113.0/24"] },
  { id: "node_peer", role: "peering", cidrs: ["198.51.100.0/24"] },
];

function classifiedExample() {
  const redacted = redactHops(example.hops, { keepIspPrivate: true });
  return classifyHops(redacted.hops, { nodes: NODES });
}

test("example fixture fingerprint matches the shared trace schema", async () => {
  assert.equal(fixture.label.includes("EXAMPLE"), true);
  assert.equal(validateSharedTrace(example).ok, true);
  assert.equal(await traceFingerprint(example), example.integrity.fingerprint);
  assert.equal(example.integrity.fingerprint, "1c78d378e0e300983fea6f8673d3f3ab7301f03b9ab90711604bfad59208bd3d");
});

test("hops classify to home, last mile, aggregation, core, peering, and beyond", () => {
  const hops = classifiedExample();
  assert.deepEqual(hops.map((hop) => hop.segment), [
    "home", "access", "aggregation", "unknown", "core", "peering", "beyond_isp",
  ]);
  assert.equal(hops[0].ip, null);
  assert.equal(hops[1].isp_private, true);
  assert.equal(hops[1].matched_node_id, "node_3b");
  assert.equal(hops[2].matched_node_id, "node_agg");
  assert.equal(hops[2].ip, "10.212.4.1");
});

test("a confirmed range wins over a longer suggestion prefix", () => {
  const hops = classifyHops(redactHops(example.hops, { keepIspPrivate: true }).hops, {
    nodes: [{ id: "wide", role: "access", cidrs: ["10.212.4.0/24"] }],
    suggestions: [{ id: "sug", role: "core", cidrs: ["10.212.4.1/32"] }],
  });
  const hop = hops.find((row) => row.ttl === 3);
  assert.equal(hop.matched_node_id, "wide");
  assert.equal(hop.matched_suggestion_id, null);
  assert.equal(hop.segment, "access");
});

test("the longest confirmed prefix wins", () => {
  assert.equal(parseCidr("10.1.2.3/24"), null);
  assert.equal(ipInCidr("10.212.4.1", "10.0.0.0/8"), true);
  assert.equal(ipInCidr("10.212.4.1", "10.212.4.0/24"), true);
  assert.equal(ipInCidr("10.212.4.1", "10.212.5.0/24"), false);
  const match = matchLongest("10.212.4.1", [
    { id: "wide", cidrs: ["10.0.0.0/8"] },
    { id: "tight", cidrs: ["10.212.4.0/24"] },
  ]);
  assert.equal(match.id, "tight");
});

test("delay counts only when it persists, and a spike does not", () => {
  const fault = localizePath(classifiedExample());
  assert.equal(fault.onset.ttl, 3);
  assert.equal(fault.onset.kind, "latency");
  assert.equal(fault.verdict, "core");
  assert.match(fault.explanation, /Last mile looks clear/);
  assert.match(explainFault(fault, "Aggregation North"), /Aggregation North/);
  assert.equal(fault.segments.find((row) => row.segment === "access").verdict, "clear");
  assert.equal(fault.segments.find((row) => row.segment === "aggregation").verdict, "delay");

  const spike = localizePath([
    { ttl: 1, segment: "access", rtt_ms: [10, 11, 9], sent: 3, received: 3 },
    { ttl: 2, segment: "aggregation", rtt_ms: [400, 420, 410], sent: 3, received: 3 },
    { ttl: 3, segment: "core", rtt_ms: [12, 11, 13], sent: 3, received: 3 },
  ]);
  assert.equal(spike.onset, null);
  assert.equal(spike.ignored.some((row) => row.reason === "spike"), true);
  assert.match(spike.explanation, /not counted as a fault/);
});

test("transient loss is ignored and loss that continues is kept", () => {
  const recovered = localizePath([
    { ttl: 1, segment: "access", rtt_ms: [10, 10, 10], sent: 3, received: 3 },
    { ttl: 2, segment: "core", rtt_ms: [12, null, 11], sent: 3, received: 2 },
    { ttl: 3, segment: "beyond_isp", rtt_ms: [14, 13, 15], sent: 3, received: 3 },
  ]);
  assert.equal(recovered.onset, null);
  const stuck = localizePath([
    { ttl: 1, segment: "access", rtt_ms: [40, 40, 40], sent: 3, received: 3 },
    { ttl: 2, segment: "aggregation", rtt_ms: [40, null, null], sent: 3, received: 1 },
    { ttl: 3, segment: "core", rtt_ms: [null, 41, null], sent: 3, received: 1 },
  ]);
  assert.equal(stuck.onset.ttl, 2);
  assert.equal(stuck.onset.kind, "loss");
  assert.match(stuck.explanation, /Packet loss starts/);
});

test("min rtt ignores a single slow probe", () => {
  assert.equal(minRtt({ rtt_ms: [10, 400, 12] }), 10);
  const fault = localizePath([
    { ttl: 1, segment: "access", rtt_ms: [10, 10, 10], sent: 3, received: 3 },
    { ttl: 2, segment: "core", rtt_ms: [10, 400, 12], sent: 3, received: 3 },
  ]);
  assert.equal(fault.onset, null);
});

test("K_MIN defaults to 10 and is the only floor", () => {
  assert.equal(K_MIN_DEFAULT, 10);
  assert.equal(kMin({}), 10);
  assert.equal(kMin({ K_MIN: "12" }), 12);
  assert.equal(kMin({ K_MIN: "nope" }), 10);
  assert.equal(kMin({ K_MIN: "0" }), 10);
  const nine = Array.from({ length: 9 }, (_, index) => `h${index}`);
  const ten = nine.concat("h9");
  assert.equal(presentHouseholds(ten.concat("h0")).visible, true);
  assert.equal(presentHouseholds(ten.concat("h0")).count, 10);
  assert.deepEqual(presentHouseholds(nine), { visible: false, count: null });
  assert.equal(areaSentence(9, "Node 3B"), null);
  assert.match(areaSentence(10, "Node 3B"), /10 households on Node 3B/);
  const households = readFileSync(new URL("../isp/src/households.js", import.meta.url), "utf8");
  const queries = readFileSync(new URL("../isp/src/queries.js", import.meta.url), "utf8");
  assert.match(households, /K_MIN_DEFAULT = 10/);
  assert.equal(households.includes("MIN_HOUSEHOLDS = 5"), false);
  assert.equal(queries.includes("Math.max(5"), false);
});

test("clustering hides groups under K_MIN, keeps runs apart, and skips rejected fingerprints", async () => {
  assert.equal(ptrStem("ae1.agg1.example.net"), "agg1.example.net");
  assert.equal(ptrStem("agg1.example.net"), "agg1.example.net");
  const enrichment = new Map([
    ["203.0.113.10", { ptr: "ae0.agg1.example.net", asn: 64500, prefix: "203.0.113.0/24" }],
    ["203.0.113.11", { ptr: "ae1.agg1.example.net", asn: 64500, prefix: "203.0.113.0/24" }],
    ["203.0.113.20", { ptr: "core1.example.net", asn: 64500, prefix: "203.0.113.0/24" }],
    ["198.51.100.9", { ptr: "edge1.example.net", asn: 64500 }],
    ["203.0.113.50", { ptr: "lone.example.net", asn: 64500 }],
  ]);
  const runs = [];
  for (let index = 0; index < 10; index += 1) {
    runs.push({
      householdHash: `h${index}`,
      startedAt: "2026-10-01T00:00:00Z",
      hops: [
        { ttl: 2, ip: "203.0.113.10", role: "past_router" },
        { ttl: 3, ip: "203.0.113.20", role: "past_router" },
      ],
    });
    runs.push({
      householdHash: `h${index}`,
      startedAt: "2026-10-01T01:00:00Z",
      hops: [{ ttl: 2, ip: "198.51.100.9", role: "past_router" }],
    });
  }
  for (let index = 0; index < 9; index += 1) {
    runs.push({
      householdHash: `small${index}`,
      startedAt: "2026-10-02T00:00:00Z",
      hops: [{ ttl: 2, ip: "203.0.113.50", role: "past_router" }],
    });
  }
  const drafts = await buildSuggestions({
    runs, enrichment, ispOrg: "isp-a", now: Date.parse("2026-10-08T00:00:00Z"), ispAsns: [64500],
  });
  const names = drafts.map((row) => row.suggested_name).sort();
  assert.deepEqual(names, ["agg1", "core1", "edge1"]);
  assert.equal(drafts.find((row) => row.suggested_name === "agg1").households, 10);
  assert.equal(drafts.some((row) => row.ip_ranges.includes("203.0.113.50/32")), false);
  const core = drafts.find((row) => row.suggested_name === "core1");
  assert.equal(core.neighbors.some((row) => row.direction === "upstream"), true);
  assert.equal(core.neighbors.some((row) => row.fingerprint === drafts.find((item) => rowName(item) === "edge1").fingerprint), false);
  const rejected = await sha256Hex("isp-a|agg1.example.net");
  const again = await buildSuggestions({
    runs, enrichment, rejected: [rejected], ispOrg: "isp-a", now: Date.parse("2026-10-08T00:00:00Z"), ispAsns: [64500],
  });
  assert.equal(again.some((row) => row.suggested_name === "agg1"), false);
  const higher = await buildSuggestions({
    runs, enrichment, ispOrg: "isp-a", now: Date.parse("2026-10-08T00:00:00Z"), minHouseholds: 12,
  });
  assert.equal(higher.length, 0);
  assert.equal(scoreConfidence({ households: 10, spanMs: 0, ptrAgreement: 1, adjacencyStable: false }), 0.5);
});

function rowName(row) {
  return row.suggested_name;
}

test("home addresses are removed and the kill switch drops later private hops", () => {
  assert.equal(keepIspPrivateHops({}), true);
  assert.equal(keepIspPrivateHops({ KEEP_ISP_PRIVATE_HOPS: "false" }), false);
  const leaked = structuredClone(example.hops);
  leaked[0].ip = "192.168.1.1";
  const kept = redactHops(leaked, { keepIspPrivate: true });
  assert.equal(kept.hops[0].ip, null);
  assert.equal(kept.warnings.some((warning) => warning.code === "home_hop_unredacted"), true);
  assert.equal(JSON.stringify(kept).includes("192.168.1.1"), false);
  assert.equal(kept.hops[2].ip, "10.212.4.1");
  assert.equal(kept.hops[2].isp_private, true);
  const killed = redactHops(leaked, { keepIspPrivate: false });
  assert.equal(killed.hops[2].ip, null);
  assert.equal(killed.hops[1].ip, null);
  assert.equal(JSON.stringify(killed).includes("10.212.4.1"), false);
  assert.equal(JSON.stringify(killed).includes("100.92.0.1"), false);
});

test("CSV imports keep node fields and drop device identifiers", () => {
  const plain = parseNodeCsv("name,area,role,cidr,mac\nNode 9,Area 9,access,203.0.113.80/32,aa:bb:cc:dd:ee:ff\n", "plain");
  assert.equal(plain.nodes[0].cidr || plain.nodes[0].cidrs[0], "203.0.113.80/32");
  assert.equal(JSON.stringify(plain).includes("aa:bb"), false);
  assert.match(plain.warnings.join(" "), /not node data/);
  const netbox = parseNodeCsv("id,name,site,role,address\nnb-1,Cabinet North,Area 4,aggregation,203.0.113.90/32\n", "netbox");
  assert.equal(netbox.nodes[0].source, "netbox");
  assert.equal(netbox.nodes[0].role, "aggregation");
  assert.equal(netbox.nodes[0].external_ref, "nb-1");
  const uisp = parseNodeCsv("Name,Site,IP Address,Model\nTower South,Area 5,203.0.113.91,LTU Rocket\n", "uisp");
  assert.equal(uisp.nodes[0].source, "uisp");
  assert.equal(uisp.nodes[0].role, "access");
  assert.equal(uisp.nodes[0].cidrs[0], "203.0.113.91/32");
});

test("public enrichment skips private addresses and falls back when RIPEstat fails", async () => {
  const calls = [];
  const ok = async (url) => {
    calls.push(String(url));
    if (String(url).includes("type=PTR")) {
      return new Response(JSON.stringify({ Answer: [{ type: 12, data: "ae1.agg1.example.net." }] }), { status: 200 });
    }
    if (String(url).includes("prefix-overview")) {
      return new Response(JSON.stringify({ data: { asns: [{ asn: 64500 }], resource: "203.0.113.0/24" } }), { status: 200 });
    }
    if (String(url).includes("peeringdb")) {
      return new Response(JSON.stringify({ data: [{ ix_id: 42 }] }), { status: 200 });
    }
    return new Response("no", { status: 404 });
  };
  const skipped = await enrichPublicIp({ ip: "10.212.4.1", fetchImpl: ok, now: Date.now() });
  assert.equal(skipped.reason, "not_public");
  assert.equal(calls.length, 0);
  const first = await enrichPublicIp({ ip: "203.0.113.10", fetchImpl: ok, now: Date.now() });
  assert.equal(first.asn, 64500);
  assert.equal(first.ptr, "ae1.agg1.example.net");
  assert.equal(first.ixp_id, 42);
  const before = calls.length;
  const cached = await enrichPublicIp({
    ip: "203.0.113.10",
    fetchImpl: ok,
    now: Date.now(),
    cached: { ptr: first.ptr, asn: 64500, prefix: first.prefix, ixp_id: 42, fetched_at: Math.floor(Date.now() / 1000) },
  });
  assert.equal(cached.cached, true);
  assert.equal(calls.length, before);
  const fallbackCalls = [];
  const fallback = async (url) => {
    fallbackCalls.push(String(url));
    if (String(url).includes("cymru")) {
      return new Response(JSON.stringify({ Answer: [{ type: 16, data: "\"64500 | 203.0.113.0/24 | US | ripencc | 2020-01-01\"" }] }), { status: 200 });
    }
    if (String(url).includes("type=PTR")) return new Response(JSON.stringify({ Answer: [] }), { status: 200 });
    if (String(url).includes("peeringdb")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    return new Response("down", { status: 503 });
  };
  const second = await enrichPublicIp({ ip: "203.0.113.10", fetchImpl: fallback, now: Date.now() });
  assert.equal(second.asn, 64500);
  assert.equal(fallbackCalls.some((url) => url.includes("cymru")), true);
});

test("scoped reads and the owner total do not select hop addresses", () => {
  for (const [name, sql] of Object.entries(SQL)) {
    for (const table of ["trace_hops", "node_suggestions", "hop_enrichment"]) {
      if (!sql.includes(table)) continue;
      assert.match(sql, /isp_org/, `${name} must scope ${table}`);
    }
  }
  assert.equal(SQL.ownerCounts.includes("trace_hops"), false);
  assert.equal(SQL.ownerCounts.includes("hop_enrichment"), false);
  assert.match(SQL.hopsForRun, /isp_org = \? AND run_id = \?/);
});

test("preview copy stays plain and uses the company footer", () => {
  const support = renderPreviewPage({
    title: "Support",
    active: "support",
    body: renderSupportView(exampleSupportModel()),
  });
  const network = renderPreviewPage({
    title: "Network admin",
    active: "network",
    body: renderNetworkAdmin(exampleNetworkModel()),
  });
  const card = renderPathCard(exampleSupportModel());
  for (const html of [support, network, card]) {
    assert.equal(html.includes("\u2014"), false);
    assert.equal(html.includes("\u2013"), false);
    assert.equal(/official|certified/i.test(html), false);
    assert.equal(html.includes("Matt Lewis"), false);
    assert.equal(html.includes("Anson Mitchell"), false);
  }
  for (const html of [support, network]) {
    assert.match(html, /© <span id="year">2026<\/span> Honest Ping LLC/);
  }
  assert.match(support, /7-day report/);
  assert.match(support, /id="path-card"/);
  assert.match(card, /Aggregation North/);
  assert.match(card, /Past the last mile/);
  assert.match(network, /id="suggestions"/);
  assert.match(network, /Confirm/);
  assert.match(network, /Reject/);
  assert.match(network, /under 10 households/);
  assert.equal(network.includes("9 households"), false);
  const unnamed = displayHop({
    ttl: 3, role: "past_router", segment: "aggregation", matched_node_id: null,
    matched_suggestion_id: "sug", rtt_ms: [40, 41, 42], ip: "192.0.2.10",
  }, new Map(), 3);
  assert.equal(unnamed.label, "Aggregation");
  const doc = readFileSync(new URL("../docs/isp-trace-privacy.md", import.meta.url), "utf8");
  assert.match(doc, /does not sell data/);
  assert.match(doc, /Area trends are not for sale/);
  assert.match(doc, /pending/);
  assert.match(doc, /K_MIN/);
  assert.match(doc, /default is 10/);
  assert.match(doc, /not stored/);
  assert.match(doc, /device scan/i);
  assert.match(doc, /only when the customer/);
  assert.equal(doc.includes("\u2014"), false);
  assert.equal(doc.includes("\u2013"), false);
  for (const file of ["worker/index.js", "functions/api/isp.js", "functions/api/waitlist.js", "index.html", "owner/src/index.js"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(source.includes("trace_hops"), false, file);
    assert.equal(source.includes("hop_enrichment"), false, file);
  }
  const handler = readFileSync(new URL("../isp/src/index.js", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("../isp/src/ingest.js", import.meta.url), "utf8");
  assert.equal(/cf-connecting-ip/i.test(handler + ingest), false);
});
