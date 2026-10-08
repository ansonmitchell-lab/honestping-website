import { readFileSync } from "node:fs";
import { addNodeWithRange } from "../src/admin.js";
import { rejectSuggestion } from "../src/admin.js";
import { ingestSharedTrace } from "../src/ingest.js";
import { traceFingerprint } from "../src/jcs.js";
import { listNodes, saveSuggestion } from "../src/queries.js";

export const EXAMPLE_ORG = "example-isp";
export const SALT = "preview-example-salt";

const NODES = [
  ["node_3b", "Node 3B", "Area 3", "access", "100.92.0.0/16"],
  ["node_agg", "Aggregation North", "Area 3", "aggregation", "10.212.4.0/24"],
  ["node_core", "Core West", "Area 3", "core", "203.0.113.0/24"],
  ["node_peer", "Peering edge", "Area 3", "peering", "198.51.100.0/24"],
  ["node_quiet", "Quiet spur", "Area 1", "access", "100.64.50.0/24"],
];

export function loadExampleTrace() {
  const file = new URL("./fixtures/example-slow-aggregation.json", import.meta.url);
  const wrapped = JSON.parse(readFileSync(file, "utf8"));
  return wrapped.trace;
}

export async function signedVariant(base, { runId, reportId, startedAt, rtts }) {
  const trace = structuredClone(base);
  trace.run_id = runId;
  trace.report.report_id = reportId;
  trace.started_at = startedAt;
  trace.finished_at = startedAt.replace(/:04Z$/, ":19Z");
  if (rtts) {
    for (const hop of trace.hops) {
      if (!rtts[hop.ttl]) continue;
      hop.rtt_ms = rtts[hop.ttl];
      hop.sent = hop.rtt_ms.length;
      hop.received = hop.rtt_ms.filter((value) => value != null).length;
    }
  }
  trace.integrity.fingerprint = await traceFingerprint(trace);
  return trace;
}

function stamp(index) {
  const hour = 2 + Math.floor(index / 60);
  const minute = index % 60;
  return `2026-10-07T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:04Z`;
}

function runId(n) {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const LAST_MILE = {
  2: [140, 148, 144],
  3: [150, 149, 152],
  5: [155, null, 158],
  6: [160, 158, 162],
  7: [161, 160, 164],
};

const CORE = {
  2: [8, 9, 10],
  3: [12, 11, 13],
  5: [180, 190, 186],
  6: [188, 184, 191],
  7: [190, 192, 189],
};

async function ingestExample(db, trace) {
  return ingestSharedTrace(db, trace, {
    ispOrg: EXAMPLE_ORG,
    example: true,
    householdSalt: SALT,
    receivedAt: trace.started_at,
    env: { K_MIN: "10", KEEP_ISP_PRIVATE_HOPS: "true" },
  });
}

export async function seedExample(db) {
  const existing = new Set((await listNodes(db, EXAMPLE_ORG)).map((node) => node.id));
  for (const [id, name, area, role, cidr] of NODES) {
    if (existing.has(id)) continue;
    const created = await addNodeWithRange(db, EXAMPLE_ORG, {
      id, name, area, role, cidr, source: "manual",
    });
    if (!created.ok) throw new Error(created.error || "node");
  }
  const base = loadExampleTrace();
  await ingestExample(db, base);
  let n = 1;
  for (let i = 0; i < 11; i += 1) {
    const trace = await signedVariant(base, {
      runId: runId(n),
      reportId: `r_example_agg_${n}`,
      startedAt: stamp(n),
    });
    await ingestExample(db, trace);
    n += 1;
  }
  for (let i = 0; i < 14; i += 1) {
    const trace = await signedVariant(base, {
      runId: runId(n),
      reportId: `r_example_mile_${n}`,
      startedAt: stamp(n),
      rtts: LAST_MILE,
    });
    await ingestExample(db, trace);
    n += 1;
  }
  for (let i = 0; i < 6; i += 1) {
    const trace = await signedVariant(base, {
      runId: runId(n),
      reportId: `r_example_core_${n}`,
      startedAt: stamp(n),
      rtts: CORE,
    });
    await ingestExample(db, trace);
    n += 1;
  }
  const now = Math.floor(Date.parse("2026-10-07T12:00:00Z") / 1000);
  const suggestions = [
    ["sug_agg_east", "example-agg-east", "agg-east", "aggregation", ["192.0.2.10/32", "192.0.2.11/32"], 12, 0.72, ["ae1.agg-east.example.net"], false],
    ["sug_core_south", "example-core-south", "core-south", "core", ["192.0.2.20/32"], 11, 0.64, [], false],
    ["sug_small", "example-small", "small-spur", "access", ["192.0.2.31/32"], 9, 0.4, [], false],
    ["sug_rejected", "example-rejected", "old-edge", "peering", ["192.0.2.30/32"], 12, 0.5, [], true],
  ];
  for (const [id, fingerprint, name, layer, ranges, households, confidence, ptrs, reject] of suggestions) {
    const saved = await saveSuggestion(db, {
      id,
      isp_org: EXAMPLE_ORG,
      fingerprint,
      suggested_name: name,
      suggested_layer: layer,
      ip_ranges: ranges,
      neighbors: [],
      confidence,
      evidence: { households, ptr_samples: ptrs, span_days: 8, example: true },
      households,
      source: "trace",
      first_seen: now - 8 * 86400,
      last_seen: now,
    });
    if (reject && saved.created) await rejectSuggestion(db, EXAMPLE_ORG, id, "preview");
  }
  return { org: EXAMPLE_ORG };
}
