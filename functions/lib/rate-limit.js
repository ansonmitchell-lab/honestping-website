import { sha256Hex } from "./digest.js";

export const RATE_LIMIT_TTL_SECONDS = 24 * 60 * 60;

export function utcDayKey(now) {
  return now.toISOString().slice(0, 10);
}

function clientIp(request) {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip || ip.length < 3 || ip.length > 64) return null;
  if (!/^[0-9A-Za-z:.]+$/.test(ip)) return null;
  return ip;
}

export async function feedbackLimitKey(request, salt, day, bucket) {
  const ip = clientIp(request);
  if (!ip) return null;
  const hash = await sha256Hex(`${salt}\n${day}\n${bucket}\n${ip}`);
  return `${bucket}:${hash}`;
}

export async function takeLimit(kv, key, limit) {
  const raw = await kv.get(key);
  const count = raw == null || raw === "" ? 0 : Number(raw);
  if (!Number.isInteger(count) || count < 0) return { allowed: false, broken: true };
  if (count >= limit) return { allowed: false, broken: false };
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_TTL_SECONDS });
  return { allowed: true, broken: false };
}
