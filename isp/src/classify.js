import { matchLongest } from "./ip.js";

const PTR_LAYER = [
  [/(?:^|[.\-_])(?:bng|bras|cmts|olt|dslam|access)(?:[.\-_]|$)/i, "access"],
  [/(?:^|[.\-_])(?:agg|aggr|aggregation|dist)(?:[.\-_]|$)/i, "aggregation"],
  [/(?:^|[.\-_])(?:core|backbone)(?:[.\-_]|$)/i, "core"],
  [/(?:^|[.\-_])(?:peer|peering|ixp)(?:[.\-_]|$)/i, "peering"],
];

export function layerFromPtr(ptr) {
  if (!ptr) return null;
  for (const [pattern, layer] of PTR_LAYER) {
    if (pattern.test(ptr)) return layer;
  }
  return null;
}

export function segmentForRole(role) {
  if (role === "access" || role === "aggregation" || role === "core" || role === "peering") return role;
  return "unknown";
}

function result(hop, segment, nodeId, suggestionId) {
  return {
    ...hop,
    segment,
    matched_node_id: nodeId || null,
    matched_suggestion_id: suggestionId || null,
  };
}

function silent(hop) {
  return !hop.ip && (hop.received === 0 || hop.scope === "none" || hop.redacted);
}

export function classifyHops(hops, ctx = {}) {
  const nodes = ctx.nodes || [];
  const suggestions = ctx.suggestions || [];
  const enrichment = ctx.enrichment || new Map();
  const ispAsns = ctx.ispAsns || [];
  return hops.map((hop) => classifyOne(hop, { nodes, suggestions, enrichment, ispAsns }));
}

function classifyOne(hop, ctx) {
  if (hop.role === "home_router" || hop.role === "home_lan") {
    return result(hop, "home", null, null);
  }
  if (!hop.ip && (hop.scope === "none" || hop.received === 0)) {
    return result(hop, "unknown", null, null);
  }

  if (hop.ip) {
    const node = matchLongest(hop.ip, ctx.nodes);
    if (node) return result(hop, segmentForRole(node.role), node.id, null);
    const suggestion = matchLongest(hop.ip, ctx.suggestions);
    if (suggestion) {
      return result(hop, segmentForRole(suggestion.role || suggestion.suggested_layer), null, suggestion.id);
    }
  }

  const info = hop.ip ? ctx.enrichment.get(hop.ip) : null;
  const asn = info && info.asn != null ? Number(info.asn) : null;
  const inIsp = asn != null && ctx.ispAsns.includes(asn);
  const outside = asn != null && !inIsp;
  if (info && info.ixp_id != null && (inIsp || ctx.ispAsns.length === 0)) {
    return result(hop, "peering", null, null);
  }
  if (outside) return result(hop, "beyond_isp", null, null);

  const ptrLayer = layerFromPtr(info && info.ptr);
  if (ptrLayer && (inIsp || ctx.ispAsns.length === 0)) return result(hop, ptrLayer, null, null);

  if (hop.role === "destination" && !inIsp) return result(hop, "beyond_isp", null, null);
  if (hop.role === "first_past_router") return result(hop, "access", null, null);
  if (hop.isp_private || hop.scope === "private" || hop.scope === "cgnat") {
    return result(hop, "aggregation", null, null);
  }
  if (inIsp) return result(hop, "core", null, null);
  if (silent(hop)) return result(hop, "unknown", null, null);
  if (hop.role === "past_router") return result(hop, "core", null, null);
  return result(hop, "unknown", null, null);
}

export function inferIspAsns(hops, enrichment) {
  const counts = new Map();
  for (const hop of hops) {
    if (!hop.ip || hop.role === "destination" || hop.role === "home_router" || hop.role === "home_lan") continue;
    const info = enrichment.get(hop.ip);
    if (!info || info.asn == null) continue;
    const asn = Number(info.asn);
    counts.set(asn, (counts.get(asn) || 0) + 1);
  }
  if (!counts.size) return [];
  const top = Math.max(...counts.values());
  return [...counts.entries()].filter(([, count]) => count === top).map(([asn]) => asn);
}
