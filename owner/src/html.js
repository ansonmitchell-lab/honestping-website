import { formatCell, formatCount, suppressSmallGroups } from "./kanon.js";
import { REQUESTS_CSS, requestsBody } from "./requests-html.js";
import { STATUSES } from "./queries.js";

export const CANT_SEE = "This dashboard can't see: IP addresses, who is behind an install, Wi-Fi names, devices on home networks, individual test results, precise location, browsing";
export const CONNECT_ANALYTICS = "Connect site analytics";
export const DOWNLOADS_NOT_CONNECTED = "not connected";
export const NOT_CONNECTED_YET = "Not connected yet";

const TABS = [
  ["overview", "/", "Overview"],
  ["waitlist", "/waitlist", "Waitlist"],
  ["isp", "/isp", "ISP"],
  ["traffic", "/traffic", "Traffic"],
  ["downloads", "/downloads", "Downloads"],
  ["requests", "/requests", "Requests and reports"],
  ["access", "/access", "Access log"],
];

const STATUS_LABELS = {
  new: "New",
  talking: "Talking",
  pilot: "Pilot",
  partner: "Partner",
};

const ACTION_LABELS = {
  view: "View",
  export: "Export",
  status: "Status change",
};

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortText(value, max) {
  const text = value == null ? "" : String(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function layout(tab, email, body, warning) {
  const nav = TABS.map(([id, href, label]) => {
    const current = id === tab ? ' aria-current="page"' : "";
    return `<a class="nav-link${id === tab ? " active" : ""}" href="${href}"${current}>${label}</a>`;
  }).join("");
  const banner = warning ? `<p class="banner">${escapeHtml(warning)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>HonestPing owner</title>
  <style>
    :root {
      --hp-bg: #07131f;
      --hp-surface: #0d1e2e;
      --hp-subtle: #122a3a;
      --hp-text: #edf5fa;
      --hp-muted: #abc0ce;
      --hp-line: #203c4e;
      --hp-green: #45e5ad;
      --hp-brand: #00e6a6;
      --hp-cyan: #05d1e8;
      --hp-amber: #ffc478;
      --hp-amber-bg: #32281c;
      --hp-primary-text: #03271e;
      --font: "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font);
      font-size: 15px;
      line-height: 1.5;
      color: var(--hp-text);
      background: var(--hp-bg);
      color-scheme: dark;
    }
    a { color: var(--hp-cyan); text-decoration: none; }
    a:hover { text-decoration: underline; }
    a:focus-visible, button:focus-visible, select:focus-visible {
      outline: 3px solid var(--hp-cyan);
      outline-offset: 3px;
    }
    .skip {
      position: absolute;
      left: -9999px;
      top: 0;
      background: var(--hp-brand);
      color: var(--hp-primary-text);
      padding: 8px 12px;
      font-weight: 600;
    }
    .skip:focus { left: 12px; top: 12px; z-index: 5; }
    header {
      border-bottom: 1px solid var(--hp-line);
      background: rgba(7, 19, 31, 0.94);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .bar, main { width: min(1120px, calc(100% - 2rem)); margin: 0 auto; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding: 14px 0; }
    .brand { color: var(--hp-text); font-weight: 650; letter-spacing: -0.3px; }
    .brand span { color: var(--hp-brand); font-weight: 600; }
    nav { display: flex; flex-wrap: wrap; gap: 4px; }
    .nav-link { color: var(--hp-muted); padding: 6px 10px; border-radius: 6px; }
    .nav-link:hover { color: var(--hp-text); background: var(--hp-subtle); text-decoration: none; }
    .nav-link.active { color: var(--hp-primary-text); background: var(--hp-brand); }
    .who { margin-left: auto; color: var(--hp-muted); font-size: 13px; }
    .cant-see {
      width: min(1120px, calc(100% - 2rem));
      margin: 16px auto 0;
      padding: 10px 12px;
      border: 1px solid var(--hp-line);
      border-left: 3px solid var(--hp-brand);
      border-radius: 8px;
      color: var(--hp-muted);
      background: var(--hp-surface);
      font-size: 13px;
    }
    main { padding: 18px 0 48px; }
    h1 { font-size: 1.35rem; font-weight: 650; margin: 0 0 6px; }
    h2 { font-size: 0.95rem; font-weight: 650; margin: 0 0 8px; }
    p { margin: 0; }
    .lead { color: var(--hp-muted); margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 16px 0; }
    .card, .panel {
      background: var(--hp-surface);
      border: 1px solid var(--hp-line);
      border-radius: 12px;
      padding: 14px;
    }
    .metric { font-size: 1.8rem; font-weight: 650; letter-spacing: -0.4px; margin: 4px 0; }
    .status-line { font-size: 1.05rem; font-weight: 650; color: var(--hp-green); margin: 4px 0; }
    .note, .empty { color: var(--hp-muted); font-size: 13px; }
    .panels { display: grid; gap: 12px; }
    .banner {
      margin: 0 0 14px;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--hp-amber-bg);
      color: var(--hp-amber);
    }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--hp-line); vertical-align: top; }
    th { color: var(--hp-muted); font-size: 12px; font-weight: 650; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .message { white-space: pre-wrap; max-width: 28rem; }
    form.status { display: flex; gap: 6px; align-items: center; }
    select, button {
      font: inherit;
      color: var(--hp-text);
      background: var(--hp-subtle);
      border: 1px solid var(--hp-line);
      border-radius: 8px;
      padding: 6px 8px;
    }
    button { font-weight: 650; cursor: pointer; }
    button:hover, select:hover { border-color: var(--hp-cyan); }
    .actions { margin: 8px 0 14px; }
    .btn {
      display: inline-flex;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--hp-line);
      background: var(--hp-subtle);
      color: var(--hp-text);
      font-weight: 650;
    }
    .btn:hover { border-color: var(--hp-cyan); text-decoration: none; }
    .denied { width: min(36rem, calc(100% - 2rem)); margin: 12vh auto; }
    footer { margin: 0; padding: 8px 22px 28px; color: var(--hp-muted); font-size: 12px; }
    ${REQUESTS_CSS}
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header>
    <div class="bar">
      <div class="brand">HonestPing <span>Owner</span></div>
      <nav>${nav}</nav>
      <p class="who">Signed in as ${escapeHtml(email)}</p>
    </div>
  </header>
  <p class="cant-see">${escapeHtml(CANT_SEE)}</p>
  <main id="main">
    ${banner}
    ${body}
  </main>
  <footer>© <span id="year">2026</span> Honest Ping LLC</footer>
</body>
</html>`;
}

function card(title, value, note) {
  const big = value === "Hidden" || value === "None yet" || /^[0-9]+$/.test(value);
  const valueHtml = big
    ? `<p class="metric">${escapeHtml(value)}</p>`
    : `<p class="status-line">${escapeHtml(value)}</p>`;
  return `<section class="card"><h2>${escapeHtml(title)}</h2>${valueHtml}<p class="note">${escapeHtml(note)}</p></section>`;
}

function statusGroups(groups) {
  return (groups || []).map((row) => ({
    label: STATUS_LABELS[row.label] || row.label,
    count: row.count,
  }));
}

function groupTable(caption, groups) {
  const rows = suppressSmallGroups(groups);
  if (!rows.length) return `<section class="panel"><h2>${escapeHtml(caption)}</h2><p class="empty">None in this range yet.</p></section>`;
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.hidden ? "Hidden" : shortText(row.label, 180))}</td><td class="num">${escapeHtml(formatCell(row.count))}</td></tr>`).join("");
  return `<section class="panel"><h2>${escapeHtml(caption)}</h2><p class="note">Groups under 5 are hidden.</p><div class="table-wrap"><table><thead><tr><th>Group</th><th class="num">Count</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

function placeholder(title, line) {
  return card(title, NOT_CONNECTED_YET, line);
}

function reportsCard(feedback) {
  if (!feedback || !feedback.ready) {
    return card("Requests and reports", "Migration needed", "Apply migrations 0004 and 0005 before reports can load.");
  }
  const note = `${feedback.features} features, ${feedback.bugs} bugs, ${feedback.crashes} crashes.`;
  return `<section class="card"><h2>Requests and reports</h2><p class="metric">${escapeHtml(String(feedback.total))}</p><p class="note">${escapeHtml(note)} <a href="/requests">Open the review queue.</a></p></section>`;
}

function trafficCards(traffic) {
  if (!traffic || !traffic.connected) {
    return card("Site traffic", CONNECT_ANALYTICS, "Visits, page views, top pages, and countries for honestping.com.");
  }
  if (traffic.error) return card("Site traffic", "Could not be loaded", "Site analytics could not be loaded.");
  return [
    card("Visits", formatCount(traffic.visits), "Sum of daily unique visitors over the last 7 days. A person who visits on two days is counted twice."),
    card("Page views", formatCount(traffic.pageViews), "Page views over the last 7 days."),
  ].join("");
}

function downloadCard(downloads) {
  if (!downloads || !downloads.connected) {
    return card("Downloads", DOWNLOADS_NOT_CONNECTED, "Asset download counts from the app repo's public GitHub releases.");
  }
  if (downloads.error) return card("Downloads", "Could not be loaded", "GitHub releases could not be loaded.");
  if (downloads.missing) return card("Downloads", "No public releases", "No public releases were found for that repo.");
  if (downloads.empty) return card("Downloads", "No public releases", "No public releases yet.");
  if (downloads.noFiles) return card("Downloads", "No release files", "Releases are published, and none of them has a file yet.");
  const total = (downloads.groups || []).reduce((sum, group) => sum + (Number(group.count) || 0), 0);
  return card("Downloads", formatCount(total), "Asset download counts from public GitHub releases. Open Downloads for each file.");
}

function overviewBody(model) {
  const data = model.overview;
  return `
    <h1>Overview</h1>
    <p class="lead">Totals from the waitlist, the ISP form, and the connections you choose to add. Emails stay on the Waitlist and ISP tabs.</p>
    <div class="grid">
      ${card("Waitlist", formatCount(data.waitlistTotal), "People who asked to hear when HonestPing is ready.")}
      ${card("ISP inquiries", formatCount(data.ispTotal), "Partnership notes sent from the site.")}
      ${trafficCards(data.traffic)}
      ${downloadCard(data.downloads)}
      ${reportsCard(data.feedback)}
      ${placeholder("Sales", "Purchases and plan totals will appear here.")}
    </div>
    <div class="panels">
      ${groupTable("Sign-ups by day", data.days)}
      ${groupTable("Sign-ups by week", data.weeks)}
      ${groupTable("Sign-ups by page", data.sources)}
      ${data.statusesReady ? groupTable("ISP status", statusGroups(data.statuses)) : `<section class="panel"><h2>ISP status</h2><p class="empty">Apply the owner migration before status totals can load.</p></section>`}
    </div>`;
}

function listTable(headers, rowsHtml) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function waitlistBody(model) {
  const rows = model.waitlist.rows || [];
  const body = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.created_at)}</td><td>${escapeHtml(row.source_page)}</td></tr>`).join("")
    : `<tr><td colspan="3">No waitlist sign-ups yet.</td></tr>`;
  return `
    <h1>Waitlist</h1>
    <p class="lead">Addresses people submitted. The rows are the submissions. Aggregate counts under 5 stay hidden.</p>
    <p class="actions"><a class="btn" href="/export/waitlist.csv">Download CSV</a></p>
    <section class="panel">
      <h2>Total</h2>
      <p class="metric">${escapeHtml(formatCount(model.waitlist.total))}</p>
      ${listTable(["Email", "Signed up", "Source page"], body)}
    </section>`;
}

function statusForm(row) {
  const status = STATUSES.includes(row.status) ? row.status : "new";
  const options = STATUSES.map((value) => {
    const selected = value === status ? " selected" : "";
    return `<option value="${value}"${selected}>${STATUS_LABELS[value]}</option>`;
  }).join("");
  const label = row.company ? `Status for ${row.company}` : "Status";
  return `<form class="status" method="post" action="/isp/status">
    <input type="hidden" name="inquiry_id" value="${escapeHtml(row.id)}">
    <select name="status" aria-label="${escapeHtml(label)}">${options}</select>
    <button type="submit">Save</button>
  </form>`;
}

function ispBody(model) {
  const rows = model.isp.rows || [];
  const readyNote = model.isp.ready
    ? ""
    : `<p class="banner">Apply the owner migration before status can be saved.</p>`;
  const body = rows.length
    ? rows.map((row) => `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.company)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.subscribers)}</td>
        <td class="message">${escapeHtml(row.message)}</td>
        <td>${escapeHtml(row.created_at)}</td>
        <td>${escapeHtml(row.source_page)}</td>
        <td>${model.isp.ready ? statusForm(row) : escapeHtml(STATUS_LABELS[row.status] || row.status)}</td>
      </tr>`).join("")
    : `<tr><td colspan="8">No ISP inquiries yet.</td></tr>`;
  return `
    <h1>ISP</h1>
    <p class="lead">Partnership notes from the site. Status is the only field this dashboard writes.</p>
    <p class="actions"><a class="btn" href="/export/isp.csv">Download CSV</a></p>
    ${readyNote}
    <section class="panel">
      <h2>Total</h2>
      <p class="metric">${escapeHtml(formatCount(model.isp.total))}</p>
      ${model.isp.ready ? groupTable("By status", statusGroups(model.isp.statuses)) : ""}
      ${listTable(["Name", "Company", "Email", "Subscribers", "Message", "Signed up", "Source page", "Status"], body)}
    </section>`;
}

function trafficBody(model) {
  const traffic = model.traffic;
  if (!traffic || !traffic.connected) {
    return `
      <h1>Traffic</h1>
      <div class="grid">${card("Site traffic", CONNECT_ANALYTICS, "Visits, page views, top pages, and countries for honestping.com.")}</div>`;
  }
  if (traffic.error) {
    return `<h1>Traffic</h1><p class="lead">Site analytics could not be loaded.</p>`;
  }
  const pages = traffic.pagesError
    ? `<section class="panel"><h2>Top pages</h2><p class="empty">Top pages could not be loaded.</p></section>`
    : groupTable("Top pages", traffic.pages);
  return `
    <h1>Traffic</h1>
    <p class="lead">Cookieless totals for the honestping.com zone over the last 7 days. There is no visitor list.</p>
    <div class="grid">
      ${card("Visits", formatCount(traffic.visits), "Sum of daily unique visitors. A person who visits on two days is counted twice.")}
      ${card("Page views", formatCount(traffic.pageViews), "Page views over the last 7 days.")}
    </div>
    <div class="panels">
      ${groupTable("Visits by day", traffic.days)}
      ${pages}
      ${groupTable("Countries", traffic.countries)}
    </div>`;
}

function downloadsBody(model) {
  const downloads = model.downloads;
  if (!downloads || !downloads.connected) {
    return `<h1>Downloads</h1><div class="grid">${card("Downloads", DOWNLOADS_NOT_CONNECTED, "Asset download counts from the app repo's public GitHub releases.")}</div>`;
  }
  if (downloads.error) return `<h1>Downloads</h1><p class="lead">GitHub releases could not be loaded.</p>`;
  if (downloads.missing) return `<h1>Downloads</h1><p class="lead">No public releases were found for that repo.</p>`;
  if (downloads.empty) return `<h1>Downloads</h1><p class="lead">No public releases yet.</p>`;
  if (downloads.noFiles) return `<h1>Downloads</h1><p class="lead">Releases are published, and none of them has a file yet.</p>`;
  return `
    <h1>Downloads</h1>
    <p class="lead">Download counts for files on the public GitHub releases. Groups under 5 are hidden.</p>
    ${groupTable("Release files", downloads.groups)}`;
}

function detailText(detail) {
  const labels = {
    overview: "Overview",
    waitlist: "Waitlist",
    isp: "ISP",
    traffic: "Traffic",
    downloads: "Downloads",
    requests: "Requests and reports",
    access: "Access log",
  };
  return labels[detail] || detail;
}

function accessBody(model) {
  if (!model.access.ready) {
    return `<h1>Access log</h1><p class="lead">Apply the owner migration before this log can load.</p>`;
  }
  const rows = model.access.rows || [];
  const body = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(row.created_at)}</td><td>${escapeHtml(row.actor_email)}</td><td>${escapeHtml(ACTION_LABELS[row.action] || row.action)}</td><td>${escapeHtml(detailText(row.detail))}</td></tr>`).join("")
    : `<tr><td colspan="4">No dashboard activity yet.</td></tr>`;
  return `
    <h1>Access log</h1>
    <p class="lead">Each view, CSV export, and status change, with the Access email and the time.</p>
    <section class="panel">${listTable(["When", "Access email", "Action", "Detail"], body)}</section>`;
}

