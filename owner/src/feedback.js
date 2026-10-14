import { FEEDBACK_STATUSES, KINDS, SOURCES, issueLabel } from "../../functions/lib/feedback-contract.js";
import { isoDaysAgo, missingTable } from "./queries.js";

export { FEEDBACK_STATUSES, KINDS, SOURCES, issueLabel };

export const LIST_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "and", "or", "for", "in", "on", "is", "it",
  "my", "this", "that", "with", "was", "were", "be", "from", "at", "by",
]);

const LIST_COLUMNS = "id, source, kind, issue_type, title, status, auto_sent, page_context, created_at";

function statement(db, sql, args = []) {
  const prepared = db.prepare(sql);
  return args.length ? prepared.bind(...args) : prepared;
}

async function all(db, sql, args) {
  const result = await statement(db, sql, args).all();
  return result && Array.isArray(result.results) ? result.results : [];
}

async function first(db, sql, args) {
  return statement(db, sql, args).first();
}

export function parseFeedbackId(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,14}$/.test(value)) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id)) return null;
  return id;
}

export function parseFeedbackStatus(value) {
  return FEEDBACK_STATUSES.includes(value) ? value : null;
}

export function parseFilters(url) {
  const source = url.searchParams.get("source") || "";
  const kind = url.searchParams.get("kind") || "";
  const status = url.searchParams.get("status") || "";
  return {
    source: SOURCES.includes(source) ? source : "",
    kind: KINDS.includes(kind) ? kind : "",
    status: FEEDBACK_STATUSES.includes(status) ? status : "",
  };
}

function whereClause(filters) {
  const parts = [];
  const args = [];
  if (filters.source) {
    parts.push("source = ?");
    args.push(filters.source);
  }
  if (filters.kind) {
    parts.push("kind = ?");
    args.push(filters.kind);
  }
  if (filters.status) {
    parts.push("status = ?");
    args.push(filters.status);
  }
  return { clause: parts.join(" AND "), args };
}

export function utcDays(now, count) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    days.push(new Date(start - i * DAY_MS).toISOString().slice(0, 10));
  }
  return days;
}

export function titleTokens(title) {
  const tokens = String(title || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

export function titlesClose(leftTitle, rightTitle) {
  const left = titleTokens(leftTitle);
  const right = new Set(titleTokens(rightTitle));
  if (left.length === 0 || right.size === 0) return false;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  if (shared < 2) return false;
  const union = left.length + right.size - shared;
  return shared / union >= 0.5;
}

export function duplicateHints(rows) {
  const hints = new Map();
  const groups = new Map();
  for (const row of rows) {
    const key = row.issue_type || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        if (!titlesClose(group[i].title, group[j].title)) continue;
        const left = Number(group[i].id);
        const right = Number(group[j].id);
        if (!hints.has(left)) hints.set(left, []);
        if (!hints.has(right)) hints.set(right, []);
        hints.get(left).push(right);
        hints.get(right).push(left);
      }
    }
  }
  for (const [id, matches] of hints) {
    hints.set(id, [...new Set(matches)].sort((a, b) => a - b).slice(0, 5));
  }
  return hints;
}

export function attachDuplicates(rows) {
  const hints = duplicateHints(rows);
  return rows.map((row) => ({
    ...row,
    similar: hints.get(Number(row.id)) || [],
  }));
}

export function buildGroups(dailyRows, now) {
  const days = utcDays(now, 30);
  const recent = new Set(days.slice(-7));
  const byType = new Map();
  for (const row of dailyRows || []) {
    const key = row && row.issue_type ? String(row.issue_type) : "";
    if (!byType.has(key)) {
      byType.set(key, {
        issueType: key,
        label: issueLabel(key),
        days7: 0,
        days30: 0,
        app: 0,
        isp: 0,
        byDay: new Map(),
      });
    }
    const group = byType.get(key);
    const count = Number(row.count) || 0;
    const day = String(row.day || "");
    group.days30 += count;
    if (recent.has(day)) group.days7 += count;
    if (row.source === "app") group.app += count;
    else if (row.source === "isp") group.isp += count;
    group.byDay.set(day, (group.byDay.get(day) || 0) + count);
  }
  return [...byType.values()]
    .map((group) => ({
      issueType: group.issueType,
      label: group.label,
      days7: group.days7,
      days30: group.days30,
      app: group.app,
      isp: group.isp,
      spark: days.map((day) => group.byDay.get(day) || 0),
    }))
    .sort((a, b) => b.days7 - a.days7 || b.days30 - a.days30 || a.label.localeCompare(b.label));
}

