import { previewStyles } from "./styles.js";
import { escapeHtml } from "./format.js";

const NAV = [
  ["/isp-preview/support", "Support", "support"],
  ["/isp-preview/paths", "Path", "paths"],
  ["/isp-preview/network", "Network admin", "network"],
];

const NOTICES = {
  confirmed: "Suggestion confirmed. The node is in the range list.",
  merged: "Suggestion merged into the node you picked.",
  rejected: "Suggestion rejected. It will not be offered again.",
  node: "Node saved.",
  range: "Range saved.",
  upload: "Upload saved.",
  refused: "That change was refused.",
};

export function noticeText(code) {
  return NOTICES[code] || "";
}

export function renderPreviewPage({ title, active, body, notice }) {
  const nav = NAV.map(([href, label, id]) => {
    const current = id === active ? ' aria-current="page"' : "";
    return `<a href="${href}"${current}>${label}</a>`;
  }).join("");
  const banner = notice ? `<p class="banner">${escapeHtml(notice)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
  <style>${previewStyles}</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div class="brand">HonestPing <small>ISP preview · Example data</small></div>
      <nav class="nav">${nav}</nav>
    </header>
    ${banner}
    ${body}
    <p class="foot">© <span id="year">2026</span> Honest Ping LLC</p>
  </div>
</body>
</html>`;
}
