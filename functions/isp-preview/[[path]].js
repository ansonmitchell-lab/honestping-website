import { isIspPreviewPath, ispPreviewResponse } from "../../isp-preview/render.js";

export function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (!isIspPreviewPath(path)) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex",
        "cache-control": "no-store",
      },
    });
  }
  return ispPreviewResponse(context.env);
}
