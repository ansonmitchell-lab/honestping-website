import { parseCidr } from "./ip.js";
import { K_MIN_DEFAULT, resolveKMin } from "./households.js";
import {
  insertNode,
  insertRange,
  listRanges,
  nodeById,
  reviewSuggestion,
  suggestionById,
} from "./queries.js";

const ROLES = new Set(["access", "aggregation", "core", "peering"]);
const SOURCES = new Set(["manual", "trace", "netbox", "uisp"]);

export function cleanLabel(value, max = 80) {
  const text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f\u2013\u2014]/g, "")
    .trim();
  if (text.length < 2 || text.length > max) return null;
  return text;
}

export async function addNodeWithRange(db, ispOrg, input, now = new Date().toISOString()) {
  const name = cleanLabel(input.name);
  const area = input.area == null || input.area === "" ? "" : cleanLabel(input.area);
  const role = input.role;
  const source = input.source || "manual";
  const cidr = parseCidr(String(input.cidr || ""));
  if (!name || area == null || !ROLES.has(role) || !SOURCES.has(source) || !cidr) {
    return { ok: false, error: "invalid_node" };
  }
  const id = input.id || crypto.randomUUID();
  await insertNode(db, {
    id,
    isp_org: ispOrg,
    name,
    area,
    role,
    source,
    external_ref: input.external_ref ? cleanLabel(input.external_ref) : null,
    status: "active",
    created_at: now,
    updated_at: now,
  });
  await insertRange(db, {
    id: crypto.randomUUID(),
    node_id: id,
    isp_org: ispOrg,
    cidr: cidr.cidr,
    source,
    external_ref: input.external_ref ? cleanLabel(input.external_ref) : null,
    created_at: now,
  });
  return { ok: true, id };
}

export async function addRangeToNode(db, ispOrg, nodeId, cidrText, source = "manual", now = new Date().toISOString()) {
  const node = await nodeById(db, ispOrg, nodeId);
  if (!node) return { ok: false, error: "not_found" };
  const cidr = parseCidr(String(cidrText || ""));
  if (!cidr || !SOURCES.has(source)) return { ok: false, error: "invalid_range" };
  const ranges = await listRanges(db, ispOrg);
  if (ranges.some((range) => range.node_id === nodeId && range.cidr === cidr.cidr)) {
    return { ok: true, deduped: true };
  }
  await insertRange(db, {
    id: crypto.randomUUID(),
    node_id: nodeId,
    isp_org: ispOrg,
    cidr: cidr.cidr,
    source,
    external_ref: null,
    created_at: now,
  });
  return { ok: true };
}

export async function confirmSuggestion(db, ispOrg, suggestionId, name, reviewer, now = new Date(), kFloor = K_MIN_DEFAULT) {
  const suggestion = await suggestionById(db, ispOrg, suggestionId);
  if (!suggestion || suggestion.status !== "suggested") return { ok: false, error: "not_suggested" };
  if (suggestion.households < resolveKMin(kFloor)) return { ok: false, error: "below_minimum" };
  const layer = suggestion.suggested_layer === "unknown" ? "access" : suggestion.suggested_layer;
  if (!ROLES.has(layer)) return { ok: false, error: "invalid_layer" };
  const label = cleanLabel(name || suggestion.suggested_name);
  if (!label) return { ok: false, error: "invalid_name" };
  const stamp = now.toISOString();
  const nodeId = crypto.randomUUID();
  await insertNode(db, {
    id: nodeId,
    isp_org: ispOrg,
    name: label,
    area: "",
    role: layer,
    source: "trace",
    external_ref: suggestion.fingerprint.slice(0, 16),
    status: "active",
    created_at: stamp,
    updated_at: stamp,
  });
  for (const cidr of suggestion.ip_ranges) {
    const parsed = parseCidr(cidr);
    if (!parsed) continue;
    await insertRange(db, {
      id: crypto.randomUUID(),
      node_id: nodeId,
      isp_org: ispOrg,
      cidr: parsed.cidr,
      source: "trace",
      external_ref: null,
      created_at: stamp,
    });
  }
  const changes = await reviewSuggestion(db, ispOrg, suggestionId, "confirmed", nodeId, label, reviewer || "preview", Math.floor(now.getTime() / 1000));
  if (!changes) return { ok: false, error: "not_suggested" };
  return { ok: true, node_id: nodeId };
}

export async function mergeSuggestion(db, ispOrg, suggestionId, targetNodeId, reviewer, now = new Date(), kFloor = K_MIN_DEFAULT) {
  const suggestion = await suggestionById(db, ispOrg, suggestionId);
  const target = await nodeById(db, ispOrg, targetNodeId);
  if (!suggestion || suggestion.status !== "suggested") return { ok: false, error: "not_suggested" };
  if (!target) return { ok: false, error: "not_found" };
  if (suggestion.households < resolveKMin(kFloor)) return { ok: false, error: "below_minimum" };
  const stamp = now.toISOString();
  for (const cidr of suggestion.ip_ranges) {
    await addRangeToNode(db, ispOrg, target.id, cidr, "trace", stamp);
  }
  const changes = await reviewSuggestion(
    db,
    ispOrg,
    suggestionId,
    "confirmed",
    target.id,
    target.name,
    reviewer || "preview",
    Math.floor(now.getTime() / 1000),
  );
  if (!changes) return { ok: false, error: "not_suggested" };
  return { ok: true, node_id: target.id };
}

export async function rejectSuggestion(db, ispOrg, suggestionId, reviewer, now = new Date()) {
  const suggestion = await suggestionById(db, ispOrg, suggestionId);
  if (!suggestion || suggestion.status !== "suggested") return { ok: false, error: "not_suggested" };
  const changes = await reviewSuggestion(
    db,
    ispOrg,
    suggestionId,
    "rejected",
    null,
    suggestion.suggested_name,
    reviewer || "preview",
    Math.floor(now.getTime() / 1000),
  );
  if (!changes) return { ok: false, error: "not_suggested" };
  return { ok: true };
}
