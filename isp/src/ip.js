const OCTET = /^(?:0|[1-9]\d{0,2})$/;

export function ipv4ToInt(ip) {
  if (typeof ip !== "string") return null;
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!OCTET.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = ((value << 8) + octet) >>> 0;
  }
  return value;
}

export function parseCidr(cidr) {
  if (typeof cidr !== "string") return null;
  const slash = cidr.indexOf("/");
  const addr = slash === -1 ? cidr : cidr.slice(0, slash);
  const bits = slash === -1 ? 32 : Number(cidr.slice(slash + 1));
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  if (slash !== -1 && !/^\d{1,2}$/.test(cidr.slice(slash + 1))) return null;
  const base = ipv4ToInt(addr);
  if (base == null) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const network = (base & mask) >>> 0;
  if (network !== base) return null;
  return { cidr: `${intToIpv4(network)}/${bits}`, network, mask, bits };
}

export function intToIpv4(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

export function ipInCidr(ip, cidr) {
  const addr = ipv4ToInt(ip);
  const parsed = typeof cidr === "string" ? parseCidr(cidr) : cidr;
  if (addr == null || !parsed) return false;
  return ((addr & parsed.mask) >>> 0) === parsed.network;
}

export function samePrefix(a, b, bits) {
  const left = ipv4ToInt(a);
  const right = ipv4ToInt(b);
  if (left == null || right == null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((left & mask) >>> 0) === ((right & mask) >>> 0);
}

export function scopeOfIp(ip) {
  const value = ipv4ToInt(ip);
  if (value == null) return "none";
  if (inBlock(value, "10.0.0.0", 8) || inBlock(value, "172.16.0.0", 12) || inBlock(value, "192.168.0.0", 16)) {
    return "private";
  }
  if (inBlock(value, "100.64.0.0", 10)) return "cgnat";
  if (inBlock(value, "169.254.0.0", 16)) return "link_local";
  return "public";
}

function inBlock(value, base, bits) {
  const parsed = parseCidr(`${base}/${bits}`);
  return ((value & parsed.mask) >>> 0) === parsed.network;
}

export function isIspPrivateScope(scope) {
  return scope === "private" || scope === "cgnat";
}

// Confirmed ranges win even when a suggestion is a longer prefix.
export function matchLongest(ip, entries) {
  if (!ip) return null;
  let best = null;
  let bestBits = -1;
  for (const entry of entries || []) {
    const cidrs = entry.cidrs || (entry.cidr ? [entry.cidr] : []);
    for (const cidr of cidrs) {
      const parsed = parseCidr(cidr);
      if (!parsed || !ipInCidr(ip, parsed)) continue;
      if (parsed.bits > bestBits) {
        best = entry;
        bestBits = parsed.bits;
      }
    }
  }
  return best;
}

export function hostCidr(ip) {
  const parsed = parseCidr(`${ip}/32`);
  return parsed ? parsed.cidr : null;
}
