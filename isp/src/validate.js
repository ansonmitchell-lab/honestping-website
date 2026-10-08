import { ipv4ToInt, scopeOfIp } from "./ip.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const HOST = /^[A-Za-z0-9._-]{1,253}$/;

const ROOT_KEYS = [
  "schema", "run_id", "report", "app_version", "os", "started_at", "finished_at",
  "method", "target", "outcome", "hops", "home_summary", "integrity",
];
const REPORT_KEYS = ["report_id", "fingerprint"];
const METHOD_KEYS = ["kind", "ip_version", "max_hops", "probes_per_hop", "probe_timeout_ms", "deadline_ms", "resolve_names"];
const TARGET_KEYS = ["kind", "host", "ip", "service_id"];
const OUTCOME_KEYS = ["status", "reached", "hop_count", "app_summary_code"];
const HOP_KEYS = ["ttl", "role", "role_basis", "scope", "ip", "rtt_ms", "sent", "received", "app_ms"];
const HOME_KEYS = ["link", "wifi_signal", "nic_link_mbps", "gateway", "home_hops", "vpn_active", "pc_busy", "app_overall", "app_blame", "lan_devices"];
const GATEWAY_KEYS = ["found", "health", "typical_ms", "jitter_ms", "loss_permille"];
const INTEGRITY_KEYS = ["fingerprint_alg", "fingerprint", "signature"];
const SIGNATURE_KEYS = ["alg", "key_id", "value"];

const ROLES = new Set(["home_router", "home_lan", "first_past_router", "past_router", "destination", "unknown"]);
const SCOPES = new Set(["private", "cgnat", "public", "link_local", "none"]);

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function unknownKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && (max == null || value <= max);
}

export function validateSharedTrace(input) {
  const errors = [];
  if (!isObject(input)) return { ok: false, errors: ["trace"] };
  if (unknownKeys(input, ROOT_KEYS).length) errors.push("trace.keys");
  if (input.schema !== "honestping.shared_trace/v1") errors.push("schema");
  if (typeof input.run_id !== "string" || !UUID.test(input.run_id)) errors.push("run_id");
  checkReport(input.report, errors);
  if (typeof input.app_version !== "string" || !VERSION.test(input.app_version)) errors.push("app_version");
  if (input.os != null && (typeof input.os !== "string" || !/^[a-z0-9.-]{1,32}$/.test(input.os))) errors.push("os");
  if (typeof input.started_at !== "string" || !STAMP.test(input.started_at)) errors.push("started_at");
  if (typeof input.finished_at !== "string" || !STAMP.test(input.finished_at)) errors.push("finished_at");
  if (typeof input.started_at === "string" && typeof input.finished_at === "string" && input.finished_at < input.started_at) {
    errors.push("finished_at");
  }
  checkMethod(input.method, errors);
  checkTarget(input.target, errors);
  checkOutcome(input.outcome, input.hops, errors);
  checkHops(input.hops, errors);
  checkHome(input.home_summary, errors);
  checkIntegrity(input.integrity, errors);
  return { ok: errors.length === 0, errors, trace: input };
}

function checkReport(report, errors) {
  if (!isObject(report)) return errors.push("report");
  if (unknownKeys(report, REPORT_KEYS).length) errors.push("report.keys");
  if (typeof report.report_id !== "string" || report.report_id.length < 1 || report.report_id.length > 80) errors.push("report.report_id");
  if (typeof report.fingerprint !== "string" || !HEX64.test(report.fingerprint)) errors.push("report.fingerprint");
}

function checkMethod(method, errors) {
  if (!isObject(method)) return errors.push("method");
  if (unknownKeys(method, METHOD_KEYS).length) errors.push("method.keys");
  if (method.kind !== "tracert" && method.kind !== "icmp_ttl") errors.push("method.kind");
  if (method.ip_version !== 4) errors.push("method.ip_version");
  if (!integer(method.max_hops, 1, 64)) errors.push("method.max_hops");
  if (!integer(method.probes_per_hop, 1, 8)) errors.push("method.probes_per_hop");
  if (!integer(method.probe_timeout_ms, 1, 60000)) errors.push("method.probe_timeout_ms");
  if (!integer(method.deadline_ms, 1, 120000)) errors.push("method.deadline_ms");
  if (method.resolve_names !== false) errors.push("method.resolve_names");
}

function checkTarget(target, errors) {
  if (!isObject(target)) return errors.push("target");
  if (unknownKeys(target, TARGET_KEYS).length) errors.push("target.keys");
  if (target.kind !== "default" && target.kind !== "service") errors.push("target.kind");
  if (target.kind === "service" && (typeof target.service_id !== "string" || target.service_id.length < 1 || target.service_id.length > 64)) {
    errors.push("target.service_id");
  }
  if (target.kind === "default" && target.service_id != null) errors.push("target.service_id");
  if (typeof target.host !== "string" || !HOST.test(target.host)) errors.push("target.host");
  if (target.ip != null && ipv4ToInt(target.ip) == null) errors.push("target.ip");
  if (typeof target.ip === "string" && scopeOfIp(target.ip) !== "public") errors.push("target.ip");
}

function checkOutcome(outcome, hops, errors) {
  if (!isObject(outcome)) return errors.push("outcome");
  if (unknownKeys(outcome, OUTCOME_KEYS).length) errors.push("outcome.keys");
  if (!["completed", "deadline", "stopped", "icmp_refused", "failed"].includes(outcome.status)) errors.push("outcome.status");
  if (typeof outcome.reached !== "boolean") errors.push("outcome.reached");
  if (!integer(outcome.hop_count, 0, 64)) errors.push("outcome.hop_count");
  if (Array.isArray(hops) && outcome.hop_count !== hops.length) errors.push("outcome.hop_count");
  if (outcome.app_summary_code != null && !["clear", "slow_at_provider", "slow_further_out", "no_replies"].includes(outcome.app_summary_code)) {
    errors.push("outcome.app_summary_code");
  }
}

