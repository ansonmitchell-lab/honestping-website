import { addNodeWithRange, addRangeToNode, confirmSuggestion, mergeSuggestion, rejectSuggestion } from "./admin.js";
import { runNightly } from "./cron.js";
import { previewOrg, readForm, readLimited, sameOrigin } from "./http.js";
import { ingestSharedTrace } from "./ingest.js";
import { keepIspPrivateHops } from "./redact.js";
import { floorOf, loadNetworkModel, loadSupportModel } from "./models.js";
import { hopsForRun } from "./queries.js";
import { parseNodeCsv } from "./upload.js";
import { noticeText, renderPreviewPage } from "./views/page.js";
import { renderNetworkAdmin } from "./views/network-admin.js";
import { renderPathCard } from "./views/path-card.js";
import { renderSupportView } from "./views/support-view.js";

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function html(status, body, extra) {
  const headers = new Headers(HTML_HEADERS);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(body, { status, headers });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}

function text(status, message) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function pathOf(url) {
  const path = url.pathname || "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export async function handleIspRequest(request, env) {
  if (!env || env.ALLOW_ISP_PREVIEW !== "1") return text(404, "Not found");
  const url = new URL(request.url);
  const path = pathOf(url);
  const org = previewOrg(request, env);
  if (request.method === "POST" && path === "/api/isp/traces") {
    if (!org) return json(401, { error: "unauthorized" });
    return ingestHttp(request, env, org);
  }
  if (request.method === "GET" && path.startsWith("/api/isp/traces/")) {
    if (!org) return json(401, { error: "unauthorized" });
    const runId = decodeURIComponent(path.slice("/api/isp/traces/".length));
    if (!runId || !env.DB) return json(404, { error: "not_found" });
    const hops = await hopsForRun(env.DB, org, runId);
    if (!hops.length) return json(404, { error: "not_found" });
    return json(200, { run_id: runId, hops });
  }
  const previewPage = request.method === "GET" && (
    path === "/isp-preview"
    || path === "/isp-preview/support"
    || path === "/isp-preview/paths"
    || path === "/isp-preview/network"
  );
  const previewPost = request.method === "POST" && path.startsWith("/isp-preview/network/");
  if (!previewPage && !previewPost) return text(404, "Not found");
  if (!org) return text(401, "Sign in to the ISP preview.");
  const floor = floorOf(env);
  const notice = noticeText(url.searchParams.get("notice"));
  if (request.method === "GET" && (path === "/isp-preview" || path === "/isp-preview/support")) {
    const model = await loadSupportModel(env.DB, org, floor, url.searchParams.get("run"));
    return html(200, renderPreviewPage({
      title: "Support",
      active: "support",
      notice,
      body: renderSupportView(model),
    }));
  }
  if (request.method === "GET" && path === "/isp-preview/paths") {
    const model = await loadSupportModel(env.DB, org, floor, url.searchParams.get("run"));
    return html(200, renderPreviewPage({
      title: "Path",
      active: "paths",
      notice,
      body: renderPathCard(model),
    }));
  }
  if (request.method === "GET" && path === "/isp-preview/network") {
    const model = await loadNetworkModel(env.DB, org, floor);
    return html(200, renderPreviewPage({
      title: "Network admin",
      active: "network",
      notice,
      body: renderNetworkAdmin(model),
    }));
  }
  if (request.method === "POST" && path.startsWith("/isp-preview/network/")) {
    if (!sameOrigin(request)) {
      return html(403, renderPreviewPage({
        title: "Network admin",
        active: "network",
        notice: noticeText("refused"),
        body: renderNetworkAdmin(await loadNetworkModel(env.DB, org, floor)),
      }));
    }
    return postNetwork(request, env, org, path);
  }
  return text(404, "Not found");
}

async function ingestHttp(request, env, org) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) return json(400, { error: "invalid_trace" });
  const body = await readLimited(request);
  if (!body.ok) return json(413, { error: "too_large" });
  let payload;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json(400, { error: "invalid_trace" });
  }
  const result = await ingestSharedTrace(env.DB, payload, {
    ispOrg: org,
    env,
    keepIspPrivate: keepIspPrivateHops(env),
    householdSalt: env.HOUSEHOLD_SALT,
    kMin: floorOf(env),
  });
  if (!result.ok) return json(result.status, { error: result.error });
  return json(result.status, {
    run_id: result.run_id,
    deduped: result.deduped,
    verdict: result.verdict || null,
    warnings: (result.warnings || []).map((warning) => warning.code),
  });
}

async function postNetwork(request, env, org, path) {
  const body = await readLimited(request);
  if (!body.ok) return text(413, "Too large");
  const form = readForm(request.headers.get("content-type"), body.text) || {};
  const floor = floorOf(env);
  let notice = "refused";
  if (path === "/isp-preview/network/suggestions") {
    const action = form.action;
    if (action === "confirm") {
      const result = await confirmSuggestion(env.DB, org, form.suggestion_id, form.name, "preview", new Date(), floor);
      notice = result.ok ? "confirmed" : "refused";
    } else if (action === "merge") {
      const result = await mergeSuggestion(env.DB, org, form.suggestion_id, form.merge_into, "preview", new Date(), floor);
      notice = result.ok ? "merged" : "refused";
    } else if (action === "reject") {
      const result = await rejectSuggestion(env.DB, org, form.suggestion_id, "preview");
      notice = result.ok ? "rejected" : "refused";
    }
  } else if (path === "/isp-preview/network/nodes") {
    const result = await addNodeWithRange(env.DB, org, form);
    notice = result.ok ? "node" : "refused";
  } else if (path === "/isp-preview/network/ranges") {
    const result = await addRangeToNode(env.DB, org, form.node_id, form.cidr, "manual");
    notice = result.ok ? "range" : "refused";
  } else if (path === "/isp-preview/network/upload") {
    const csv = form.file || form.csv || "";
    const kind = ["plain", "netbox", "uisp"].includes(form.kind) ? form.kind : "plain";
    const parsed = parseNodeCsv(csv, kind);
    let saved = 0;
    for (const node of parsed.nodes) {
      const created = await addNodeWithRange(env.DB, org, {
        name: node.name,
        area: node.area,
        role: node.role,
        cidr: node.cidrs[0],
        source: node.source,
        external_ref: node.external_ref,
      });
      if (!created.ok) continue;
      saved += 1;
      for (const cidr of node.cidrs.slice(1)) {
        await addRangeToNode(env.DB, org, created.id, cidr, node.source);
      }
    }
    notice = saved ? "upload" : "refused";
  }
  return html(303, "", { location: `/isp-preview/network?notice=${notice}` });
}

export default {
  fetch(request, env) {
    return handleIspRequest(request, env);
  },
  scheduled(event, env, ctx) {
    if (!env || env.ALLOW_ISP_PREVIEW !== "1") return;
    const when = new Date(event && event.scheduledTime ? event.scheduledTime : Date.now());
    ctx.waitUntil(runNightly(env, when));
  },
};
