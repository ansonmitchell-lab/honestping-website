// A step counts only when the extra delay or loss is still there at every
// later hop. A spike that recovers is ICMP rate limiting, not a fault.

export const STEP_NOISE_MS = 20;
export const AMBER_MS = 100;
export const RED_MS = 300;
const PERSIST_SLACK_MS = 15;

export function minRtt(hop) {
  const samples = Array.isArray(hop.rtt_ms) ? hop.rtt_ms : [];
  const replied = samples.filter((value) => Number.isInteger(value) && value >= 0);
  if (!replied.length) return null;
  return Math.min(...replied);
}

export function addedLatency(delta, previous) {
  const floor = Math.max(STEP_NOISE_MS, Math.round(Number(previous) * 0.5));
  return delta >= floor;
}

function severity(delta) {
  if (delta >= RED_MS) return "red";
  if (delta >= AMBER_MS) return "amber";
  return "small";
}

function lossPersists(ordered, index) {
  const later = ordered.slice(index + 1);
  if (!later.length) return false;
  if (later.some((hop) => hop.sent > 0 && hop.received >= hop.sent)) return false;
  return later.every((hop) => hop.received < hop.sent);
}

export function verdictBand(segment) {
  if (segment === "home") return "home";
  if (segment === "access") return "last_mile";
  if (segment === "beyond_isp") return "beyond";
  if (segment === "aggregation" || segment === "core" || segment === "peering") return "core";
  return "clear";
}

export function segmentPhrase(segment) {
  switch (segment) {
    case "home": return "the customer router";
    case "access": return "the last mile";
    case "aggregation": return "the aggregation hop";
    case "core": return "the core";
    case "peering": return "the peering edge";
    case "beyond_isp": return "a hop beyond the provider";
    default: return "an unanswered hop";
  }
}

export function explainFault(fault, nodeName) {
  if (!fault.onset) {
    if (fault.ignored.length) {
      return "The path looks clear. A mid path spike did not continue, so it is not counted as a fault.";
    }
    return "The path looks clear. No delay or loss lasted through the rest of the path.";
  }
  const where = nodeName || segmentPhrase(fault.onset.segment);
  if (fault.onset.kind === "loss") {
    return `Packet loss starts at ${where} and continues to the end of the path.`;
  }
  if (fault.verdict === "home") {
    return "The extra delay starts at the customer router and stays through the rest of the path.";
  }
  if (fault.verdict === "last_mile") {
    return `The extra delay starts on the last mile at ${where} and stays through the rest of the path.`;
  }
  if (fault.verdict === "beyond") {
    return "The extra delay starts beyond the provider and stays through the rest of the path.";
  }
  return `Last mile looks clear. The extra delay starts at ${where} and stays through the rest of the path.`;
}

export function localizePath(hops) {
  const ordered = [...hops].sort((a, b) => a.ttl - b.ttl);
  const replied = ordered.filter((hop) => minRtt(hop) != null);
  const latency = [];
  const ignored = [];

  for (let index = 1; index < replied.length; index += 1) {
    const previous = minRtt(replied[index - 1]);
    const current = minRtt(replied[index]);
    const delta = current - previous;
    if (!addedLatency(delta, previous)) continue;
    const floor = current - Math.max(PERSIST_SLACK_MS, Math.round(delta * 0.25));
    const persists = replied.slice(index).every((hop) => minRtt(hop) >= floor);
    const hop = replied[index];
    if (persists) {
      latency.push({
        ttl: hop.ttl,
        kind: "latency",
        delta,
        severity: severity(delta),
        segment: hop.segment || "unknown",
      });
    } else {
      ignored.push({ ttl: hop.ttl, reason: "spike" });
    }
  }

  const loss = [];
  ordered.forEach((hop, index) => {
    if (!(hop.sent > 0) || hop.received >= hop.sent) return;
    if (!lossPersists(ordered, index)) {
      ignored.push({ ttl: hop.ttl, reason: "transient_loss" });
      return;
    }
    loss.push({
      ttl: hop.ttl,
      kind: "loss",
      delta: null,
      severity: "loss",
      segment: hop.segment || "unknown",
    });
  });

  const onset = [...latency, ...loss].sort((a, b) => a.ttl - b.ttl)[0] || null;
  const seen = new Map();
  for (const hop of ordered) {
    const segment = hop.segment || "unknown";
    if (!seen.has(segment)) {
      seen.set(segment, { segment, verdict: "clear", from_ttl: hop.ttl, to_ttl: hop.ttl });
    }
    const row = seen.get(segment);
    row.to_ttl = hop.ttl;
    if (!onset || hop.ttl < onset.ttl) continue;
    if (hop.ttl === onset.ttl) row.verdict = onset.kind === "loss" ? "loss" : "delay";
    else if (row.verdict === "clear") row.verdict = "downstream";
  }

  const fault = {
    onset,
    ignored,
    segments: [...seen.values()],
    verdict: onset ? verdictBand(onset.segment) : "clear",
  };
  fault.explanation = explainFault(fault);
  return fault;
}