function checkHops(hops, errors) {
  if (!Array.isArray(hops) || hops.length < 1 || hops.length > 64) return errors.push("hops");
  const seen = new Set();
  hops.forEach((hop, index) => {
    const label = `hops.${index}`;
    if (!isObject(hop)) return errors.push(label);
    if (unknownKeys(hop, HOP_KEYS).length) errors.push(`${label}.keys`);
    if (!integer(hop.ttl, 1, 64)) errors.push(`${label}.ttl`);
    if (seen.has(hop.ttl)) errors.push(`${label}.ttl`);
    seen.add(hop.ttl);
    if (!ROLES.has(hop.role)) errors.push(`${label}.role`);
    if (hop.role_basis != null && hop.role_basis !== "gateway_match" && hop.role_basis !== "position") {
      errors.push(`${label}.role_basis`);
    }
    if (hop.role_basis != null && hop.role !== "home_router") errors.push(`${label}.role_basis`);
    if (!SCOPES.has(hop.scope)) errors.push(`${label}.scope`);
    if (hop.ip != null && ipv4ToInt(hop.ip) == null) errors.push(`${label}.ip`);
    if (!integer(hop.sent, 1, 8)) errors.push(`${label}.sent`);
    if (!integer(hop.received, 0, 8) || hop.received > hop.sent) errors.push(`${label}.received`);
    if (!Array.isArray(hop.rtt_ms) || hop.rtt_ms.length !== hop.sent) errors.push(`${label}.rtt_ms`);
    else {
      let replies = 0;
      for (const sample of hop.rtt_ms) {
        if (sample == null) continue;
        if (!integer(sample, 0, 1000000)) errors.push(`${label}.rtt_ms`);
        else replies += 1;
      }
      if (replies !== hop.received) errors.push(`${label}.received`);
    }
    if (hop.app_ms != null && !integer(hop.app_ms, 0, 1000000)) errors.push(`${label}.app_ms`);
    if ((hop.role === "home_router" || hop.role === "home_lan") && hop.scope === "public") errors.push(`${label}.scope`);
  });
}

function checkHome(home, errors) {
  if (!isObject(home)) return errors.push("home_summary");
  if (unknownKeys(home, HOME_KEYS).length) errors.push("home_summary.keys");
  if (!["wired", "wifi", "unknown"].includes(home.link)) errors.push("home_summary.link");
  if (home.wifi_signal != null && !["strong", "ok", "weak", "n/a"].includes(home.wifi_signal)) errors.push("home_summary.wifi_signal");
  if (home.nic_link_mbps != null && !integer(home.nic_link_mbps, 0, 100000)) errors.push("home_summary.nic_link_mbps");
  if (!isObject(home.gateway)) errors.push("home_summary.gateway");
  else {
    if (unknownKeys(home.gateway, GATEWAY_KEYS).length) errors.push("home_summary.gateway.keys");
    if (typeof home.gateway.found !== "boolean") errors.push("home_summary.gateway.found");
    if (!["healthy", "degraded", "offline", "unknown"].includes(home.gateway.health)) errors.push("home_summary.gateway.health");
    for (const key of ["typical_ms", "jitter_ms"]) {
      if (home.gateway[key] != null && !integer(home.gateway[key], 0, 1000000)) errors.push(`home_summary.gateway.${key}`);
    }
    if (home.gateway.loss_permille != null && !integer(home.gateway.loss_permille, 0, 1000)) errors.push("home_summary.gateway.loss_permille");
  }
  if (!integer(home.home_hops, 0, 64)) errors.push("home_summary.home_hops");
  if (typeof home.vpn_active !== "boolean") errors.push("home_summary.vpn_active");
  if (typeof home.pc_busy !== "boolean") errors.push("home_summary.pc_busy");
  if (home.app_overall != null && !["Healthy", "Degraded", "Offline", "Unknown"].includes(home.app_overall)) errors.push("home_summary.app_overall");
  if (home.app_blame != null && !["None", "Me", "Carrier", "OtherDevice", "Service", "Unclear"].includes(home.app_blame)) errors.push("home_summary.app_blame");
  if (home.lan_devices != null && !["1-5", "6-15", "16+"].includes(home.lan_devices)) errors.push("home_summary.lan_devices");
}

function checkIntegrity(integrity, errors) {
  if (!isObject(integrity)) return errors.push("integrity");
  if (unknownKeys(integrity, INTEGRITY_KEYS).length) errors.push("integrity.keys");
  if (integrity.fingerprint_alg !== "sha256:honestping-trace-v1:jcs") errors.push("integrity.fingerprint_alg");
  if (typeof integrity.fingerprint !== "string" || !HEX64.test(integrity.fingerprint)) errors.push("integrity.fingerprint");
  if (integrity.signature == null) return;
  const signature = integrity.signature;
  if (!isObject(signature) || unknownKeys(signature, SIGNATURE_KEYS).length) return errors.push("integrity.signature");
  if (signature.alg !== "ES256") errors.push("integrity.signature.alg");
  if (typeof signature.key_id !== "string" || !/^[0-9a-f]{16}$/.test(signature.key_id)) errors.push("integrity.signature.key_id");
  if (typeof signature.value !== "string" || signature.value.length < 8 || signature.value.length > 200) errors.push("integrity.signature.value");
}
