import { loadTraffic } from "./analytics.js";
import { verifyAccessJwt } from "./auth.js";
import { ispCsv, waitlistCsv } from "./csv.js";
import { loadDownloads } from "./downloads.js";
import { renderDashboard, renderDenied } from "./html.js";
import {
  CSV_LIMIT,
  accessRows,
  ispRows,
  ispStatuses,
  ispTotal,
  isoDaysAgo,
  logAccess,
  missingTable,
  parseInquiryId,
  parseStatus,
  saveStatus,
  waitlistDays,
  waitlistRows,
  waitlistSources,
  waitlistTotal,
  waitlistWeeks,
} from "./queries.js";

const TABS = {
  "/": "overview",
  "/waitlist": "waitlist",
  "/isp": "isp",
  "/traffic": "traffic",
  "/downloads": "downloads",
  "/access": "access",
};

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function logEvent(fields) {
  console.log(JSON.stringify({ service: "honestping-owner", ...fields }));
}

function html(status, body, extra) {
  const headers = new Headers(HTML_HEADERS);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(body, { status, headers });
}

function plain(status, message) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function csvResponse(filename, body) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}

function pathOf(url) {
  const path = url.pathname || "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function record(db, email, action, detail, iso) {
  try {
    await logAccess(db, email, action, detail, iso);
    return "";
  } catch (error) {
    if (missingTable(error, "owner_access_log")) {
      return "The access log is not ready. Apply the owner migration.";
    }
    logEvent({ event: "log_failed", action });
    return "This action could not be written to the access log.";
  }
}

async function overviewModel(env, fetchImpl, now) {
  const sinceDays = isoDaysAgo(now, 28);
  const sinceWeeks = isoDaysAgo(now, 84);
  const waitlistTotalCount = await waitlistTotal(env.DB);
  const days = await waitlistDays(env.DB, sinceDays);
  const weeks = await waitlistWeeks(env.DB, sinceWeeks);
  const sources = await waitlistSources(env.DB);
  const ispTotalCount = await ispTotal(env.DB);
  const statuses = await ispStatuses(env.DB);
  const traffic = await loadTraffic(env, fetchImpl, now);
  const downloads = await loadDownloads(env, fetchImpl);
  return {
    waitlistTotal: waitlistTotalCount,
    ispTotal: ispTotalCount,
    days,
    weeks,
    sources,
    statuses: statuses.rows,
    statusesReady: statuses.ready,
    traffic,
    downloads,
  };
}

async function renderTab(tab, env, email, fetchImpl, now, warning) {
  const model = { tab, email, warning };
  if (tab === "overview") model.overview = await overviewModel(env, fetchImpl, now);
  else if (tab === "waitlist") {
    model.waitlist = {
      total: await waitlistTotal(env.DB),
      rows: await waitlistRows(env.DB),
    };
  } else if (tab === "isp") {
    const list = await ispRows(env.DB);
    const statuses = list.ready ? await ispStatuses(env.DB) : { ready: false, rows: [] };
    model.isp = {
      total: await ispTotal(env.DB),
      rows: list.rows,
      ready: list.ready,
      statuses: statuses.rows,
    };
  } else if (tab === "traffic") model.traffic = await loadTraffic(env, fetchImpl, now);
  else if (tab === "downloads") model.downloads = await loadDownloads(env, fetchImpl);
  else if (tab === "access") model.access = await accessRows(env.DB);
  return html(200, renderDashboard(model));
}

async function exportCsv(kind, env, email, iso) {
  if (!env.DB) return plain(500, "The database binding is missing.");
  if (kind === "waitlist") {
    const warning = await record(env.DB, email, "export", "waitlist", iso);
    if (warning) return plain(500, warning);
    const rows = await waitlistRows(env.DB, CSV_LIMIT);
    logEvent({ event: "export", table: "waitlist" });
    return csvResponse("waitlist.csv", waitlistCsv(rows));
  }
  const warning = await record(env.DB, email, "export", "isp", iso);
  if (warning) return plain(500, warning);
  const list = await ispRows(env.DB, CSV_LIMIT);
  logEvent({ event: "export", table: "isp" });
  return csvResponse("isp.csv", ispCsv(list.rows));
}

