import { classifyHops, inferIspAsns } from "./classify.js";
import { explainFault, localizePath } from "./localize.js";
import { householdHash, kMin, resolveKMin } from "./households.js";
import { traceFingerprint } from "./jcs.js";
import {
  enrichmentMap,
  findReport,
  findRun,
  listSuggestions,
  nodeById,
  nodesWithRanges,
  storeTrace,
} from "./queries.js";
import { keepIspPrivateHops, redactHops, scrubAddresses } from "./redact.js";
import { validateSharedTrace } from "./validate.js";

const HOME_KEYS = [
  "link", "wifi_signal", "nic_link_mbps", "gateway", "home_hops", "vpn_active",
  "pc_busy", "app_overall", "app_blame", "lan_devices",
];

export async function ingestSharedTrace(db, payload, options = {}) {
  // The connecting address is not read or stored. Any sender field on the
  // call is dropped here so it cannot be written with the share.
  const ispOrg = options.ispOrg;
  if (!ispOrg) return fail(400, "isp_org");
  const validated = validateSharedTrace(payload);
  if (!validated.ok) return fail(400, "invalid_trace", validated.errors);
  let fingerprint = "";
  try {
    fingerprint = await traceFingerprint(payload);
  } catch {
    return fail(400, "invalid_trace", ["fingerprint"]);
  }
  if (fingerprint !== payload.integrity.fingerprint) return fail(400, "fingerprint_mismatch");
  if (payload.home_summary.vpn_active) return fail(422, "vpn_active");

  const existing = await findRun(db, payload.run_id);
  if (existing) {
    if (existing.isp_org === ispOrg && existing.fingerprint === fingerprint) {
      return { ok: true, status: 200, deduped: true, run_id: payload.run_id, warnings: [] };
    }
    return fail(409, "run_id_conflict");
  }

  const report = await findReport(db, ispOrg, payload.report.report_id);
  const warnings = [];
  if (report && report.fingerprint !== payload.report.fingerprint) return fail(422, "report_fingerprint_mismatch");
  if (!report) warnings.push({ code: "report_not_stored", detail: "No stored 7-day report matched this share yet." });

  const keep = options.keepIspPrivate != null ? options.keepIspPrivate : keepIspPrivateHops(options.env || {});
  const redacted = redactHops(payload.hops, { keepIspPrivate: keep });
  warnings.push(...redacted.warnings.map((warning) => ({
    code: warning.code,
    detail: scrubAddresses(warning.detail),
  })));

  const confirmed = (await nodesWithRanges(db, ispOrg))
    .filter((node) => node.status !== "inactive")
    .map((node) => ({ id: node.id, role: node.role, cidrs: node.cidrs }));
  const floor = options.kMin != null ? resolveKMin(options.kMin) : kMin(options.env);
  const suggestions = (await listSuggestions(db, ispOrg, "suggested", floor)).map((row) => ({
    id: row.id,
    role: row.suggested_layer,
    cidrs: row.ip_ranges,
  }));
  const enrichment = await enrichmentMap(db, ispOrg);
  const ispAsns = Array.isArray(options.ispAsns) && options.ispAsns.length
    ? options.ispAsns
    : inferIspAsns(redacted.hops, enrichment);
  const classified = classifyHops(redacted.hops, { nodes: confirmed, suggestions, enrichment, ispAsns });
  const fault = localizePath(classified);
  const suspectHop = fault.onset ? classified.find((hop) => hop.ttl === fault.onset.ttl) : null;
  const suspectNode = suspectHop && suspectHop.matched_node_id
    ? confirmed.find((node) => node.id === suspectHop.matched_node_id)
    : null;
  const suspectRow = suspectNode ? await nodeById(db, ispOrg, suspectNode.id) : null;
  const nodeName = suspectRow ? suspectRow.name : null;
  const explanation = explainFault(fault, nodeName);
  const receivedAt = options.receivedAt || new Date().toISOString();
  const hash = await householdHash(ispOrg, options.householdSalt, payload.report.report_id);
  const home = {};
  for (const key of HOME_KEYS) {
    if (payload.home_summary[key] != null) home[key] = payload.home_summary[key];
  }

  const trace = {
    run_id: payload.run_id,
    isp_org: ispOrg,
    report_id: payload.report.report_id,
    report_fingerprint: payload.report.fingerprint,
    received_at: receivedAt,
    app_version: payload.app_version,
    target_class: payload.target.kind,
    started_at: payload.started_at,
    finished_at: payload.finished_at,
    outcome_status: payload.outcome.status,
    reached: payload.outcome.reached,
    app_summary_code: payload.outcome.app_summary_code || null,
    home_summary: JSON.stringify(home),
    household_hash: hash,
    fingerprint,
    example: Boolean(options.example),
    onset_ttl: fault.onset ? fault.onset.ttl : null,
    onset_kind: fault.onset ? fault.onset.kind : null,
    onset_segment: fault.onset ? fault.onset.segment : null,
    suspect_node_id: suspectNode ? suspectNode.id : null,
    verdict: fault.verdict,
  };
  const hopRows = classified.map((hop) => ({
    run_id: payload.run_id,
    isp_org: ispOrg,
    ttl: hop.ttl,
    role: hop.role,
    scope: hop.scope,
    ip: hop.ip,
    redacted: hop.redacted,
    isp_private: hop.isp_private,
    rtt_ms: hop.rtt_ms,
    sent: hop.sent,
    received: hop.received,
    app_ms: hop.app_ms == null ? null : hop.app_ms,
    matched_node_id: hop.matched_node_id,
    matched_suggestion_id: hop.matched_suggestion_id,
    segment: hop.segment,
  }));
  await storeTrace(db, trace, hopRows, warnings);
  const log = options.log || defaultLog;
  for (const warning of warnings) {
    log({
      service: "honestping-isp-preview",
      event: "validation_warning",
      isp_org: ispOrg,
      run_id: payload.run_id,
      code: warning.code,
      detail: warning.detail,
    });
  }
  return {
    ok: true,
    status: 201,
    deduped: false,
    run_id: payload.run_id,
    warnings,
    verdict: fault.verdict,
    explanation,
    suspect_node_id: trace.suspect_node_id,
  };
}

function defaultLog(entry) {
  console.log(JSON.stringify(entry));
}

function fail(status, error, details) {
  return { ok: false, status, error, details: details || [] };
}