function messageBody(title, message) {
  return `<h1>${escapeHtml(title)}</h1><p class="lead">${escapeHtml(message)}</p>`;
}

function tabBody(model) {
  if (model.tab === "overview") return overviewBody(model);
  if (model.tab === "waitlist") return waitlistBody(model);
  if (model.tab === "isp") return ispBody(model);
  if (model.tab === "traffic") return trafficBody(model);
  if (model.tab === "downloads") return downloadsBody(model);
  if (model.tab === "requests") return requestsBody(model);
  if (model.tab === "access") return accessBody(model);
  return messageBody(model.title || "Notice", model.message || "");
}

export function renderDashboard(model) {
  const body = model.notice ? messageBody(model.title || "Notice", model.message || "") : tabBody(model);
  return layout(model.tab, model.email, body, model.warning);
}

export function renderDenied() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Sign in required</title>
  <style>
    body { margin: 0; background: #07131f; color: #edf5fa; font: 16px/1.5 "Segoe UI", system-ui, sans-serif; }
    main { width: min(36rem, calc(100% - 2rem)); margin: 12vh auto; }
    h1 { font-size: 1.4rem; font-weight: 650; }
    p, footer { color: #abc0ce; }
    footer { margin: 24px; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Sign in required</h1>
    <p>Cloudflare Access did not accept this request.</p>
    <p>${escapeHtml(CANT_SEE)}</p>
  </main>
  <footer>© <span id="year">2026</span> Honest Ping LLC</footer>
</body>
</html>`;
}
