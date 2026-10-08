const MAX_BODY = 256 * 1024;

export function bearer(request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  return match ? match[1] : "";
}

export function previewOrg(request, env) {
  if (!env || env.ALLOW_ISP_PREVIEW !== "1") return null;
  const token = bearer(request);
  if (env.ISP_ORG_TOKENS) {
    try {
      const map = JSON.parse(env.ISP_ORG_TOKENS);
      if (!token || typeof map[token] !== "string" || !map[token]) return null;
      return map[token];
    } catch {
      return null;
    }
  }
  if (env.ISP_INGEST_TOKEN) {
    if (token !== env.ISP_INGEST_TOKEN) return null;
    return env.ISP_PREVIEW_ORG || "example-isp";
  }
  if (env.ISP_PREVIEW_OPEN === "1") return env.ISP_PREVIEW_ORG || "example-isp";
  return null;
}

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readLimited(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) return { ok: false, error: "too_large" };
  const text = await request.text();
  if (text.length > MAX_BODY) return { ok: false, error: "too_large" };
  return { ok: true, text };
}

export function readForm(contentType, text) {
  const type = contentType || "";
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  if (type.includes("multipart/form-data")) {
    const boundary = /boundary=([^;]+)/.exec(type);
    if (!boundary) return null;
    return parseMultipart(text, boundary[1].trim().replace(/^"|"$/g, ""));
  }
  return null;
}

function parseMultipart(text, boundary) {
  const fields = {};
  for (const part of text.split(`--${boundary}`)) {
    const trimmed = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    if (!trimmed || trimmed === "--") continue;
    const splitAt = trimmed.indexOf("\r\n\r\n");
    if (splitAt < 0) continue;
    const head = trimmed.slice(0, splitAt);
    let body = trimmed.slice(splitAt + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    const name = /name="([^"]+)"/.exec(head);
    if (!name) continue;
    fields[name[1]] = body;
  }
  return fields;
}
