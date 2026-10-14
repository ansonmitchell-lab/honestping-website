import { K_MIN_DEFAULT } from "./households.js";
import { VERDICT_LABEL } from "./views/format.js";

export function exampleSupportModel(floor = K_MIN_DEFAULT) {
  return {
    claim: "Claim 1042",
    traceLabel: "Example trace 6f1c2b9e",
    kMin: floor,
    verdict: "core",
    verdictLabel: VERDICT_LABEL.core,
    explanation: "Last mile looks clear. The extra delay starts at Aggregation North and stays through the rest of the path.",
    areaLine: "12 households on Aggregation North dipped in this 7-day report window.",
    hops: [
      { label: "Router", segment: "home", msLabel: "<1 ms", suspect: false, ispPrivate: false, address: "", confirmed: false },
      { label: "Node 3B", segment: "access", msLabel: "9 ms", suspect: false, ispPrivate: true, address: "100.92.0.1", confirmed: true },
      { label: "Aggregation North", segment: "aggregation", msLabel: "118 ms", suspect: true, ispPrivate: true, address: "10.212.4.1", confirmed: true },
      { label: "No reply", segment: "unknown", msLabel: "no reply", suspect: false, ispPrivate: false, address: "", confirmed: false },
      { label: "Core West", segment: "core", msLabel: "121 ms", suspect: false, ispPrivate: false, address: "203.0.113.10", confirmed: true },
      { label: "Peering edge", segment: "peering", msLabel: "125 ms", suspect: false, ispPrivate: false, address: "198.51.100.7", confirmed: true },
      { label: "Destination", segment: "beyond_isp", msLabel: "126 ms", suspect: false, ispPrivate: false, address: "1.1.1.1", confirmed: false },
    ],
  };
}

export function exampleNetworkModel(floor = K_MIN_DEFAULT) {
  return {
    kMin: floor,
    pending: true,
    nodes: [
      {
        id: "node_3b",
        name: "Node 3B",
        area: "Area 3",
        role: "access",
        roleLabel: "Last mile",
        visible: true,
        countLabel: "14",
        evidence: "Example trace a14lastm localizes the delay or loss here.",
      },
      {
        id: "node_agg",
        name: "Aggregation North",
        area: "Area 3",
        role: "aggregation",
        roleLabel: "Aggregation",
        visible: true,
        countLabel: "12",
        evidence: "Example trace 6f1c2b9e localizes the delay or loss here.",
      },
      {
        id: "node_core",
        name: "Core West",
        area: "Area 3",
        role: "core",
        roleLabel: "Core",
        visible: false,
        countLabel: "Hidden",
        evidence: `Hidden. This 7-day report window is under ${floor} households.`,
      },
    ],
    suggestions: [
      {
        id: "sug_agg_east",
        name: "agg-east",
        layer: "aggregation",
        layerLabel: "Aggregation",
        households: 12,
        confidenceLabel: "72%",
        ranges: "192.0.2.10/32, 192.0.2.11/32",
        evidence: "12 households, name stem agrees, seen across 8 days of example traces.",
      },
      {
        id: "sug_core_south",
        name: "core-south",
        layer: "core",
        layerLabel: "Core",
        households: 11,
        confidenceLabel: "64%",
        ranges: "192.0.2.20/32",
        evidence: "11 households, seen across 8 days of example traces.",
      },
    ],
    ranges: [
      { nodeId: "node_3b", nodeName: "Node 3B", cidr: "100.92.0.0/16", source: "manual" },
      { nodeId: "node_agg", nodeName: "Aggregation North", cidr: "10.212.4.0/24", source: "manual" },
      { nodeId: "node_core", nodeName: "Core West", cidr: "203.0.113.0/24", source: "manual" },
      { nodeId: "node_peer", nodeName: "Peering edge", cidr: "198.51.100.0/24", source: "manual" },
    ],
    mergeTargets: [
      { id: "node_3b", name: "Node 3B" },
      { id: "node_agg", name: "Aggregation North" },
      { id: "node_core", name: "Core West" },
      { id: "node_peer", name: "Peering edge" },
    ],
  };
}
