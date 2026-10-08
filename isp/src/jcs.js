// Canonical JSON for the integer-only shared trace fingerprint.
// For this payload it matches RFC 8785: sorted keys, no whitespace, UTF-8.

export function canonicalJson(value) {
  return jcs(value);
}

function jcs(value) {
  if (value === null) return "null";
  const kind = typeof value;
  if (kind === "boolean") return value ? "true" : "false";
  if (kind === "number") {
    if (!Number.isInteger(value)) {
      throw new TypeError("non_integer");
    }
    return String(value);
  }
  if (kind === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => jcs(item)).join(",")}]`;
  if (kind !== "object") throw new TypeError("bad_type");
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${jcs(value[key])}`).join(",")}}`;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function traceFingerprint(payload) {
  const copy = { ...payload };
  delete copy.integrity;
  return sha256Hex(`honestping-trace-v1\n${canonicalJson(copy)}`);
}

export const TRACE_PREFIX = "honestping-trace-v1\n";
