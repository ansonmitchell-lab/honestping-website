import { hostCidr, ipInCidr, samePrefix, scopeOfIp } from "./ip.js";
import { resolveKMin, K_MIN_DEFAULT } from "./households.js";
import { layerFromPtr } from "./classify.js";
import { sha256Hex } from "./jcs.js";

const INTERFACE_LABEL = /^(?:ae|ge|xe|et|be|eth|po|lag|te|gi|fa|hu|twe|fo|vlan|bundle|mgmt|loop|se|so|pos|tu|gr|pc|sw)\d+(?:[./-]\d+)*$/i;

export function ptrStem(ptr) {
  if (!ptr || typeof ptr !== "string") return null;
  const labels = ptr.replace(/\.$/, "").toLowerCase().split(".").filter(Boolean);
  if (labels.length >= 3 && INTERFACE_LABEL.test(labels[0])) return labels.slice(1).join(".");
  return labels.join(".");
}

export function scoreConfidence({ households, spanMs, ptrAgreement, adjacencyStable }) {
  let score = Math.min(0.4, (households / 20) * 0.4);
  score += spanMs >= 7 * 86400000 ? 0.2 : 0.05;
  score += ptrAgreement >= 0.5 ? 0.2 : 0;
  score += adjacencyStable ? 0.2 : 0.05;
  return Math.round(Math.min(1, score) * 100) / 100;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function coveredByNode(ip, nodes) {
  for (const node of nodes || []) {
    for (const cidr of node.cidrs || []) {
      if (ipInCidr(ip, cidr)) return true;
    }
  }
  return false;
}

function outsideAsn(ip, enrich, ispAsns) {
  if (!ispAsns || !ispAsns.length) return false;
  const info = enrich.get(ip);
  return Boolean(info && info.asn != null && !ispAsns.includes(Number(info.asn)));
}

class UnionFind {
  constructor() {
    this.parent = new Map();
  }

  add(id) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id) {
    const parent = this.parent.get(id);
    if (parent == null || parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a, b) {
    const left = this.find(a);
    const right = this.find(b);
    if (left !== right) this.parent.set(right, left);
  }
}

// Each run stays its own hop list. Adjacency is never taken across run ids.
export async function buildSuggestions({ runs, enrichment, rejected, nodes, ispOrg, now, ispAsns = [], minHouseholds = K_MIN_DEFAULT }) {
  const floor = resolveKMin(minHouseholds);
  const enrich = enrichment || new Map();
  const rejectedSet = rejected instanceof Set ? rejected : new Set(rejected || []);
  const observations = new Map();
  const unions = new UnionFind();
  const edges = [];

  for (const run of runs || []) {
    const hops = [...(run.hops || [])]
      .filter((hop) => hop.ip && hop.role !== "home_router" && hop.role !== "home_lan")
      .filter((hop) => !coveredByNode(hop.ip, nodes))
      .sort((a, b) => a.ttl - b.ttl);
    hops.forEach((hop, depth) => {
      unions.add(hop.ip);
      if (!observations.has(hop.ip)) {
        observations.set(hop.ip, {
          ip: hop.ip,
          households: new Set(),
          depths: [],
          ptrs: new Set(),
          times: [],
          scope: scopeOfIp(hop.ip),
        });
      }
      const row = observations.get(hop.ip);
      if (run.householdHash) row.households.add(run.householdHash);
      row.depths.push(depth);
      row.times.push(Date.parse(run.startedAt || "") || now || 0);
      const info = enrich.get(hop.ip);
      if (info && info.ptr) row.ptrs.add(info.ptr);
    });
    for (let index = 1; index < hops.length; index += 1) {
      edges.push({
        from: hops[index - 1].ip,
        to: hops[index].ip,
        household: run.householdHash,
      });
    }
  }

  const byStem = new Map();
  for (const [ip, row] of observations) {
    const stems = [...row.ptrs].map(ptrStem).filter(Boolean);
    const stem = stems.length ? stems.sort()[0] : null;
    row.stem = stem;
    if (!stem) continue;
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(ip);
  }
  for (const ips of byStem.values()) {
    for (let index = 1; index < ips.length; index += 1) unions.union(ips[0], ips[index]);
  }

  // No names: a /30 or /31 seen on adjacent hops in the same run is one router.
  // Different PTR stems stay apart and are recorded as neighbors instead.
  for (const edge of edges) {
    const left = observations.get(edge.from);
    const right = observations.get(edge.to);
    if (!left || !right) continue;
    const unnamed = left.ptrs.size === 0 && right.ptrs.size === 0;
    const linked = samePrefix(edge.from, edge.to, 30) || samePrefix(edge.from, edge.to, 31);
    if (unnamed && linked) unions.union(edge.from, edge.to);
  }

  const groups = new Map();
  for (const ip of observations.keys()) {
    const root = unions.find(ip);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(ip);
  }

  const membersOf = new Map();
  for (const [root, ips] of groups) {
    for (const ip of ips) membersOf.set(ip, root);
  }

  const drafts = [];
  for (const [root, ips] of groups) {
    const sortedIps = [...ips].sort();
    const households = new Set();
    const depths = [];
    const ptrs = new Set();
    const times = [];
    let asn = null;
    let prefix = null;
    let ixp = null;
    for (const ip of sortedIps) {
      const row = observations.get(ip);
      for (const hash of row.households) households.add(hash);
      depths.push(...row.depths);
      for (const ptr of row.ptrs) ptrs.add(ptr);
      times.push(...row.times);
      const info = enrich.get(ip);
      if (info) {
        if (asn == null && info.asn != null) asn = Number(info.asn);
        if (!prefix && info.prefix) prefix = info.prefix;
        if (ixp == null && info.ixp_id != null) ixp = Number(info.ixp_id);
      }
    }
    if (households.size < floor) continue;
    if (sortedIps.every((ip) => outsideAsn(ip, enrich, ispAsns))) continue;
    const touchesOutside = edges.some((edge) => {
      const fromHere = membersOf.get(edge.from) === root;
      const toHere = membersOf.get(edge.to) === root;
      if (!fromHere && !toHere) return false;
      const otherIp = fromHere ? edge.to : edge.from;
      return outsideAsn(otherIp, enrich, ispAsns);
    });
    const stem = [...ptrs].map(ptrStem).filter(Boolean).sort()[0] || null;
    const fingerprint = await sha256Hex(`${ispOrg}|${stem || sortedIps.join(",")}`);
    if (rejectedSet.has(fingerprint)) continue;
    const upstream = new Map();
    const downstream = new Map();
    for (const edge of edges) {
      if (membersOf.get(edge.from) !== root || !edge.household) continue;
      const other = membersOf.get(edge.to);
      if (!other || other === root) continue;
      if (!downstream.has(other)) downstream.set(other, new Set());
      downstream.get(other).add(edge.household);
    }
    for (const edge of edges) {
      if (membersOf.get(edge.to) !== root || !edge.household) continue;
      const other = membersOf.get(edge.from);
      if (!other || other === root) continue;
      if (!upstream.has(other)) upstream.set(other, new Set());
      upstream.get(other).add(edge.household);
    }
    const fanIn = upstream.size;
    const neighborAsns = [];
    for (const ip of sortedIps) {
      for (const edge of edges) {
        if (edge.from !== ip && edge.to !== ip) continue;
        const otherIp = edge.from === ip ? edge.to : edge.from;
        const info = enrich.get(otherIp);
        if (info && info.asn != null) neighborAsns.push(Number(info.asn));
      }
    }
    const layer = guessLayer({
      ptrs: [...ptrs],
      depth: median(depths),
      ixp,
      fanIn,
      asn,
      neighborAsns,
      touchesOutside,
    });
    const spanMs = times.length ? Math.max(...times) - Math.min(...times) : 0;
    const stemHits = stem ? sortedIps.filter((ip) => [...observations.get(ip).ptrs].some((ptr) => ptrStem(ptr) === stem)).length : 0;
    const ptrAgreement = stem ? stemHits / sortedIps.length : 0;
    const upstreamHouseholds = [...upstream.values()].reduce((sum, set) => sum + set.size, 0);
    const topUpstream = Math.max(0, ...[...upstream.values()].map((set) => set.size));
    const adjacencyStable = upstreamHouseholds > 0 && topUpstream >= upstreamHouseholds / 2;
    const confidence = scoreConfidence({
      households: households.size,
      spanMs,
      ptrAgreement,
      adjacencyStable,
    });
    const first = Math.min(...times);
    const last = Math.max(...times);
    drafts.push({
      fingerprint,
      root,
      suggested_name: suggestName(stem, layer, sortedIps),
      suggested_layer: layer,
      ip_ranges: sortedIps.map((ip) => hostCidr(ip)).filter(Boolean),
      households: households.size,
      confidence,
      source: "trace",
      first_seen: Number.isFinite(first) ? Math.floor(first / 1000) : null,
      last_seen: Number.isFinite(last) ? Math.floor(last / 1000) : null,
      evidence: {
        households: households.size,
        median_depth: median(depths),
        ptr_samples: [...ptrs].sort().slice(0, 5),
        asn,
        prefix,
        span_days: Math.floor(spanMs / 86400000),
        example: false,
      },
      upstream,
      downstream,
    });
  }

  const byRoot = new Map(drafts.map((draft) => [draft.root, draft]));
  return drafts.map((draft) => {
    const neighbors = [];
    for (const [root, hashes] of draft.upstream) {
      const other = byRoot.get(root);
      if (!other || hashes.size < 1) continue;
      neighbors.push({ fingerprint: other.fingerprint, direction: "upstream", households: hashes.size });
    }
    for (const [root, hashes] of draft.downstream) {
      const other = byRoot.get(root);
      if (!other) continue;
      neighbors.push({ fingerprint: other.fingerprint, direction: "downstream", households: hashes.size });
    }
    return {
      fingerprint: draft.fingerprint,
      suggested_name: draft.suggested_name,
      suggested_layer: draft.suggested_layer,
      ip_ranges: draft.ip_ranges,
      neighbors,
      households: draft.households,
      confidence: draft.confidence,
      source: draft.source,
      first_seen: draft.first_seen,
      last_seen: draft.last_seen,
      evidence: draft.evidence,
    };
  });
}

function suggestName(stem, layer, ips) {
  if (stem) return stem.split(".")[0].slice(0, 80);
  const label = layer === "unknown" ? "node" : layer;
  return `${label}-${ips[0].split(".").slice(-2).join("-")}`;
}

function guessLayer({ ptrs, depth, ixp, fanIn, asn, neighborAsns, touchesOutside }) {
  for (const ptr of ptrs) {
    const layer = layerFromPtr(ptr);
    if (layer) return layer;
  }
  if (ixp != null) return "peering";
  if (touchesOutside) return "peering";
  if (asn != null && neighborAsns.some((value) => value !== asn)) return "peering";
  if (depth <= 0.5) return "access";
  if (fanIn >= 3) return "aggregation";
  return "core";
}
