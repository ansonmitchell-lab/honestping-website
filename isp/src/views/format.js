export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const SEGMENT_LABEL = {
  home: "Home",
  access: "Last mile",
  aggregation: "Aggregation",
  core: "Core",
  peering: "Peering",
  beyond_isp: "Beyond",
  unknown: "No reply",
};

export const VERDICT_LABEL = {
  clear: "Path looks clear",
  home: "Starts at home",
  last_mile: "Starts on the last mile",
  core: "Past the last mile",
  beyond: "Beyond the provider",
};

export function segmentLabel(segment) {
  return SEGMENT_LABEL[segment] || "Hop";
}

export function roleLabel(role) {
  if (role === "access") return "Last mile";
  if (role === "aggregation") return "Aggregation";
  if (role === "core") return "Core";
  if (role === "peering") return "Peering";
  return "Node";
}

export function msLabel(rtt) {
  if (!Array.isArray(rtt)) return "no reply";
  const values = rtt.filter((value) => Number.isInteger(value));
  if (!values.length) return "no reply";
  const min = Math.min(...values);
  return min === 0 ? "<1 ms" : `${min} ms`;
}

// Confirmed nodes only. A suggestion match keeps the segment word.
export function displayHop(hop, nodesById, onsetTtl) {
  const node = hop.matched_node_id ? nodesById.get(hop.matched_node_id) : null;
  let label = segmentLabel(hop.segment);
  if (hop.segment === "home") label = hop.role === "home_router" ? "Router" : "Home";
  else if (hop.segment === "unknown") label = "No reply";
  else if (hop.role === "destination") label = "Destination";
  else if (hop.segment === "beyond_isp") label = "Beyond";
  else if (node) label = node.name;
  return {
    label,
    segment: hop.segment || "unknown",
    msLabel: msLabel(hop.rtt_ms),
    suspect: onsetTtl != null && hop.ttl === onsetTtl,
    ispPrivate: Boolean(hop.isp_private) && Boolean(hop.ip),
    address: hop.ip || "",
    confirmed: Boolean(node),
  };
}
