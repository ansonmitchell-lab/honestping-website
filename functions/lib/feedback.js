import { sha256Hex } from "./digest.js";
import {
  KINDS,
  LIMITS,
  SOURCES,
  issueTypesFor,
} from "./feedback-contract.js";
import { feedbackLimitKey, takeLimit, utcDayKey } from "./rate-limit.js";
import { isStrippedField, redactText } from "./redact.js";

const DIAG_KEYS = ["app_version", "os", "log_excerpt", "screen", "exception_type", "top_frames"];
const DIAG_MAX = {
  app_version: LIMITS.appVersion,
  os: LIMITS.os,
  screen: LIMITS.screen,
  log_excerpt: LIMITS.logExcerpt,
  exception_type: 120,
  top_frames: 8000,
};

const INSERT_SQL = `
  INSERT INTO feedback (
    source, kind, issue_type, title, description, expected_behavior,
    page_context, app_version, os, screenshot_key,
    diagnostics, auto_sent, exception_type, frames_hash, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
`;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function logEvent(fields) {
  console.log(JSON.stringify({ service: "honestping-web", ...fields }));
}

function json(status, body, extra) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...CORS,
  });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function fail(status, error, extra) {
  return json(status, { error }, extra);
}

function missingTable(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("no such table");
}

function imageType(bytes) {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

const SHOT_ERROR = "Screenshot must be a PNG or JPEG of 1.5 MB or less.";

export function decodeScreenshot(value) {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: SHOT_ERROR };
  let text = value.trim();
  const dataUrl = /^data:image\/(?:png|jpeg);base64,/i.exec(text);
  if (dataUrl) text = text.slice(dataUrl[0].length);
  text = text.replace(/\s/g, "");
  if (!text) return { ok: true, value: null };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) {
    return { ok: false, error: SHOT_ERROR };
  }
  const estimated = Math.floor(text.length / 4) * 3 - (text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0);
  if (estimated > LIMITS.screenshotBytes) return { ok: false, error: SHOT_ERROR };
  let binary;
  try {
    binary = atob(text);
  } catch {
    return { ok: false, error: SHOT_ERROR };
  }
  if (binary.length > LIMITS.screenshotBytes) return { ok: false, error: SHOT_ERROR };
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const type = imageType(bytes);
  if (!type) return { ok: false, error: SHOT_ERROR };
  return { ok: true, value: { bytes, type } };
}

