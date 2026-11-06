const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const DAY_MS = 24 * 60 * 60 * 1000;

const DAILY_QUERY = `query OwnerDaily($zoneTag: string!, $start: Date!, $end: Date!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1dGroups(
        limit: 14
        filter: { date_geq: $start, date_lt: $end }
        orderBy: [date_ASC]
      ) {
        dimensions { date }
        sum {
          pageViews
          countryMap { clientCountryName requests }
        }
        uniq { uniques }
      }
    }
  }
}`;

const PAGES_QUERY = `query OwnerPages($zoneTag: string!, $start: Time!, $end: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        limit: 20
        filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { clientRequestPath }
      }
    }
  }
}`;

export function analyticsWindow(now) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = new Date(today + DAY_MS);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function zoneId(value) {
  if (typeof value !== "string") return "";
  const zone = value.trim();
  if (!/^[a-f0-9]{32}$/i.test(zone)) return "";
  return zone;
}

function token(value) {
  if (typeof value !== "string") return "";
  const secret = value.trim();
  if (!secret || secret.length > 4000) return "";
  return secret;
}

async function graphql(fetchImpl, secret, query, variables) {
  const response = await fetchImpl(GRAPHQL_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response || response.status !== 200) return null;
  const text = await response.text();
  if (!text || text.length > 1000000) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function zonesOf(body) {
  const zones = body && body.data && body.data.viewer && body.data.viewer.zones;
  if (!Array.isArray(zones) || !zones.length) return null;
  return zones[0];
}

export async function loadTraffic(env, fetchImpl = fetch, now = new Date()) {
  const secret = token(env && env.CF_ANALYTICS_TOKEN);
  const zone = zoneId(env && env.ZONE_ID);
  if (!secret || !zone) return { connected: false };
  const window = analyticsWindow(now);
  try {
    const dailyBody = await graphql(fetchImpl, secret, DAILY_QUERY, {
      zoneTag: zone,
      start: window.start,
      end: window.end,
    });
    const dailyZone = zonesOf(dailyBody);
    if (!dailyZone || !Array.isArray(dailyZone.httpRequests1dGroups)) {
      return { connected: true, error: true };
    }
    let visits = 0;
    let pageViews = 0;
    const days = [];
    const countries = new Map();
    for (const row of dailyZone.httpRequests1dGroups) {
      const uniques = Number(row && row.uniq && row.uniq.uniques) || 0;
      const views = Number(row && row.sum && row.sum.pageViews) || 0;
      visits += uniques;
      pageViews += views;
      const label = row && row.dimensions && row.dimensions.date ? String(row.dimensions.date) : "";
      if (label) days.push({ label, count: uniques });
      const map = row && row.sum && row.sum.countryMap;
      if (!Array.isArray(map)) continue;
      for (const entry of map) {
        const name = entry && entry.clientCountryName ? String(entry.clientCountryName) : "Unknown";
        const requests = Number(entry && entry.requests) || 0;
        countries.set(name, (countries.get(name) || 0) + requests);
      }
    }
    let pages = [];
    let pagesError = false;
    try {
      const pagesBody = await graphql(fetchImpl, secret, PAGES_QUERY, {
        zoneTag: zone,
        start: window.startTime,
        end: window.endTime,
      });
      const pagesZone = zonesOf(pagesBody);
      const groups = pagesZone && pagesZone.httpRequestsAdaptiveGroups;
      if (!Array.isArray(groups)) pagesError = true;
      else {
        pages = groups.map((row) => ({
          label: row && row.dimensions && row.dimensions.clientRequestPath
            ? String(row.dimensions.clientRequestPath)
            : "Unknown page",
          count: Number(row && row.count) || 0,
        }));
      }
    } catch {
      pagesError = true;
    }
    return {
      connected: true,
      error: false,
      visits,
      pageViews,
      days,
      pages,
      pagesError,
      countries: [...countries.entries()].map(([label, count]) => ({ label, count })),
    };
  } catch {
    return { connected: true, error: true };
  }
}
