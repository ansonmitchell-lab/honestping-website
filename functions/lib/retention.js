import { sha256Hex } from "./digest.js";

export const FEEDBACK_RETENTION_CRON = "15 3 * * *";
export const CRASH_BODY_DAYS = 90;
export const REPORT_BODY_MONTHS = 12;
const BATCH = 100;
const MAX_BATCHES = 20;

export function crashBodyCutoff(now) {
  return new Date(now.getTime() - CRASH_BODY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function reportBodyCutoff(now) {
  const next = new Date(now.getTime());
  next.setUTCMonth(next.getUTCMonth() - REPORT_BODY_MONTHS);
  return next.toISOString();
}

function logEvent(fields) {
  console.log(JSON.stringify({ service: "honestping-web", ...fields }));
}

async function emptyFramesHash() {
  return sha256Hex("");
}

function exceptionType(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, 120) : "unknown";
}

async function framesHash(value, fallback) {
  if (typeof value === "string" && /^[0-9a-f]{64}$/.test(value)) return value;
  return fallback;
}

async function deleteShot(env, key) {
  if (!key) return true;
  if (!env.SCREENSHOTS || typeof env.SCREENSHOTS.delete !== "function") return false;
  await env.SCREENSHOTS.delete(key);
  return true;
}

const UPSERT = `
  INSERT INTO crash_signatures (
    exception_type, frames_hash, source, issue_type, count, first_seen, last_seen
  ) VALUES (?, ?, ?, ?, 1, ?, ?)
  ON CONFLICT (exception_type, frames_hash, source, issue_type)
  DO UPDATE SET
    count = count + 1,
    first_seen = min(first_seen, excluded.first_seen),
    last_seen = max(last_seen, excluded.last_seen)
`;

async function reduceCrashes(env, cutoff, fallbackHash) {
  let reduced = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const result = await env.DB.prepare(`
      SELECT id, source, issue_type, exception_type, frames_hash, screenshot_key, created_at
      FROM feedback
      WHERE kind = 'crash' AND created_at < ?
      ORDER BY created_at
      LIMIT ${BATCH}
    `).bind(cutoff).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    if (!rows.length) break;
    let progressed = 0;
    for (const row of rows) {
      const shotGone = await deleteShot(env, row.screenshot_key);
      if (!shotGone) {
        logEvent({ event: "feedback_retention_screenshot_skipped", kind: "crash" });
        continue;
      }
      const issueType = typeof row.issue_type === "string" ? row.issue_type : "";
      await env.DB.batch([
        env.DB.prepare(UPSERT).bind(
          exceptionType(row.exception_type),
          await framesHash(row.frames_hash, fallbackHash),
          row.source,
          issueType,
          row.created_at,
          row.created_at,
        ),
        env.DB.prepare("DELETE FROM feedback WHERE id = ?").bind(row.id),
      ]);
      reduced += 1;
      progressed += 1;
    }
    if (!progressed) break;
  }
  return reduced;
}

async function deleteReports(env, cutoff) {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const result = await env.DB.prepare(`
      SELECT id, screenshot_key
      FROM feedback
      WHERE kind IN ('bug', 'feature') AND created_at < ?
      ORDER BY created_at
      LIMIT ${BATCH}
    `).bind(cutoff).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    if (!rows.length) break;
    let progressed = 0;
    for (const row of rows) {
      const shotGone = await deleteShot(env, row.screenshot_key);
      if (!shotGone) {
        logEvent({ event: "feedback_retention_screenshot_skipped", kind: "report" });
        continue;
      }
      await env.DB.prepare("DELETE FROM feedback WHERE id = ?").bind(row.id).run();
      deleted += 1;
      progressed += 1;
    }
    if (!progressed) break;
  }
  return deleted;
}

export async function retainFeedback(env, now = new Date()) {
  if (!env || !env.DB) {
    logEvent({ event: "feedback_retention_unconfigured" });
    return { crashesReduced: 0, reportsDeleted: 0 };
  }
  const fallbackHash = await emptyFramesHash();
  const crashesReduced = await reduceCrashes(env, crashBodyCutoff(now), fallbackHash);
  const reportsDeleted = await deleteReports(env, reportBodyCutoff(now));
  logEvent({ event: "feedback_retained", crashes: crashesReduced, reports: reportsDeleted });
  return { crashesReduced, reportsDeleted };
}
