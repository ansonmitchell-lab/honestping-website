import {
  FEEDBACK_STATUSES,
  KINDS,
  SOURCES,
  issueLabel,
} from "../../functions/lib/feedback-contract.js";

const STATUS_LABELS = {
  new: "New",
  reviewing: "Reviewing",
  planned: "Planned",
  declined: "Declined",
  done: "Done",
};

const KIND_LABELS = {
  feature: "Feature",
  bug: "Bug",
  crash: "Crash",
};

const SOURCE_LABELS = {
  app: "App",
  isp: "ISP",
};

export const REQUESTS_CSS = `
    .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin: 0 0 16px; }
    .filters label { display: grid; gap: 4px; color: var(--hp-muted); font-size: 12px; font-weight: 650; }
    .group-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 0 0 16px; }
    .group-card { background: var(--hp-surface); border: 1px solid var(--hp-line); border-radius: 12px; padding: 14px; }
    .group-card h2 { margin-bottom: 4px; }
    .split { color: var(--hp-muted); font-size: 13px; margin-top: 4px; }
    .spark { display: block; margin-top: 8px; }
    .badge-auto {
      display: inline-block;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 999px;
      background: #32281c;
      color: #ffc478;
      border: 1px solid #8a6a3e;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      vertical-align: 1px;
    }
    .hint { color: var(--hp-amber); font-size: 12px; }
    .logbox {
      max-height: 16rem;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.45;
      background: #071c25;
      border: 1px solid var(--hp-line);
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 6px;
    }
    .shot { max-width: 100%; max-height: 480px; border-radius: 8px; border: 1px solid var(--hp-line); background: #071c25; }
    .stack { display: grid; gap: 12px; }
    .meta { color: var(--hp-muted); font-size: 13px; }
`;

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function labelOf(map, value) {
  return map[value] || value || "";
}

function autoBadge(row) {
  return Number(row.auto_sent) === 1 || row.auto_sent === true
    ? `<span class="badge-auto">Auto</span>`
    : "";
}

