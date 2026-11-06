import { exampleNetworkModel, exampleSupportModel } from "./example-model.js";
import { areaSentence, kMin, presentHouseholds } from "./households.js";
import { explainFault } from "./localize.js";
import {
  hopsForRun,
  listRuns,
  listSuggestions,
  nodesWithRanges,
  traceForOrg,
} from "./queries.js";
import { displayHop, roleLabel, VERDICT_LABEL } from "./views/format.js";

export const SPEC_RUN = "6f1c2b9e-4a7d-4c1e-9b2a-3d5e8f0a1c47";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function floorOf(env) {
  return kMin(env);
}

export async function loadSupportModel(db, ispOrg, floor, runId) {
  if (!db) return exampleSupportModel(floor);
  const trace = await pickTrace(db, ispOrg, runId);
  if (!trace) return exampleSupportModel(floor);
  const hops = await hopsForRun(db, ispOrg, trace.run_id);
  const nodes = await nodesWithRanges(db, ispOrg);
  const runs = (await listRuns(db, ispOrg)).filter((run) => run.example);
  const end = Date.parse(trace.received_at);
  const hashes = runs
    .filter((run) => run.suspect_node_id === trace.suspect_node_id && Date.parse(run.received_at) >= end - WEEK_MS)
    .map((run) => run.household_hash);
  return pathFromTrace(trace, hops, nodes, floor, hashes);
}

export async function loadNetworkModel(db, ispOrg, floor) {
  if (!db) return exampleNetworkModel(floor);
  const nodes = await nodesWithRanges(db, ispOrg);
  if (!nodes.length) return exampleNetworkModel(floor);
  const runs = (await listRuns(db, ispOrg)).filter((run) => run.example);
  const latest = runs.reduce((max, run) => Math.max(max, Date.parse(run.received_at) || 0), 0);
  const since = latest - WEEK_MS;
  const byNode = new Map();
  for (const run of runs) {
    if (!run.suspect_node_id || Date.parse(run.received_at) < since) continue;
    if (!byNode.has(run.suspect_node_id)) byNode.set(run.suspect_node_id, []);
    byNode.get(run.suspect_node_id).push(run);
  }
  const suggestions = await listSuggestions(db, ispOrg, "suggested", floor);
  return {
    kMin: floor,
    pending: true,
    nodes: nodes.map((node) => {
      const group = byNode.get(node.id) || [];
      const presented = presentHouseholds(group.map((run) => run.household_hash), floor);
      const sample = group[0];
      return {
        id: node.id,
        name: node.name,
        area: node.area || "",
        role: node.role,
        roleLabel: roleLabel(node.role),
        visible: presented.visible,
        countLabel: presented.visible ? String(presented.count) : "Hidden",
        evidence: presented.visible
          ? (sample
            ? `Example trace ${sample.run_id.slice(0, 8)} localizes the delay or loss here.`
            : "Shared example traces in this window localize here.")
          : `Hidden. This 7-day report window is under ${floor} households.`,
      };
    }),
    suggestions: suggestions.map(suggestionRow),
    ranges: nodes.flatMap((node) => (node.cidrs || []).map((cidr) => ({
      nodeId: node.id,
      nodeName: node.name,
      cidr,
      source: node.source,
    }))),
    mergeTargets: nodes.map((node) => ({ id: node.id, name: node.name })),
  };
}

async function pickTrace(db, ispOrg, runId) {
  if (runId) {
    const asked = await traceForOrg(db, ispOrg, runId);
    if (asked && asked.example) return asked;
  }
  const spec = await traceForOrg(db, ispOrg, SPEC_RUN);
  if (spec && spec.example) return spec;
  const runs = (await listRuns(db, ispOrg)).filter((run) => run.example);
  if (!runs.length) return null;
  return traceForOrg(db, ispOrg, runs[0].run_id);
}

function pathFromTrace(trace, hops, nodes, floor, hashes) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const suspect = trace.suspect_node_id ? nodesById.get(trace.suspect_node_id) : null;
  const presented = presentHouseholds(hashes, floor);
  const fault = {
    onset: trace.onset_ttl == null ? null : {
      ttl: trace.onset_ttl,
      kind: trace.onset_kind,
      segment: trace.onset_segment,
    },
    ignored: [],
    verdict: trace.verdict || "clear",
  };
  return {
    claim: "Claim 1042",
    traceLabel: `Example trace ${trace.run_id.slice(0, 8)}`,
    kMin: floor,
    verdict: fault.verdict,
    verdictLabel: VERDICT_LABEL[fault.verdict] || VERDICT_LABEL.clear,
    explanation: explainFault(fault, suspect ? suspect.name : null),
    areaLine: presented.visible && suspect ? areaSentence(presented.count, suspect.name, floor) : null,
    hops: hops.map((hop) => displayHop(hop, nodesById, trace.onset_ttl)),
  };
}

function suggestionRow(row) {
  const days = row.evidence && Number(row.evidence.span_days);
  const named = row.evidence && Array.isArray(row.evidence.ptr_samples) && row.evidence.ptr_samples.length > 0;
  const bits = [`${row.households} households`];
  if (named) bits.push("name stem agrees");
  if (Number.isInteger(days) && days > 0) bits.push(`seen across ${days} days of example traces`);
  return {
    id: row.id,
    name: row.suggested_name || "Suggested node",
    layer: row.suggested_layer,
    layerLabel: roleLabel(row.suggested_layer),
    households: row.households,
    confidenceLabel: `${Math.round(Number(row.confidence) * 100)}%`,
    ranges: (row.ip_ranges || []).join(", "),
    evidence: bits.join(", "),
  };
}