function oneLine(value, max, label, required) {
  if (typeof value !== "string") {
    if (!required && (value == null || value === "")) return { ok: true, value: null };
    return { ok: false, error: required ? `${label} is required.` : `${label} must be text.` };
  }
  const clean = value.replace(/\u0000/g, "").replace(/[\r\n]/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!clean) {
    if (required) return { ok: false, error: `${label} is required.` };
    return { ok: true, value: null };
  }
  const redacted = redactText(clean);
  if (redacted.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  return { ok: true, value: redacted };
}

function block(value, max, label) {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${label} must be text.` };
  const clean = value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (!clean) return { ok: true, value: null };
  const redacted = redactText(clean);
  if (redacted.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  return { ok: true, value: redacted };
}

function withoutStrippedFields(value) {
  const kept = {};
  for (const [key, item] of Object.entries(value)) {
    if (isStrippedField(key)) continue;
    kept[key] = item;
  }
  return kept;
}

function framesFrom(value) {
  if (value == null || value === "") return { ok: true, value: "" };
  if (typeof value === "string") return { ok: true, value };
  if (!Array.isArray(value)) return { ok: false, error: "Top frames must be text." };
  if (value.length > 40) return { ok: false, error: "Top frames must be 40 lines or fewer." };
  if (!value.every((line) => typeof line === "string")) return { ok: false, error: "Top frames must be text." };
  return { ok: true, value: value.join("\n") };
}

function parseDiagnostics(value) {
  if (value == null) return { ok: true, value: null, fields: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Diagnostics must be an object." };
  }
  const source = withoutStrippedFields(value);
  for (const key of Object.keys(source)) {
    if (!DIAG_KEYS.includes(key)) {
      return { ok: false, error: "Diagnostics can only include app_version, os, log_excerpt, screen, exception_type, and top_frames." };
    }
  }
  const fields = {};
  for (const key of DIAG_KEYS) {
    if (source[key] == null || source[key] === "") continue;
    if (key === "top_frames") {
      const frames = framesFrom(source[key]);
      if (!frames.ok) return frames;
      const text = redactText(frames.value.replace(/\u0000/g, "").trim());
      if (!text) continue;
      if (text.length > DIAG_MAX.top_frames) {
        return { ok: false, error: "Diagnostics top_frames must be 8000 characters or fewer." };
      }
      fields.top_frames = text;
      continue;
    }
    if (typeof source[key] !== "string") return { ok: false, error: "Diagnostics fields must be text." };
    const text = redactText(source[key].replace(/\u0000/g, "").trim());
    if (!text) continue;
    if (text.length > DIAG_MAX[key]) {
      return { ok: false, error: `Diagnostics ${key} must be ${DIAG_MAX[key]} characters or fewer.` };
    }
    fields[key] = text;
  }
  if (Object.keys(fields).length === 0) return { ok: true, value: null, fields: {} };
  const json = JSON.stringify(fields);
  if (new TextEncoder().encode(json).length > LIMITS.diagnosticsBytes) {
    return { ok: false, error: "Diagnostics must be 64 KB or smaller." };
  }
  return { ok: true, value: json, fields };
}

export function parseFeedback(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Send a JSON object." };
  }
  const source = body.source;
  const kind = body.kind;
  if (!SOURCES.includes(source)) {
    return { ok: false, status: 400, error: "Choose a source of app or isp." };
  }
  if (!KINDS.includes(kind)) {
    return { ok: false, status: 400, error: "Choose a kind of feature, bug, or crash." };
  }
  const title = oneLine(body.title, LIMITS.title, "Title", true);
  if (!title.ok) return { ok: false, status: 400, error: title.error };
  const description = block(body.description, LIMITS.description, "Description");
  if (!description.ok) return { ok: false, status: 400, error: description.error };
  const expected = block(body.expected_behavior, LIMITS.expectedBehavior, "Expected behavior");
  if (!expected.ok) return { ok: false, status: 400, error: expected.error };
  const page = oneLine(body.page_context, LIMITS.pageContext, "Page context", false);
  if (!page.ok) return { ok: false, status: 400, error: page.error };
  const version = oneLine(body.app_version, LIMITS.appVersion, "App version", false);
  if (!version.ok) return { ok: false, status: 400, error: version.error };
  const os = oneLine(body.os, LIMITS.os, "OS", false);
  if (!os.ok) return { ok: false, status: 400, error: os.error };

  let issueType = null;
  const rawIssue = body.issue_type;
  const allowed = issueTypesFor(source);
  if (kind === "bug" || kind === "crash") {
    if (typeof rawIssue !== "string" || !rawIssue.trim()) {
      return { ok: false, status: 400, error: "Choose an issue type." };
    }
    if (!allowed.includes(rawIssue)) {
      return { ok: false, status: 400, error: "That issue type does not match this source." };
    }
    issueType = rawIssue;
  } else if (rawIssue != null && rawIssue !== "") {
    if (typeof rawIssue !== "string" || !allowed.includes(rawIssue)) {
      return { ok: false, status: 400, error: "That issue type does not match this source." };
    }
    issueType = rawIssue;
  }

  if (body.auto_sent != null && typeof body.auto_sent !== "boolean") {
    return { ok: false, status: 400, error: "auto_sent must be true or false." };
  }
  const autoSent = body.auto_sent === true;

  const diagnostics = parseDiagnostics(body.diagnostics);
  if (!diagnostics.ok) return { ok: false, status: 400, error: diagnostics.error };
  const screenshot = decodeScreenshot(body.screenshot);
  if (!screenshot.ok) return { ok: false, status: 400, error: screenshot.error };

  const rawException = body.exception_type != null && body.exception_type !== ""
    ? body.exception_type
    : diagnostics.fields.exception_type;
  const exception = oneLine(rawException, 120, "Exception type", false);
  if (!exception.ok) return { ok: false, status: 400, error: exception.error };
  const rawFrames = body.top_frames != null && body.top_frames !== ""
    ? body.top_frames
    : diagnostics.fields.top_frames;
  const frames = framesFrom(rawFrames);
  if (!frames.ok) return { ok: false, status: 400, error: frames.error };
  const frameText = frames.value ? redactText(frames.value.replace(/\u0000/g, "").trim()) : "";
  if (frameText.length > DIAG_MAX.top_frames) {
    return { ok: false, status: 400, error: "Top frames must be 8000 characters or fewer." };
  }
  if (frameText) diagnostics.fields.top_frames = frameText;
  if (exception.value) diagnostics.fields.exception_type = exception.value;
  const diagnosticJson = Object.keys(diagnostics.fields).length
    ? JSON.stringify(diagnostics.fields)
    : null;
  if (diagnosticJson && new TextEncoder().encode(diagnosticJson).length > LIMITS.diagnosticsBytes) {
    return { ok: false, status: 400, error: "Diagnostics must be 64 KB or smaller." };
  }

  return {
    ok: true,
    value: {
      source,
      kind,
      issueType,
      title: title.value,
      description: description.value,
      expectedBehavior: expected.value,
      pageContext: page.value,
      appVersion: version.value || diagnostics.fields.app_version || null,
      os: os.value || diagnostics.fields.os || null,
      diagnostics: diagnosticJson,
      autoSent,
      exceptionType: kind === "crash" ? (exception.value || diagnostics.fields.exception_type || null) : null,
      frameText: kind === "crash" ? frameText : "",
      screenshot: screenshot.value,
    },
  };
}

async function readJson(request) {
  const claimed = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(claimed) && claimed > LIMITS.bodyChars) return { error: "size" };
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) return { error: "type" };
  const text = await request.text();
  if (text.length > LIMITS.bodyChars) return { error: "size" };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: "json" };
  }
}

function extensionFor(type) {
  return type === "image/png" ? "png" : "jpg";
}

export async function handleFeedback(request, env, deps = {}) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return fail(405, "Send feedback with POST.", { allow: "POST, OPTIONS" });
  }
  const now = deps.now ? deps.now() : new Date();
  const incoming = await readJson(request);
  if (incoming.error === "size") return fail(413, "That request is too large.");
  if (incoming.error === "type") return fail(415, "Send feedback as JSON.");
  if (incoming.error === "json") return fail(400, "Send a JSON object.");
  const parsed = parseFeedback(incoming.body);
  if (!parsed.ok) return fail(parsed.status, parsed.error);
  const report = parsed.value;

  if (!env || !env.DB || typeof env.FEEDBACK_IP_SALT !== "string" || !env.FEEDBACK_IP_SALT.trim()) {
    logEvent({ event: "feedback_not_configured" });
    return fail(500, "Feedback could not be saved right now.");
  }
  if (!env.FEEDBACK_LIMITS || typeof env.FEEDBACK_LIMITS.get !== "function") {
    logEvent({ event: "feedback_not_configured" });
    return fail(500, "Feedback could not be saved right now.");
  }
  const bucket = report.kind === "crash" ? "crash" : "report";
  const limit = report.kind === "crash" ? LIMITS.crashPerDay : LIMITS.reportsPerDay;
  const limitKey = await feedbackLimitKey(request, env.FEEDBACK_IP_SALT.trim(), utcDayKey(now), bucket);
  if (!limitKey) return fail(400, "This request could not be checked.");
  let allowance;
  try {
    allowance = await takeLimit(env.FEEDBACK_LIMITS, limitKey, limit);
  } catch {
    logEvent({ event: "feedback_limit_failed" });
    return fail(500, "Feedback could not be saved right now.");
  }
  if (allowance.broken) {
    logEvent({ event: "feedback_limit_failed" });
    return fail(500, "Feedback could not be saved right now.");
  }
  if (!allowance.allowed) {
    logEvent({ event: "feedback_rate_limited", kind: report.kind });
    const message = report.kind === "crash"
      ? "Too many crash reports from this network today. Try again tomorrow."
      : "Too many requests from this network today. Try again tomorrow.";
    return fail(429, message);
  }
  const framesHash = report.kind === "crash" ? await sha256Hex(report.frameText || "") : null;

  let screenshotKey = null;
  if (report.screenshot) {
    if (!env.SCREENSHOTS || typeof env.SCREENSHOTS.put !== "function") {
      logEvent({ event: "feedback_screenshot_unbound" });
      return fail(503, "Screenshot storage is not configured. Send the report without a screenshot, or try again later.");
    }
    screenshotKey = `feedback/${crypto.randomUUID()}.${extensionFor(report.screenshot.type)}`;
    try {
      await env.SCREENSHOTS.put(screenshotKey, report.screenshot.bytes, {
        httpMetadata: { contentType: report.screenshot.type },
      });
    } catch {
      logEvent({ event: "feedback_screenshot_failed" });
      return fail(500, "The screenshot could not be saved. Try again without it, or try again later.");
    }
  }

  try {
    const result = await env.DB.prepare(INSERT_SQL).bind(
      report.source,
      report.kind,
      report.issueType,
      report.title,
      report.description,
      report.expectedBehavior,
      report.pageContext,
      report.appVersion,
      report.os,
      screenshotKey,
      report.diagnostics,
      report.autoSent ? 1 : 0,
      report.exceptionType,
      framesHash,
      now.toISOString(),
    ).run();
    const id = result && result.meta ? Number(result.meta.last_row_id) : 0;
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("missing id");
    logEvent({
      event: "feedback_saved",
      id,
      source: report.source,
      kind: report.kind,
      auto_sent: report.autoSent,
    });
    return json(200, { id, status: "new" });
  } catch (error) {
    if (screenshotKey && env.SCREENSHOTS && typeof env.SCREENSHOTS.delete === "function") {
      try {
        await env.SCREENSHOTS.delete(screenshotKey);
      } catch {
        logEvent({ event: "feedback_screenshot_cleanup_failed" });
      }
    }
    if (missingTable(error)) logEvent({ event: "feedback_table_missing" });
    else logEvent({ event: "feedback_insert_failed" });
    return fail(500, "Feedback could not be saved right now.");
  }
}

export { INSERT_SQL };