export async function feedbackTotals(db) {
  try {
    const row = await first(db, `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN kind = 'feature' THEN 1 ELSE 0 END) AS features,
        SUM(CASE WHEN kind = 'bug' THEN 1 ELSE 0 END) AS bugs,
        SUM(CASE WHEN kind = 'crash' THEN 1 ELSE 0 END) AS crashes
      FROM feedback
    `);
    return {
      ready: true,
      total: Number(row && row.total) || 0,
      features: Number(row && row.features) || 0,
      bugs: Number(row && row.bugs) || 0,
      crashes: Number(row && row.crashes) || 0,
    };
  } catch (error) {
    if (missingTable(error, "feedback")) {
      return { ready: false, total: 0, features: 0, bugs: 0, crashes: 0 };
    }
    throw error;
  }
}

export async function feedbackDaily(db, since, filters) {
  const { clause, args } = whereClause(filters);
  return all(db, `
    SELECT COALESCE(issue_type, '') AS issue_type,
           substr(created_at, 1, 10) AS day,
           source,
           COUNT(*) AS count
    FROM feedback
    WHERE created_at >= ?${clause ? ` AND ${clause}` : ""}
    GROUP BY issue_type, day, source
  `, [since, ...args]);
}

export async function feedbackRows(db, filters) {
  const { clause, args } = whereClause(filters);
  return all(db, `
    SELECT ${LIST_COLUMNS}
    FROM feedback
    ${clause ? `WHERE ${clause}` : ""}
    ORDER BY created_at DESC
    LIMIT ${LIST_LIMIT}
  `, args);
}

export async function feedbackById(db, id) {
  return first(db, `
    SELECT id, source, kind, issue_type, title, description, expected_behavior,
           page_context, app_version, os, screenshot_key, diagnostics,
           auto_sent, exception_type, status, created_at
    FROM feedback
    WHERE id = ?
  `, [id]);
}

export async function titlesForIssue(db, issueType, exceptId) {
  if (issueType) {
    return all(db, `
      SELECT id, title
      FROM feedback
      WHERE issue_type = ? AND id != ?
      ORDER BY created_at DESC
      LIMIT 300
    `, [issueType, exceptId]);
  }
  return all(db, `
    SELECT id, title
    FROM feedback
    WHERE issue_type IS NULL AND id != ?
    ORDER BY created_at DESC
    LIMIT 300
  `, [exceptId]);
}

export async function crashSignatures(db) {
  try {
    return await all(db, `
      SELECT exception_type, count, first_seen, last_seen
      FROM crash_signatures
      ORDER BY count DESC, last_seen DESC
      LIMIT 50
    `);
  } catch (error) {
    if (missingTable(error, "crash_signatures")) return [];
    throw error;
  }
}

export async function loadRequestList(db, filters, now) {
  const since = isoDaysAgo(now, 30);
  const [daily, rows, signatures] = await Promise.all([
    feedbackDaily(db, since, filters),
    feedbackRows(db, filters),
    crashSignatures(db),
  ]);
  return {
    ready: true,
    mode: "list",
    filters,
    groups: buildGroups(daily, now),
    rows: attachDuplicates(rows),
    signatures,
  };
}

export function parseStoredDiagnostics(value) {
  if (typeof value !== "string" || !value) return {};
  try {
    const data = JSON.parse(value);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data;
  } catch {
    return {};
  }
}

export async function loadRequestDetail(db, id) {
  const row = await feedbackById(db, id);
  if (!row) return { ready: true, mode: "detail", missing: true };
  const others = await titlesForIssue(db, row.issue_type, row.id);
  const similar = others
    .filter((other) => titlesClose(row.title, other.title))
    .slice(0, 5)
    .map((other) => ({ id: Number(other.id), title: other.title }));
  return {
    ready: true,
    mode: "detail",
    missing: false,
    detail: {
      ...row,
      diagnostics: parseStoredDiagnostics(row.diagnostics),
      similar,
    },
  };
}

export async function saveFeedbackStatus(db, id, status) {
  const current = await first(db, "SELECT status FROM feedback WHERE id = ?", [id]);
  if (!current) return { ok: false, reason: "missing" };
  if (current.status === status) return { ok: true, changed: false };
  await statement(db, "UPDATE feedback SET status = ? WHERE id = ?", [status, id]).run();
  return { ok: true, changed: true };
}

export const REQUEST_LIST_COLUMNS = LIST_COLUMNS;
