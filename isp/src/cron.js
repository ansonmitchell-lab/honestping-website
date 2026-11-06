import { buildSuggestions } from "./cluster.js";
import { enrichPublicIp } from "./enrich.js";
import { inferIspAsns } from "./classify.js";
import { kMin } from "./households.js";
import {
  enrichmentFor,
  enrichmentMap,
  flagUnseenNodes,
  listOrgIds,
  nodesWithRanges,
  publicHopIps,
  rejectedFingerprints,
  runsWithHops,
  saveSuggestion,
  upsertEnrichment,
} from "./queries.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function refreshEnrichment(db, ispOrg, fetchImpl, now) {
  if (!fetchImpl) return { looked_up: 0 };
  const ips = await publicHopIps(db, ispOrg);
  let looked = 0;
  for (const ip of ips) {
    const cached = await enrichmentFor(db, ispOrg, ip);
    const result = await enrichPublicIp({ ip, fetchImpl, now: now.getTime(), cached });
    if (result.skipped || result.cached) continue;
    await upsertEnrichment(db, {
      isp_org: ispOrg,
      ip,
      ptr: result.ptr,
      asn: result.asn,
      prefix: result.prefix,
      ixp_id: result.ixp_id,
      fetched_at: Math.floor(now.getTime() / 1000),
    });
    looked += 1;
  }
  return { looked_up: looked };
}

export async function rebuildSuggestions(db, ispOrg, now, minHouseholds) {
  const runs = await runsWithHops(db, ispOrg);
  const nodes = await nodesWithRanges(db, ispOrg);
  const enrichment = await enrichmentMap(db, ispOrg);
  const ispAsns = inferIspAsns(runs.flatMap((run) => run.hops), enrichment);
  const rejected = new Set(await rejectedFingerprints(db, ispOrg));
  const drafts = await buildSuggestions({
    runs: runs.map((run) => ({
      householdHash: run.householdHash,
      startedAt: run.startedAt,
      hops: run.hops,
    })),
    enrichment,
    rejected,
    nodes: nodes.filter((node) => node.status !== "inactive"),
    ispOrg,
    now: now.getTime(),
    ispAsns,
    minHouseholds,
  });
  let saved = 0;
  for (const draft of drafts) {
    const outcome = await saveSuggestion(db, { ...draft, id: crypto.randomUUID(), isp_org: ispOrg });
    if (!outcome.skipped) saved += 1;
  }
  return { saved, drafted: drafts.length };
}

export async function runNightly(env, now = new Date()) {
  if (!env || env.ALLOW_ISP_PREVIEW !== "1" || !env.DB) return { orgs: 0 };
  const orgs = await listOrgIds(env.DB);
  const fetchImpl = env.ALLOW_LIVE_ENRICHMENT === "1" ? globalThis.fetch : null;
  const floor = kMin(env);
  for (const ispOrg of orgs) {
    await refreshEnrichment(env.DB, ispOrg, fetchImpl, now);
    await rebuildSuggestions(env.DB, ispOrg, now, floor);
    const cutoff = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    await flagUnseenNodes(env.DB, ispOrg, now.toISOString(), cutoff);
  }
  return { orgs: orgs.length };
}
