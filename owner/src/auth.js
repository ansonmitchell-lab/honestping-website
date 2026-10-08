const TOKEN_MIN = 20;
const TOKEN_MAX = 12000;
const SKEW_MS = 60 * 1000;

export function teamIssuer(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 200) return null;
  const withScheme = raw.includes("://") ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (!url.hostname || url.hostname.length > 253 || url.hostname.includes("..")) return null;
  return `https://${url.hostname}`;
}

function fail(reason) {
  return { ok: false, reason };
}

function decodeB64Url(input) {
  if (typeof input !== "string" || !input || input.length > 20000) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(input)) return null;
  try {
    const pad = "=".repeat((4 - (input.length % 4)) % 4);
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function decodeJson(part) {
  const bytes = decodeB64Url(part);
  if (!bytes) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function configuredAud(env) {
  if (!env || typeof env.ACCESS_AUD !== "string") return "";
  return env.ACCESS_AUD.trim();
}

function audienceMatches(aud, expected) {
  const list = Array.isArray(aud) ? aud : [aud];
  return list.some((item) => item === expected);
}

function cleanEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim();
  if (email.length < 3 || email.length > 254) return null;
  if (/[\u0000-\u001f\u007f]/.test(email)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function publicRsaJwk(jwk) {
  if (!jwk || typeof jwk !== "object" || Array.isArray(jwk)) return null;
  if (jwk.kty !== "RSA") return null;
  if (jwk.alg && jwk.alg !== "RS256") return null;
  if (jwk.use && jwk.use !== "sig") return null;
  if (typeof jwk.n !== "string" || typeof jwk.e !== "string") return null;
  if (!jwk.n || !jwk.e || jwk.n.length > 10000 || jwk.e.length > 20) return null;
  return { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true };
}

async function signingKey(jwk) {
  const safe = publicRsaJwk(jwk);
  if (!safe) return null;
  try {
    return await crypto.subtle.importKey(
      "jwk",
      safe,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }
}

async function loadJwks(issuer, fetchImpl) {
  const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, {
    method: "GET",
    redirect: "manual",
    headers: { accept: "application/json" },
  });
  if (!response || response.status !== 200) return null;
  const text = await response.text();
  if (!text || text.length > 100000) return null;
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.keys)) return null;
  return body.keys.slice(0, 8);
}

async function verifyInner(token, env, options) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const fetchImpl = options.fetch || fetch;
  const issuer = teamIssuer(env && env.ACCESS_TEAM_DOMAIN);
  const aud = configuredAud(env);
  if (!issuer || !aud) return fail("missing_config");
  if (typeof token !== "string" || !token.trim()) return fail("missing_token");
  const compact = token.trim();
  if (compact.length < TOKEN_MIN || compact.length > TOKEN_MAX) return fail("invalid_token");
  const parts = compact.split(".");
  if (parts.length !== 3 || !parts[2]) return fail("invalid_token");
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  const signature = decodeB64Url(parts[2]);
  if (!header || !payload || !signature) return fail("invalid_token");
  if (header.alg !== "RS256") return fail("invalid_token");
  if (header.typ && header.typ !== "JWT") return fail("invalid_token");
  if (typeof header.kid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(header.kid)) return fail("invalid_token");
  if (payload.iss !== issuer) return fail("invalid_token");
  if (!audienceMatches(payload.aud, aud)) return fail("invalid_token");
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return fail("invalid_token");
  if (payload.exp * 1000 <= nowMs - SKEW_MS) return fail("expired");
  if (typeof payload.nbf === "number" && payload.nbf * 1000 > nowMs + SKEW_MS) return fail("invalid_token");
  if (typeof payload.iat === "number" && payload.iat * 1000 > nowMs + SKEW_MS) return fail("invalid_token");
  const email = cleanEmail(payload.email);
  if (!email) return fail("invalid_token");

  const keys = await loadJwks(issuer, fetchImpl);
  if (!keys) return fail("jwks_unavailable");
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  for (const jwk of keys) {
    if (!jwk || jwk.kid !== header.kid) continue;
    const key = await signingKey(jwk);
    if (!key) continue;
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
    if (ok) return { ok: true, email };
  }
  return fail("invalid_token");
}

export async function verifyAccessJwt(token, env, options = {}) {
  try {
    return await verifyInner(token, env, options);
  } catch {
    return fail("invalid_token");
  }
}
