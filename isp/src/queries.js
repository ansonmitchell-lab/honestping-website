import { K_MIN_DEFAULT, resolveKMin } from "./households.js";

export const SQL = {
  findRun: "SELECT run_id, isp_org, fingerprint FROM shared_traces WHERE run_id = ?",
  findReport: "SELECT fingerprint FROM shared_reports WHERE isp_org = ? AND report_id = ?",
  insertReport: `INSERT INTO shared_reports (report_id, isp_org, fingerprint, received_at)
    VALUES (?, ?, ?, ?)`,
  insertTrace: `INSERT INTO shared_traces (
      run_id, isp_org, report_id, report_fingerprint, received_at, app_version, target_class,
      started_at, finished_at, outcome_status, reached, app_summary_code, home_summary,
      household_hash, fingerprint, example, onset_ttl, onset_kind, onset_segment, suspect_node_id, verdict
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  insertHop: `INSERT INTO trace_hops (
      run_id, isp_org, ttl, role, scope, ip, redacted, isp_private, rtt_ms, sent, received, app_ms,
      matched_node_id, matched_suggestion_id, segment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  insertWarning: `INSERT INTO trace_ingest_warnings (isp_org, run_id, code, detail, created_at)
    VALUES (?, ?, ?, ?, ?)`,
  hopsForRun: `SELECT run_id, ttl, role, scope, ip, redacted, isp_private, rtt_ms, sent, received, app_ms,
      matched_node_id, matched_suggestion_id, segment
    FROM trace_hops WHERE isp_org = ? AND run_id = ? ORDER BY ttl`,
  traceForOrg: `SELECT run_id, isp_org, report_id, received_at, app_version, target_class, started_at,
      outcome_status, reached, app_summary_code, home_summary, example, onset_ttl, onset_kind,
      onset_segment, suspect_node_id, verdict
    FROM shared_traces WHERE isp_org = ? AND run_id = ?`,
  listNodes: `SELECT id, isp_org, name, area, role, source, external_ref, status
    FROM isp_nodes WHERE isp_org = ? ORDER BY name`,
  listRanges: `SELECT id, node_id, isp_org, cidr, source, external_ref
    FROM isp_node_ranges WHERE isp_org = ? ORDER BY cidr`,
  insertNode: `INSERT INTO isp_nodes (
      id, isp_org, name, area, role, source, external_ref, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  insertRange: `INSERT INTO isp_node_ranges (id, node_id, isp_org, cidr, source, external_ref, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
  nodeById: `SELECT id, isp_org, name, area, role, source, external_ref, status
    FROM isp_nodes WHERE isp_org = ? AND id = ?`,
  suggestions: `SELECT id, isp_org, fingerprint, suggested_name, suggested_layer, ip_ranges, neighbors,
      confidence, evidence, households, source, status, node_id, first_seen, last_seen
    FROM node_suggestions WHERE isp_org = ? AND status = ? AND households >= ? ORDER BY households DESC`,
  suggestionById: `SELECT id, isp_org, fingerprint, suggested_name, suggested_layer, ip_ranges, neighbors,
      confidence, evidence, households, source, status, node_id
    FROM node_suggestions WHERE isp_org = ? AND id = ?`,
  suggestionByFingerprint: `SELECT id, status FROM node_suggestions WHERE isp_org = ? AND fingerprint = ?`,
  insertSuggestion: `INSERT INTO node_suggestions (
      id, isp_org, fingerprint, suggested_name, suggested_layer, ip_ranges, neighbors, confidence,
      evidence, households, source, status, node_id, first_seen, last_seen, reviewed_by, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', NULL, ?, ?, NULL, NULL)`,
  updateSuggestion: `UPDATE node_suggestions
    SET suggested_name = ?, suggested_layer = ?, ip_ranges = ?, neighbors = ?, confidence = ?,
        evidence = ?, households = ?, last_seen = ?
    WHERE isp_org = ? AND fingerprint = ? AND status = 'suggested'`,
  reviewSuggestion: `UPDATE node_suggestions
    SET status = ?, node_id = ?, suggested_name = ?, reviewed_by = ?, reviewed_at = ?
    WHERE isp_org = ? AND id = ? AND status = 'suggested'`,
  enrichmentOne: `SELECT ip, ptr, asn, prefix, ixp_id, fetched_at
    FROM hop_enrichment WHERE isp_org = ? AND ip = ?`,
  enrichmentAll: `SELECT ip, ptr, asn, prefix, ixp_id, fetched_at
    FROM hop_enrichment WHERE isp_org = ?`,
  upsertEnrichment: `INSERT INTO hop_enrichment (isp_org, ip, ptr, asn, prefix, ixp_id, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(isp_org, ip) DO UPDATE SET
      ptr = excluded.ptr, asn = excluded.asn, prefix = excluded.prefix,
      ixp_id = excluded.ixp_id, fetched_at = excluded.fetched_at`,
  listRuns: `SELECT run_id, household_hash, started_at, received_at, suspect_node_id, verdict, example
    FROM shared_traces WHERE isp_org = ? ORDER BY received_at DESC`,
  runHops: `SELECT h.run_id, h.ttl, h.ip, h.role, h.scope, h.segment, h.isp_private, t.household_hash, t.started_at
    FROM trace_hops h
    JOIN shared_traces t ON t.run_id = h.run_id AND t.isp_org = h.isp_org
    WHERE h.isp_org = ? AND h.run_id = ? ORDER BY h.ttl`,
  suspectHouseholds: `SELECT household_hash, suspect_node_id, example
    FROM shared_traces
    WHERE isp_org = ? AND received_at >= ? AND suspect_node_id IS NOT NULL`,
  recentSuspect: `SELECT run_id, suspect_node_id, onset_segment, verdict, received_at
    FROM shared_traces
    WHERE isp_org = ? AND suspect_node_id = ? ORDER BY received_at DESC LIMIT 1`,
  ownerCounts: "SELECT COUNT(*) AS traces, COUNT(DISTINCT isp_org) AS orgs FROM shared_traces",
  orgs: "SELECT DISTINCT isp_org FROM shared_traces",
  publicIps: `SELECT DISTINCT ip FROM trace_hops
    WHERE isp_org = ? AND ip IS NOT NULL AND isp_private = 0 AND redacted = 0`,
  flagUnseen: `UPDATE isp_nodes SET status = 'unseen', updated_at = ?
    WHERE isp_org = ? AND status = 'active' AND source = 'trace'
      AND id NOT IN (
        SELECT h.matched_node_id FROM trace_hops h
        JOIN shared_traces t ON t.run_id = h.run_id AND t.isp_org = h.isp_org
        WHERE h.isp_org = ? AND h.matched_node_id IS NOT NULL AND t.received_at >= ?
      )`,
  warningsForRun: `SELECT code, detail FROM trace_ingest_warnings WHERE isp_org = ? AND run_id = ? ORDER BY id`,
  rejectedFingerprints: "SELECT fingerprint FROM node_suggestions WHERE isp_org = ? AND status = 'rejected'",
};

function rows(result) {
  return result && result.results ? result.results : [];
}

export async function findRun(db, runId) {
  return db.prepare(SQL.findRun).bind(runId).first();
}

export async function findReport(db, ispOrg, reportId) {
  return db.prepare(SQL.findReport).bind(ispOrg, reportId).first();
}

export async function hopsForRun(db, ispOrg, runId) {
  requireOrg(ispOrg);
  requireRun(runId);
  const result = await db.prepare(SQL.hopsForRun).bind(ispOrg, runId).all();
  return rows(result).map(decodeHop);
}

export async function traceForOrg(db, ispOrg, runId) {
  requireOrg(ispOrg);
  requireRun(runId);
  const row = await db.prepare(SQL.traceForOrg).bind(ispOrg, runId).first();
  if (!row) return null;
  return { ...row, home_summary: parseJson(row.home_summary, {}), reached: Boolean(row.reached), example: Boolean(row.example) };
}

export async function listNodes(db, ispOrg) {
  requireOrg(ispOrg);
  const result = await db.prepare(SQL.listNodes).bind(ispOrg).all();
  return rows(result);
}

export async function listRanges(db, ispOrg) {
  requireOrg(ispOrg);
  const result = await db.prepare(SQL.listRanges).bind(ispOrg).all();
  return rows(result);
}

export async function nodeById(db, ispOrg, nodeId) {
  requireOrg(ispOrg);
  return db.prepare(SQL.nodeById).bind(ispOrg, nodeId).first();
}

export async function listSuggestions(db, ispOrg, status = "suggested", minHouseholds = K_MIN_DEFAULT) {
  requireOrg(ispOrg);
  const floor = resolveKMin(minHouseholds);
  const result = await db.prepare(SQL.suggestions).bind(ispOrg, status, floor).all();
  return rows(result).map(decodeSuggestion);
}

export async function suggestionById(db, ispOrg, id) {
  requireOrg(ispOrg);
  const row = await db.prepare(SQL.suggestionById).bind(ispOrg, id).first();
  return row ? decodeSuggestion(row) : null;
}

export async function enrichmentFor(db, ispOrg, ip) {
  requireOrg(ispOrg);
  return db.prepare(SQL.enrichmentOne).bind(ispOrg, ip).first();
}

export async function enrichmentMap(db, ispOrg) {
  requireOrg(ispOrg);
  const result = await db.prepare(SQL.enrichmentAll).bind(ispOrg).all();
  const map = new Map();
  for (const row of rows(result)) map.set(row.ip, row);
  return map;
}

export async function listRuns(db, ispOrg) {
  requireOrg(ispOrg);
  const result = await db.prepare(SQL.listRuns).bind(ispOrg).all();
  return rows(result);
}

export async function suspectHouseholds(db, ispOrg, sinceIso) {
  requireOrg(ispOrg);
  const result = await db.prepare(SQL.suspectHouseholds).bind(ispOrg, sinceIso).all();
  return rows(result);
}

export async function recentSuspect(db, ispOrg, nodeId) {
  requireOrg(ispOrg);
  return db.prepare(SQL.recentSuspect).bind(ispOrg, nodeId).first();
}

export async function warningsForRun(db, ispOrg, runId) {
  requireOrg(ispOrg);
  requireRun(runId);
  const result = await db.prepare(SQL.warningsForRun).bind(ispOrg, runId).all();
  return rows(result);
}

export async function ownerTraceCounts(db) {
  const row = await db.prepare(SQL.ownerCounts).first();
  return {
    traces: Number(row && row.traces) || 0,
    orgs: Number(row && row.orgs) || 0,
  };
}

export async function storeTrace(db, trace, hopRows, warnings) {
  const statements = [
    db.prepare(SQL.insertTrace).bind(
      trace.run_id,
      trace.isp_org,
      trace.report_id,
      trace.report_fingerprint,
      trace.received_at,
      trace.app_version,
      trace.target_class,
      trace.started_at,
      trace.finished_at,
      trace.outcome_status,
      trace.reached ? 1 : 0,
      trace.app_summary_code,
      trace.home_summary,
      trace.household_hash,
      trace.fingerprint,
      trace.example ? 1 : 0,
      trace.onset_ttl,
      trace.onset_kind,
      trace.onset_segment,
      trace.suspect_node_id,
      trace.verdict,
    ),
  ];
  for (const hop of hopRows) {
    statements.push(db.prepare(SQL.insertHop).bind(
      hop.run_id,
      hop.isp_org,
      hop.ttl,
      hop.role,
      hop.scope,
      hop.ip,
      hop.redacted ? 1 : 0,
      hop.isp_private ? 1 : 0,
      JSON.stringify(hop.rtt_ms),
      hop.sent,
      hop.received,
      hop.app_ms,
      hop.matched_node_id,
      hop.matched_suggestion_id,
      hop.segment,
    ));
  }
  for (const warning of warnings) {
    statements.push(db.prepare(SQL.insertWarning).bind(
      trace.isp_org,
      trace.run_id,
      warning.code,
      warning.detail,
      trace.received_at,
    ));
  }
  await db.batch(statements);
}

export async function insertNode(db, node) {
  await db.prepare(SQL.insertNode).bind(
    node.id,
    node.isp_org,
    node.name,
    node.area || "",
    node.role,
    node.source,
    node.external_ref || null,
    node.status || "active",
    node.created_at,
    node.updated_at,
  ).run();
}

export async function insertRange(db, range) {
  await db.prepare(SQL.insertRange).bind(
    range.id,
    range.node_id,
    range.isp_org,
    range.cidr,
    range.source,
    range.external_ref || null,
    range.created_at,
  ).run();
}

export async function saveSuggestion(db, row) {
  const existing = await db.prepare(SQL.suggestionByFingerprint).bind(row.isp_org, row.fingerprint).first();
  if (existing && existing.status !== "suggested") return { skipped: true, status: existing.status };
  if (!existing) {
    await db.prepare(SQL.insertSuggestion).bind(
      row.id,
      row.isp_org,
      row.fingerprint,
      row.suggested_name,
      row.suggested_layer,
      JSON.stringify(row.ip_ranges || []),
      JSON.stringify(row.neighbors || []),
      row.confidence,
      JSON.stringify(row.evidence || {}),
      row.households,
      row.source,
      row.first_seen,
      row.last_seen,
    ).run();
    return { skipped: false, created: true };
  }
  await db.prepare(SQL.updateSuggestion).bind(
    row.suggested_name,
    row.suggested_layer,
    JSON.stringify(row.ip_ranges || []),
    JSON.stringify(row.neighbors || []),
    row.confidence,
    JSON.stringify(row.evidence || {}),
    row.households,
    row.last_seen,
    row.isp_org,
    row.fingerprint,
  ).run();
  return { skipped: false, created: false };
}

export async function reviewSuggestion(db, ispOrg, id, status, nodeId, name, reviewer, reviewedAt) {
  const result = await db.prepare(SQL.reviewSuggestion).bind(
    status,
    nodeId,
    name,
    reviewer,
    reviewedAt,
    ispOrg,
    id,
  ).run();
  return Number(result.meta && result.meta.changes) || 0;
}

export async function upsertEnrichment(db, row) {
  await db.prepare(SQL.upsertEnrichment).bind(
    row.isp_org,
    row.ip,
    row.ptr,
    row.asn,
    row.prefix,
    row.ixp_id,
    row.fetched_at,
  ).run();
}

export async function runsWithHops(db, ispOrg) {
  requireOrg(ispOrg);
  const runs = await listRuns(db, ispOrg);
  const grouped = [];
  for (const run of runs) {
    const result = await db.prepare(SQL.runHops).bind(ispOrg, run.run_id).all();
    grouped.push({
      runId: run.run_id,
      householdHash: run.household_hash,
      startedAt: run.started_at,
      hops: rows(result),
    });
  }
  return grouped;
}

export async function publicHopIps(db, ispOrg) {
  requireOrg(ispOrg);
  const result = await db.prepare(SQL.publicIps).bind(ispOrg).all();
  return rows(result).map((row) => row.ip);
}

export async function listOrgIds(db) {
  const result = await db.prepare(SQL.orgs).all();
  return rows(result).map((row) => row.isp_org);
}

export async function rejectedFingerprints(db, ispOrg) {
  requireOrg(ispOrg);
  const result = await db.prepare(SQL.rejectedFingerprints).bind(ispOrg).all();
  return rows(result).map((row) => row.fingerprint);
}

export async function flagUnseenNodes(db, ispOrg, updatedAt, cutoffIso) {
  requireOrg(ispOrg);
  await db.prepare(SQL.flagUnseen).bind(updatedAt, ispOrg, ispOrg, cutoffIso).run();
}

export async function nodesWithRanges(db, ispOrg) {
  const nodes = await listNodes(db, ispOrg);
  const ranges = await listRanges(db, ispOrg);
  return nodes.map((node) => ({
    ...node,
    cidrs: ranges.filter((range) => range.node_id === node.id).map((range) => range.cidr),
  }));
}

function requireOrg(ispOrg) {
  if (!ispOrg || typeof ispOrg !== "string") throw new Error("isp_org required");
}

function requireRun(runId) {
  if (!runId || typeof runId !== "string") throw new Error("run_id required");
}

function parseJson(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function decodeHop(row) {
  return {
    ...row,
    rtt_ms: parseJson(row.rtt_ms, []),
    redacted: Boolean(row.redacted),
    isp_private: Boolean(row.isp_private),
    app_ms: row.app_ms == null ? null : Number(row.app_ms),
  };
}

function decodeSuggestion(row) {
  return {
    ...row,
    ip_ranges: parseJson(row.ip_ranges, []),
    neighbors: parseJson(row.neighbors, []),
    evidence: parseJson(row.evidence, {}),
    confidence: Number(row.confidence),
    households: Number(row.households),
  };
}