function sparkline(values) {
  const width = 128;
  const height = 28;
  const series = Array.isArray(values) && values.length ? values : [0];
  const max = Math.max(1, ...series.map((value) => Number(value) || 0));
  const step = series.length > 1 ? width / (series.length - 1) : 0;
  const points = series.map((value, index) => {
    const x = index * step;
    const y = height - ((Number(value) || 0) / max) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Daily counts for 30 days"><polyline fill="none" stroke="#71def0" stroke-width="1.6" points="${points}"/></svg>`;
}

function options(values, labels, current, anyLabel) {
  const head = `<option value="">${escapeHtml(anyLabel)}</option>`;
  const rest = values.map((value) => {
    const selected = value === current ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(labels[value] || value)}</option>`;
  }).join("");
  return head + rest;
}

function filterForm(filters) {
  return `<form class="filters" method="get" action="/requests">
    <label>Source<select name="source">${options(SOURCES, SOURCE_LABELS, filters.source, "Any source")}</select></label>
    <label>Kind<select name="kind">${options(KINDS, KIND_LABELS, filters.kind, "Any kind")}</select></label>
    <label>Status<select name="status">${options(FEEDBACK_STATUSES, STATUS_LABELS, filters.status, "Any status")}</select></label>
    <button type="submit">Apply</button>
    <a class="btn" href="/requests">Clear</a>
  </form>`;
}

function similarLine(ids) {
  if (!ids || !ids.length) return "";
  const links = ids.map((id) => `<a href="/requests/${Number(id)}">HP-${Number(id)}</a>`).join(", ");
  return `<div class="hint">Possible duplicate: ${links}</div>`;
}

function groupCards(groups) {
  if (!groups.length) {
    return `<section class="panel"><h2>By issue type</h2><p class="empty">No reports in the last 30 days for this filter.</p></section>`;
  }
  const cards = groups.map((group) => `<article class="group-card">
      <h2>${escapeHtml(group.label)}</h2>
      <p class="metric">${escapeHtml(String(group.days7))}</p>
      <p class="note">Last 7 days. ${escapeHtml(String(group.days30))} in 30 days.</p>
      <p class="split">App ${escapeHtml(String(group.app))}, ISP ${escapeHtml(String(group.isp))}</p>
      ${sparkline(group.spark)}
    </article>`).join("");
  return `<section><h2>By issue type</h2><p class="lead">The last 7 days, with the 30 day count, the source split, and a daily sparkline.</p><div class="group-grid">${cards}</div></section>`;
}

function listTable(rows) {
  if (!rows.length) return `<p class="empty">No reports match these filters.</p>`;
  const body = rows.map((row) => `<tr>
      <td><a href="/requests/${Number(row.id)}">HP-${Number(row.id)}</a></td>
      <td>${escapeHtml(row.created_at)}</td>
      <td>${escapeHtml(labelOf(SOURCE_LABELS, row.source))}</td>
      <td>${escapeHtml(labelOf(KIND_LABELS, row.kind))}${autoBadge(row)}</td>
      <td>${escapeHtml(issueLabel(row.issue_type))}</td>
      <td>${escapeHtml(row.title)}${similarLine(row.similar)}</td>
      <td>${escapeHtml(row.page_context || "")}</td>
      <td>${escapeHtml(labelOf(STATUS_LABELS, row.status))}</td>
    </tr>`).join("");
  return `<div class="table-wrap"><table>
      <thead><tr><th>Reference</th><th>When</th><th>Source</th><th>Kind</th><th>Issue</th><th>Title</th><th>Screen</th><th>Status</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

function statusForm(row) {
  const status = FEEDBACK_STATUSES.includes(row.status) ? row.status : "new";
  const optionsHtml = FEEDBACK_STATUSES.map((value) => {
    const selected = value === status ? " selected" : "";
    return `<option value="${value}"${selected}>${STATUS_LABELS[value]}</option>`;
  }).join("");
  return `<form class="status" method="post" action="/requests/status">
    <input type="hidden" name="feedback_id" value="${Number(row.id)}">
    <select name="status" aria-label="Status for HP-${Number(row.id)}">${optionsHtml}</select>
    <button type="submit">Save</button>
  </form>`;
}

function field(label, value) {
  if (value == null || value === "") return "";
  return `<p><span class="meta">${escapeHtml(label)}</span><br>${escapeHtml(value)}</p>`;
}

function detailBody(model) {
  const data = model.requests;
  if (data.missing) {
    return `<h1>Not found</h1><p class="lead">That report is not on file.</p><p class="actions"><a class="btn" href="/requests">Back to the queue</a></p>`;
  }
  const row = data.detail;
  const diagnostics = row.diagnostics || {};
  const log = diagnostics.log_excerpt
    ? `<section class="panel"><h2>Log</h2><pre class="logbox">${escapeHtml(diagnostics.log_excerpt)}</pre></section>`
    : `<section class="panel"><h2>Log</h2><p class="empty">No log was attached.</p></section>`;
  const shot = row.screenshot_key
    ? (data.showScreenshot
      ? `<section class="panel"><h2>Screenshot</h2><img class="shot" alt="Screenshot attached to this report" src="/requests/${Number(row.id)}/screenshot"></section>`
      : `<section class="panel"><h2>Screenshot</h2><p class="empty">Screenshot storage is not connected, so the image cannot be shown here.</p></section>`)
    : "";
  const similar = row.similar && row.similar.length
    ? `<section class="panel"><h2>Possible duplicates</h2><ul>${row.similar.map((item) => `<li><a href="/requests/${Number(item.id)}">HP-${Number(item.id)}</a> ${escapeHtml(item.title)}</li>`).join("")}</ul></section>`
    : "";
  return `<p class="actions"><a class="btn" href="/requests">Back to the queue</a></p>
    <h1>${escapeHtml(row.title)}${autoBadge(row)}</h1>
    <p class="meta">HP-${Number(row.id)} | ${escapeHtml(labelOf(SOURCE_LABELS, row.source))} | ${escapeHtml(labelOf(KIND_LABELS, row.kind))} | ${escapeHtml(issueLabel(row.issue_type))} | ${escapeHtml(row.created_at)}</p>
    <section class="panel stack">
      <h2>Status</h2>
      ${statusForm(row)}
      ${field("Screen", row.page_context)}
      ${field("Expected", row.expected_behavior)}
      ${field("Description", row.description)}
      ${field("App version", row.app_version)}
      ${field("OS", row.os)}
      ${field("Exception", row.exception_type)}
      ${field("On screen", diagnostics.screen)}
    </section>
    ${shot}
    ${log}
    ${similar}`;
}

function signatureTable(rows) {
  if (!rows || !rows.length) return "";
  const body = rows.map((row) => `<tr>
      <td>${escapeHtml(row.exception_type)}</td>
      <td class="num">${escapeHtml(String(row.count))}</td>
      <td>${escapeHtml(row.first_seen)}</td>
      <td>${escapeHtml(row.last_seen)}</td>
    </tr>`).join("");
  return `<section class="panel">
      <h2>Retained crash signatures</h2>
      <p class="note">Crash report bodies and screenshots older than 90 days are deleted. These rows keep the exception type and how many crashes shared it.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Exception</th><th class="num">Count</th><th>First seen</th><th>Last seen</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </section>`;
}

export function requestsBody(model) {
  const data = model.requests || { ready: false, mode: "list", filters: {}, groups: [], rows: [] };
  if (!data.ready) {
    return `<h1>Requests and reports</h1><p class="lead">Apply migrations 0004 and 0005 before this queue can load.</p>`;
  }
  if (data.mode === "detail") return detailBody(model);
  const filters = data.filters || { source: "", kind: "", status: "" };
  return `<h1>Requests and reports</h1>
    <p class="lead">Feature requests, bug reports, and crash reports from the app and the ISP preview. The default view groups them by issue type. Crash bodies older than 90 days are reduced to a signature and a count. Bug and feature reports older than 12 months are deleted.</p>
    ${filterForm(filters)}
    ${groupCards(data.groups || [])}
    <section class="panel">
      <h2>Reports</h2>
      ${listTable(data.rows || [])}
    </section>
    ${signatureTable(data.signatures)}`;
}
