import { handleSubmit, retryUnsent } from "../functions/lib/submit.js";

const DEFAULT_ORIGIN = "https://raw.githubusercontent.com/ansonmitchell-lab/honestping-website/main";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function typeFor(path) {
  const index = path.lastIndexOf(".");
  if (index < 0) return null;
  return TYPES[path.slice(index).toLowerCase()] || null;
}

function originBase(env) {
  const configured = env && typeof env.ORIGIN_BASE === "string" ? env.ORIGIN_BASE.trim() : "";
  const value = configured || DEFAULT_ORIGIN;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "raw.githubusercontent.com") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return "https://raw.githubusercontent.com" + url.pathname.replace(/\/+$/, "");
}

async function proxy(request, env) {
  const origin = originBase(env);
  if (!origin) {
    return new Response("Site origin is not configured", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  try {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path === "/" || path === "") path = "/index.html";
    if (path.includes("..")) return new Response("Bad request", { status: 400 });
    const upstreamUrl = origin + path + "?v=" + Date.now();
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "user-agent": "HonestPingSite/1.0",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      redirect: "follow",
      cf: { cacheTtl: 0 },
    });
    if (!upstream.ok) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    headers.set("content-type", typeFor(path) || "application/octet-stream");
    headers.set("cache-control", path.endsWith(".html") ? "no-cache" : "public, max-age=300");
    headers.set("x-content-type-options", "nosniff");
    return new Response(body, { status: 200, headers });
  } catch (error) {
    return new Response("Upstream error: " + (error && error.message ? error.message : String(error)), {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/waitlist" || path === "/api/isp") return handleSubmit(request, env);
    return proxy(request, env);
  },
  async scheduled(_controller, env, ctx) {
    const pending = retryUnsent(env);
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(pending);
    await pending;
  },
};
