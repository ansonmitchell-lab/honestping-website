import { escapeHtml, segmentLabel } from "./format.js";

const LEGEND = [
  ["home", "Home", "var(--home)"],
  ["access", "Last mile", "var(--access)"],
  ["aggregation", "Aggregation", "var(--aggregation)"],
  ["core", "Core", "var(--core)"],
  ["peering", "Peering", "var(--peering)"],
  ["beyond_isp", "Beyond", "var(--beyond)"],
];

export function renderPathCard(model) {
  const hops = (model.hops || []).map((hop) => {
    const suspect = hop.suspect ? " suspect" : "";
    const address = hop.address
      ? `<span class="hop-addr">${escapeHtml(hop.address)}</span>`
      : "";
    const flag = hop.ispPrivate ? `<span class="hop-meta">ISP private</span>` : "";
    return `<li class="hop${suspect}" data-segment="${escapeHtml(hop.segment)}">
      <span class="dot"></span>
      <span class="hop-name">${escapeHtml(hop.label)}</span>
      <span class="hop-ms">${escapeHtml(hop.msLabel)}</span>
      <span class="hop-meta">${escapeHtml(segmentLabel(hop.segment))}</span>
      ${flag}
      ${address}
    </li>`;
  }).join("");
  const legend = LEGEND.map(([, label, color]) => (
    `<span><i class="swatch" style="background:${color}"></i>${label}</span>`
  )).join("");
  const area = model.areaLine ? `<p class="area">${escapeHtml(model.areaLine)}</p>` : "";
  const tone = model.verdict === "clear" ? "good" : "warn";
  return `<section class="card path-card" id="path-card">
    <div class="card-head">
      <h2>Path</h2>
      <span class="pill">Example</span>
    </div>
    <p class="kicker">${escapeHtml(model.claim || "Claim")}, shared with the 7-day report. ${escapeHtml(model.traceLabel || "Example trace")}.</p>
    <ol class="hop-line">${hops}</ol>
    <div class="legend">${legend}</div>
    <div class="verdict">
      <span class="pill ${tone}">${escapeHtml(model.verdictLabel || "Path looks clear")}</span>
      <p>${escapeHtml(model.explanation || "")}</p>
    </div>
    ${area}
    <p class="note">Confirmed nodes only. A mid path spike that does not continue is not a fault. Home hops have no address. ISP private hops stay in this provider view.</p>
  </section>`;
}
