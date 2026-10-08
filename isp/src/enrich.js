import { scopeOfIp } from "./ip.js";

export const ENRICH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function reverseName(ip) {
  return `${ip.split(".").reverse().join(".")}.in-addr.arpa`;
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/dns-json, application/json",
      "user-agent": "HonestPing-preview/1",
    },
  });
  if (!response.ok) throw new Error("lookup_failed");
  return response.json();
}

export async function lookupPtr(ip, fetchImpl) {
  const body = await getJson(
    fetchImpl,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(reverseName(ip))}&type=PTR`,
  );
  const answer = Array.isArray(body.Answer) ? body.Answer.find((row) => row.type === 12) : null;
  if (!answer || typeof answer.data !== "string") return null;
  return answer.data.replace(/\.$/, "");
}

export async function lookupRipe(ip, fetchImpl) {
  const overview = await getJson(
    fetchImpl,
    `https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(ip)}`,
  );
  const asns = overview?.data?.asns;
  let asn = Array.isArray(asns) && asns.length ? Number(asns[0].asn) : null;
  let prefix = overview?.data?.resource || null;
  if (!Number.isInteger(asn)) {
    const info = await getJson(
      fetchImpl,
      `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(ip)}`,
    );
    prefix = prefix || info?.data?.prefix || null;
    const raw = Array.isArray(info?.data?.asns) ? info.data.asns[0] : null;
    const parsed = typeof raw === "string" ? Number(raw.replace(/^AS/i, "")) : Number(raw);
    asn = Number.isInteger(parsed) ? parsed : null;
  }
  return { asn: Number.isInteger(asn) ? asn : null, prefix: prefix || null };
}

export async function lookupCymru(ip, fetchImpl) {
  const name = `${reverseName(ip).replace(/\.in-addr\.arpa$/, "")}.origin.asn.cymru.com`;
  const body = await getJson(
    fetchImpl,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
  );
  const answer = Array.isArray(body.Answer) ? body.Answer.find((row) => row.type === 16) : null;
  if (!answer || typeof answer.data !== "string") return { asn: null, prefix: null };
  const text = answer.data.replace(/^"|"$/g, "");
  const [asnRaw, prefix] = text.split("|").map((part) => part.trim());
  const asn = Number(asnRaw);
  return {
    asn: Number.isInteger(asn) ? asn : null,
    prefix: prefix || null,
  };
}

export async function lookupPeeringDb(ip, fetchImpl) {
  const body = await getJson(
    fetchImpl,
    `https://www.peeringdb.com/api/netixlan?ipaddr4=${encodeURIComponent(ip)}`,
  );
  const row = Array.isArray(body?.data) ? body.data[0] : null;
  if (!row || row.ix_id == null) return null;
  const ixp = Number(row.ix_id);
  return Number.isInteger(ixp) ? ixp : null;
}

export async function enrichPublicIp({ ip, fetchImpl, now, cached }) {
  if (scopeOfIp(ip) !== "public") {
    return { skipped: true, reason: "not_public" };
  }
  const fetchedAt = cached ? Number(cached.fetched_at) * 1000 : 0;
  if (cached && now - fetchedAt < ENRICH_TTL_MS) {
    return {
      skipped: false,
      cached: true,
      ptr: cached.ptr,
      asn: cached.asn,
      prefix: cached.prefix,
      ixp_id: cached.ixp_id,
    };
  }
  let ptr = null;
  let asn = null;
  let prefix = null;
  let ixp = null;
  let ripeFailed = false;
  try {
    ptr = await lookupPtr(ip, fetchImpl);
  } catch {
    ptr = null;
  }
  try {
    const ripe = await lookupRipe(ip, fetchImpl);
    asn = ripe.asn;
    prefix = ripe.prefix;
  } catch {
    ripeFailed = true;
  }
  if (asn == null) {
    try {
      const cymru = await lookupCymru(ip, fetchImpl);
      asn = cymru.asn;
      prefix = prefix || cymru.prefix;
      ripeFailed = true;
    } catch {
      ripeFailed = true;
    }
  }
  try {
    ixp = await lookupPeeringDb(ip, fetchImpl);
  } catch {
    ixp = null;
  }
  if (ptr == null && asn == null && prefix == null && ixp == null) {
    return { skipped: true, reason: "lookup_failed", ripeFailed };
  }
  return {
    skipped: false,
    cached: false,
    ptr,
    asn,
    prefix,
    ixp_id: ixp,
    ripeFailed,
  };
}
