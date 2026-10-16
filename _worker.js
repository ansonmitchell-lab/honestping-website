var SAFE_VARIANT_SCRIPT = "(function () {\n    var search = location.search || \"\";\n    var variant = \"\";\n    if (/(?:^|[?&])variant=waitlist(?:&|$)/.test(search)) variant = \"waitlist\";\n    else if (/(?:^|[?&])variant=app(?:&|$)/.test(search)) variant = \"app\";\n    if (variant) document.documentElement.setAttribute(\"data-st-variant\", variant);\n  })();";

function variantOf(url) {
  var value = new URL(url).searchParams.get("variant");
  return value === "waitlist" ? "waitlist" : "app";
}

function isTestPage(pathname) {
  return pathname === "/test" || pathname === "/test/";
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var passThrough = (request.method !== "GET" && request.method !== "HEAD") || !isTestPage(url.pathname);
    if (passThrough) return env.ASSETS.fetch(request);

    var variant = variantOf(request.url);
    var asset = await env.ASSETS.fetch(new URL("/test/index.html", url.origin));
    var type = asset.headers.get("content-type") || "";
    if (!asset.ok || type.indexOf("text/html") === -1) return asset;

    var drop = variant === "waitlist" ? "[data-variant-app]" : "[data-variant-waitlist]";
    var rewriter = new HTMLRewriter()
      .on("html", {
        element: function (element) {
          element.setAttribute("data-st-variant", variant);
        }
      })
      .on(drop, {
        element: function (element) {
          element.remove();
        }
      })
      .on("script", {
        text: function (text) {
          if (text.text.indexOf('? "waitlist" : "app"') !== -1) {
            text.replace(SAFE_VARIANT_SCRIPT, { html: true });
          }
        }
      });

    var headers = new Headers(asset.headers);
    headers.delete("content-length");
    headers.set("cache-control", "public, max-age=0, must-revalidate");
    var response = rewriter.transform(new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers: headers
    }));
    if (request.method === "HEAD") {
      return new Response(null, { status: response.status, headers: response.headers });
    }
    return response;
  }
};