async function updateStatus(request, env, email, iso) {
  if (!sameOrigin(request)) return html(403, renderDashboard({
    tab: "isp",
    email,
    notice: true,
    title: "Save refused",
    message: "That save was refused.",
  }));
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/x-www-form-urlencoded")) {
    return html(400, renderDashboard({
      tab: "isp",
      email,
      notice: true,
      title: "Save refused",
      message: "That save was refused.",
    }));
  }
  const raw = await request.text();
  if (raw.length > 2000) {
    return html(400, renderDashboard({
      tab: "isp",
      email,
      notice: true,
      title: "Save refused",
      message: "That save was refused.",
    }));
  }
  const params = new URLSearchParams(raw);
  const inquiryId = parseInquiryId(params.get("inquiry_id") || "");
  const status = parseStatus(params.get("status") || "");
  if (!inquiryId || !status) {
    return html(400, renderDashboard({
      tab: "isp",
      email,
      notice: true,
      title: "Save refused",
      message: "Choose a status of new, talking, pilot, or partner.",
    }));
  }
  if (!env.DB) return plain(500, "The database binding is missing.");
  let saved;
  try {
    saved = await saveStatus(env.DB, inquiryId, status, email, iso);
  } catch (error) {
    if (missingTable(error, "isp_pipeline")) {
      return html(500, renderDashboard({
        tab: "isp",
        email,
        notice: true,
        title: "Migration needed",
        message: "Apply the owner migration before status can be saved.",
      }));
    }
    logEvent({ event: "status_failed" });
    return html(500, renderDashboard({
      tab: "isp",
      email,
      notice: true,
      title: "Not saved",
      message: "The status could not be saved.",
    }));
  }
  if (!saved.ok && saved.reason === "missing") {
    return html(404, renderDashboard({
      tab: "isp",
      email,
      notice: true,
      title: "Not found",
      message: "That inquiry is not on file.",
    }));
  }
  if (saved.changed) {
    await record(env.DB, email, "status", `inquiry ${inquiryId} ${status}`, iso);
    logEvent({ event: "status_change", inquiry_id: inquiryId, status });
  }
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/isp", request.url).href,
      "cache-control": "no-store",
    },
  });
}

export async function handleOwnerRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : new Date();
  const url = new URL(request.url);
  const path = pathOf(url);
  const auth = await verifyAccessJwt(request.headers.get("cf-access-jwt-assertion"), env, {
    fetch: fetchImpl,
    nowMs: now.getTime(),
  });
  if (!auth.ok) {
    logEvent({ event: "auth_rejected", reason: auth.reason });
    return html(401, renderDenied());
  }
  if (!env || !env.DB) return plain(500, "The database binding is missing.");
  const iso = now.toISOString();

  if (request.method === "POST" && path === "/isp/status") {
    return updateStatus(request, env, auth.email, iso);
  }
  if (request.method !== "GET" && request.method !== "HEAD") return plain(405, "Method not allowed");
  if (path === "/export/waitlist.csv") return exportCsv("waitlist", env, auth.email, iso);
  if (path === "/export/isp.csv") return exportCsv("isp", env, auth.email, iso);

  const tab = TABS[path];
  if (!tab) {
    return html(404, renderDashboard({
      tab: "",
      email: auth.email,
      notice: true,
      title: "Not found",
      message: "That page is not on this dashboard.",
    }));
  }
  const warning = await record(env.DB, auth.email, "view", tab, iso);
  logEvent({ event: "view", tab });
  try {
    return await renderTab(tab, env, auth.email, fetchImpl, now, warning);
  } catch (error) {
    logEvent({ event: "section_failed", tab, error: error instanceof Error ? error.name : "Error" });
    return html(500, renderDashboard({
      tab,
      email: auth.email,
      notice: true,
      title: "Could not be loaded",
      message: "This page could not be loaded.",
    }));
  }
}

export default {
  async fetch(request, env) {
    try {
      return await handleOwnerRequest(request, env);
    } catch (error) {
      logEvent({ event: "unhandled", error: error instanceof Error ? error.name : "Error" });
      return plain(500, "This page could not be loaded.");
    }
  },
};
