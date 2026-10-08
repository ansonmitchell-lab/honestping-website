import { ISP_ISSUE_TYPES, ISSUE_LABELS } from "../functions/lib/feedback-contract.js";
import { resolveKMin, showGroupCount } from "../functions/lib/k-min.js";

export const HELP_COPY = {
  claim_queue: "The queue collects reports your customers chose to share. Evidence levels show which slowdowns other homes saw in the same hours, so your team can start with those.",
  claim_detail: "Claim detail puts one 7-day report next to your outage log. You can see whether the slow hours match a node, then choose the next step for that customer.",
  node_health: "Node health shows how a node did across the week. When several homes dip in the same hours, the useful next step is capacity on that node.",
  settings: "Settings is where your team chooses who can open the dashboard and which view they land on. The right access keeps claim checks with the people who act on them.",
};

const VIEWS = [
  { id: "claim_queue", nav: "network", label: "Claim queue", issue: "claim_queue", helpKey: "claim_queue" },
  { id: "claim_detail", nav: "network", label: "Claim detail", issue: "claim_detail", helpKey: "claim_detail" },
  { id: "node_health", nav: "network", label: "Node health", issue: "node_health", helpKey: "node_health" },
  { id: "settings", nav: "support", label: "Settings", issue: "settings_access", helpKey: "settings" },
];

const CLAIMS = [
  {
    id: "1042",
    when: "Today 9:12 AM",
    kind: "7-day report",
    where: "Area 3, Node 3B",
    title: "Evenings run well under plan",
    range: "Oct 5 to 11",
    account: "Customer account ending 4471 (added by the customer)",
    plan: "500 Mbps",
    typical: "91% of plan",
    slowLabel: "4 slow evenings",
    slow: "58 to 72%",
    tests: "21 of 21",
    note: "Calls keep dropping in the evening, mornings are fine.",
    level: "Backed by area data",
    tone: "g",
    nearbyHouseholds: 14,
    reasons: [
      "Your outage log shows 2 Node 3B utilization alerts matching those evenings.",
      "Every slow test was past the router: wired, PC idle, no VPN.",
    ],
    levelNote: "Points to shared capacity on this node. The level is the same for every provider.",
    checks: [
      ["Connection", "Wired, 1 Gbps link"],
      ["PC load", "Idle during every test"],
      ["VPN", "None detected"],
      ["Router", "Gateway ping 1 ms, port 1 Gbps"],
      ["Test servers", "3 servers agree within 4%"],
    ],
    summary: "All 4 slow evening tests were past the router",
    next: "Check Node 3B evening capacity",
    why: "The same dip shows up across the node. Claim 1031 is on the same node.",
  },
  {
    id: "1039",
    when: "Today 8:40 AM",
    kind: "7-day report",
    where: "Area 1, Node 1A",
    title: "A clean week on a quiet node",
    range: "Oct 5 to 11",
    plan: "300 Mbps",
    typical: "96% of plan",
    slowLabel: "Slow evenings",
    slow: "None",
    tests: "21 of 21",
    note: "The customer asked for a check after a router swap.",
    level: "Isolated, worth a tech check",
    tone: "t",
    reasons: ["Area data stays steady while this report is clean."],
    levelNote: "A clean report that area data does not repeat.",
    next: "Confirm the new router, then close the check if the week stays clean.",
    why: "Nothing in the area data asks for a node change.",
  },
  {
    id: "1037",
    when: "Yesterday",
    kind: "One-time test",
    where: "Area 2",
    title: "One slow test on Wi-Fi",
    plan: "500 Mbps",
    typical: "88% of plan",
    slowLabel: "Slow tests",
    slow: "1 of 1",
    tests: "1 of 1",
    note: "The test ran on Wi-Fi in the far room.",
    level: "Points to home network",
    tone: "a",
    reasons: ["The slow test traces to Wi-Fi on this visit."],
    levelNote: "Home-side checks explain this one.",
    next: "Share the home-side result with the customer.",
    why: "A single Wi-Fi test is a home follow-up.",
  },
  {
    id: "1033",
    when: "Yesterday",
    kind: "7-day report, day 3 of 7",
    where: "Area 4",
    title: "Waiting on a full week",
    plan: "200 Mbps",
    typical: "90% of plan",
    slowLabel: "Slow evenings",
    slow: "1 so far",
    tests: "9 of 9",
    note: "The report is still filling in.",
    level: "Can't verify yet",
    tone: "n",
    reasons: ["Three days are in. A full 7-day report will say more."],
    levelNote: "The report itself is still thin.",
    next: "Wait for the rest of the week before a node change.",
    why: "A short report keeps the level at can't verify yet.",
  },
  {
    id: "1031",
    when: "Oct 9",
    kind: "7-day report",
    where: "Area 3, Node 3B",
    title: "Same evening dip as claim 1042",
    plan: "500 Mbps",
    typical: "89% of plan",
    slowLabel: "3 slow evenings",
    slow: "60 to 74%",
    tests: "21 of 21",
    note: "Evenings are the hard hours.",
    level: "Backed by area data",
    tone: "g",
    reasons: ["Neighbors on Node 3B dipped in the same hours."],
    levelNote: "Same node as claim 1042.",
    next: "Group this with claim 1042 when you check Node 3B.",
    why: "Homes on this node saw the same evenings.",
  },
  {
    id: "1029",
    when: "Oct 9",
    kind: "One-time test",
    where: "Area 1",
    title: "A single test from the home",
    plan: "300 Mbps",
    typical: "70% of plan",
    slowLabel: "Slow tests",
    slow: "1 of 1",
    tests: "1 of 1",
    note: "Ran once from a laptop on Wi-Fi.",
    level: "Points to home network",
    tone: "a",
    reasons: ["The test points at Wi-Fi in the home."],
    levelNote: "One test, home side.",
    next: "Ask for a wired retest if the customer wants a second look.",
    why: "A wired retest gives the next check a firmer level.",
  },
];

const PAGE_DATA = {
  help: HELP_COPY,
  views: VIEWS,
  claims: CLAIMS,
  node: {
    name: "Node 3B",
    area: "Area 3",
    householdCount: 14,
    week: "Tuesday and Thursday evenings dipped together across the example group.",
    suggestion: "Check evening capacity on Node 3B while claim 1042 and claim 1031 are open.",
  },
};

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function issueOptions() {
  return ISP_ISSUE_TYPES.map((id) => `<option value="${id}">${ISSUE_LABELS[id]}</option>`).join("");
}

function previewModel(kMin) {
  const claims = CLAIMS.map((claim) => {
    if (!claim.nearbyHouseholds) return claim;
    const shown = showGroupCount(claim.nearbyHouseholds, kMin);
    const line = shown
      ? `${shown} nearby households on Node 3B dipped in the same evening hours.`
      : "Nearby households on Node 3B dipped in the same evening hours.";
    const next = { ...claim, reasons: [line, ...claim.reasons] };
    delete next.nearbyHouseholds;
    return next;
  });
  const shownHouseholds = showGroupCount(PAGE_DATA.node.householdCount, kMin);
  const node = { ...PAGE_DATA.node, households: shownHouseholds ? `${shownHouseholds} households` : "Hidden" };
  delete node.householdCount;
  return { help: PAGE_DATA.help, views: PAGE_DATA.views, claims, node };
}

export function renderIspPreview(options = {}) {
  const kMin = resolveKMin(options.kMin);
  const data = JSON.stringify(previewModel(kMin)).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>HonestPing for ISPs preview</title>
  <style>
    :root { --bg:#07131f; --card:#0d1e2e; --sub:#122a3a; --face:#071c25; --txt:#edf5fa; --mut:#abc0ce; --dim:#829aaa; --bor:#203c4e; --acc:#71def0; --grn:#45e5ad; --amb:#ffc478; --red:#ff8d9b; --gbg:#102e2b; --abg:#32281c; --bbg:#103641; --tbg:#0f3340; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--txt); font-family: "Segoe UI", system-ui, sans-serif; font-size: 14px; line-height: 1.45; }
    button, input, select, textarea { font: inherit; color: inherit; }
    button { cursor: pointer; }
    a { color: var(--acc); }
    .top { display: flex; align-items: center; gap: 18px; padding: 14px 28px; border-bottom: 1px solid var(--bor); background: #081826; position: sticky; top: 0; z-index: 2; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
    .brand .dom { color: var(--acc); }
    .brand small { color: var(--mut); font-weight: 400; margin-left: 4px; }
    .nav, .sub { display: flex; gap: 6px; flex-wrap: wrap; }
    .nav button, .sub button, .help-btn, .btn { border: 1px solid transparent; background: transparent; color: var(--mut); border-radius: 8px; padding: 7px 12px; }
    .nav button[aria-current="page"], .sub button[aria-current="page"] { background: var(--sub); color: var(--txt); font-weight: 700; }
    .who { margin-left: auto; color: var(--mut); display: flex; align-items: center; gap: 8px; }
    .av { width: 26px; height: 26px; border-radius: 50%; background: var(--bbg); border: 1px solid var(--acc); color: var(--acc); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
    .help-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--acc); color: var(--acc); background: var(--bbg); font-weight: 700; padding: 0; }
    .banner, .note-row, footer { color: var(--dim); font-size: 12px; }
    .banner { margin: 14px 28px 0; padding: 8px 12px; border: 1px solid var(--bor); border-left: 3px solid var(--acc); border-radius: 8px; background: var(--card); }
    .sub { padding: 12px 28px 0; }
    .wrap { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; padding: 16px 28px 8px; }
    .card { background: var(--card); border: 1px solid var(--bor); border-radius: 12px; padding: 16px 18px; position: relative; }
    .ex { position: absolute; top: 12px; right: 12px; font-size: 11px; font-weight: 700; color: var(--acc); background: var(--bbg); border: 1px solid #3496a0; border-radius: 10px; padding: 1px 8px; }
    .h { font-weight: 700; font-size: 15px; }
    .s, .meta { color: var(--mut); font-size: 12px; }
    .qi { width: 100%; text-align: left; border: 1px solid var(--bor); border-radius: 10px; padding: 10px 12px; margin-top: 10px; background: var(--face); color: inherit; }
    .qi.sel { border-color: var(--acc); background: var(--tbg); }
    .r1 { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--mut); }
    .r1 b { color: var(--txt); font-size: 13px; }
    .lv { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; border-radius: 10px; padding: 2px 9px; border: 1px solid; margin-top: 6px; }
    .lv i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .lv.g { color: var(--grn); background: var(--gbg); border-color: #2a8a6e; } .lv.g i { background: var(--grn); }
    .lv.t { color: var(--acc); background: var(--bbg); border-color: #3496a0; } .lv.t i { background: var(--acc); }
    .lv.a { color: var(--amb); background: var(--abg); border-color: #8a6a3e; } .lv.a i { background: var(--amb); }
    .lv.n { color: var(--mut); background: var(--sub); border-color: #3a5a6e; } .lv.n i { background: var(--dim); }
    .main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .row { display: grid; gap: 16px; }
    .split { grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); }
    .title { font-size: 22px; font-weight: 700; margin: 6px 0 0; }
    .kv, .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
    .stats { grid-template-columns: repeat(3, 1fr); }
    .kv div, .stats div { background: var(--face); border: 1px solid var(--bor); border-radius: 9px; padding: 9px 11px; }
    .kv span, .stats span { display: block; font-size: 11px; color: var(--mut); }
    .kv b, .stats b { display: block; margin-top: 2px; }
    .quote { margin-top: 12px; color: var(--mut); border-left: 3px solid var(--acc); padding-left: 10px; }
    .badge { display: inline-flex; align-items: center; gap: 8px; background: var(--gbg); border: 1.5px solid var(--grn); color: var(--grn); border-radius: 12px; padding: 9px 14px; font-weight: 700; margin-top: 10px; }
    .badge.t { background: var(--bbg); border-color: var(--acc); color: var(--acc); }
    .badge.a { background: var(--abg); border-color: var(--amb); color: var(--amb); }
    .badge.n { background: var(--sub); border-color: #3a5a6e; color: var(--mut); }
    ul.clean { margin: 12px 0 0; padding: 0; list-style: none; }
    ul.clean li { margin-top: 7px; padding-left: 14px; position: relative; }
    ul.clean li:before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--grn); position: absolute; left: 0; top: 7px; }
    .ck { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid var(--bor); }
    .ck:first-child { border-top: 0; }
    .ic { width: 22px; height: 22px; border-radius: 50%; background: var(--gbg); color: var(--grn); display: grid; place-items: center; font-weight: 700; flex: none; }
    .ck .res { margin-left: auto; color: var(--grn); font-size: 12px; font-weight: 700; }
    .sum { color: var(--grn); font-weight: 700; margin-top: 8px; }
    .btn.p { background: var(--acc); color: #04222a; border-color: var(--acc); font-weight: 700; }
    .btn.ghost { background: var(--sub); border-color: var(--bor); color: var(--txt); font-weight: 700; }
    .note-row { padding: 8px 28px 0; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
    footer { padding: 8px 28px 28px; }
    .text-btn { background: none; border: 0; color: var(--acc); padding: 0; font-weight: 700; }
    #help { position: fixed; top: 0; right: 0; height: 100%; width: min(400px, 100%); background: #0d1e2e; border-left: 1px solid var(--bor); z-index: 5; padding: 18px; overflow: auto; box-shadow: -12px 0 40px rgba(0,0,0,.35); }
    #help[hidden] { display: none; }
    .help-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .help-actions, .form-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    form label { display: grid; gap: 4px; margin-top: 12px; font-size: 12px; color: var(--mut); font-weight: 700; }
    input, select, textarea { background: var(--face); border: 1px solid var(--bor); border-radius: 8px; padding: 8px 10px; }
    textarea { min-height: 96px; resize: vertical; }
    #help-result { min-height: 1.4em; margin-top: 12px; font-weight: 700; }
    .bridge { margin-top: 12px; min-height: 12px; }
    @media (max-width: 900px) {
      .wrap, .split, .kv { grid-template-columns: 1fr; }
      .top { flex-wrap: wrap; }
      .who { margin-left: 0; }
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="brand">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M4 18 A9.5 9.5 0 1 1 22 18" fill="none" stroke="#71def0" stroke-width="2.6" stroke-linecap="round"/><line x1="13" y1="15" x2="18" y2="9" stroke="#edf5fa" stroke-width="2.4" stroke-linecap="round"/><circle cx="13" cy="15" r="2.4" fill="#edf5fa"/></svg>
      <span class="dom">honestping.com</span><small>for ISPs</small>
    </div>
    <nav class="nav" aria-label="Views">
      <button type="button" id="nav-network" data-nav="network">Network admin</button>
      <button type="button" id="nav-support" data-nav="support">Support</button>
    </nav>
    <div class="who">Network team <div class="av" aria-hidden="true">NT</div>
      <button type="button" class="help-btn" id="help-open" aria-controls="help" aria-expanded="false" aria-label="Help">?</button>
    </div>
  </header>
  <p class="banner">Example data. Every claim, node, and household on this page is invented.</p>
  <div class="sub" id="subnav"></div>
  <div class="wrap" id="stage"></div>
  <div class="note-row">
    <span>Example data for illustration only. No real provider, customer, or place. Neighbor data is anonymous and shown only for groups of ${kMin} or more households.</span>
    <button type="button" class="text-btn" id="footer-bug">Report a bug</button>
  </div>
  <footer>© <span id="year">2026</span> Honest Ping LLC</footer>
  <aside id="help" hidden role="dialog" aria-labelledby="help-title" tabindex="-1">
    <div class="help-head">
      <h2 id="help-title">Help</h2>
      <button type="button" class="btn ghost" id="help-close">Close</button>
    </div>
    <p id="help-screen" class="meta"></p>
    <p id="help-copy"></p>
    <div class="help-actions">
      <button type="button" class="btn p" id="open-feature">Suggest a feature</button>
      <button type="button" class="btn ghost" id="open-bug">Report a bug</button>
    </div>
    <form id="feature-form" hidden>
      <label>Title<input name="title" maxlength="80" required autocomplete="off"></label>
      <label>Description<textarea name="description" maxlength="2000"></textarea></label>
      <label>Screenshot, optional<input name="screenshot" type="file" accept="image/png,image/jpeg"></label>
      <div class="form-actions"><button class="btn p" type="submit">Send feature idea</button></div>
    </form>
    <form id="bug-form" hidden>
      <label>Issue type<select name="issue_type" id="bug-issue">${issueOptions()}</select></label>
      <label>Title<input name="title" maxlength="80" required autocomplete="off"></label>
      <label>Description<textarea name="description" maxlength="2000"></textarea></label>
      <label>What did you expect?<textarea name="expected_behavior" maxlength="2000"></textarea></label>
      <label>Screenshot, optional<input name="screenshot" type="file" accept="image/png,image/jpeg"></label>
      <div class="form-actions"><button class="btn p" type="submit">Send bug report</button></div>
    </form>
    <p class="meta">If this does not send, email <a href="mailto:hello@honestping.com">hello@honestping.com</a>.</p>
    <p id="help-result" role="status"></p>
  </aside>
  <script type="application/json" id="isp-data">${data}</script>
  <script>
${CLIENT_SOURCE}
  </script>
</body>
</html>`;
}

const CLIENT_SOURCE = `
(function () {
  var data = JSON.parse(document.getElementById("isp-data").textContent);
  var state = { view: "claim_detail", claim: "1042", form: "", sending: false };
  var panels = {};
  var stage = document.getElementById("stage");
  var help = document.getElementById("help");
  var helpOpen = document.getElementById("help-open");

  window.HONESTPING_ISP = {
    example: true,
    get view() { return state.view; },
    registerPanel: function (name, render) {
      panels[name] = render;
      mountBridges();
    }
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function viewMeta(id) {
    for (var i = 0; i < data.views.length; i += 1) {
      if (data.views[i].id === id) return data.views[i];
    }
    return data.views[0];
  }
  function claimById(id) {
    for (var i = 0; i < data.claims.length; i += 1) {
      if (data.claims[i].id === id) return data.claims[i];
    }
    return data.claims[0];
  }
  function level(claim) {
    return '<span class="lv ' + claim.tone + '"><i></i>' + esc(claim.level) + "</span>";
  }
  function badge(claim) {
    return '<div class="badge ' + claim.tone + '">' + esc(claim.level) + "</div>";
  }
  function queueItem(claim) {
    var sel = claim.id === state.claim ? " sel" : "";
    return '<button type="button" class="qi' + sel + '" data-claim="' + esc(claim.id) + '"><div class="r1"><b>Claim ' + esc(claim.id) + "</b><span>" + esc(claim.when) + '</span></div><div class="s">' + esc(claim.kind) + " · " + esc(claim.where) + "</div>" + level(claim) + "</button>";
  }
  function kv(label, value, hot) {
    return "<div><span>" + esc(label) + "</span><b" + (hot ? ' style="color:#ff8d9b"' : "") + ">" + esc(value) + "</b></div>";
  }
  function detail(claim) {
    var facts = kv("Plan", claim.plan) + kv("Typical (median)", claim.typical) + kv(claim.slowLabel, claim.slow, true) + kv("Valid tests", claim.tests);
    var reasons = (claim.reasons || []).map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("");
    var checks = (claim.checks || []).map(function (row) {
      return '<div class="ck"><div class="ic">&#10003;</div><div><b>' + esc(row[0]) + '</b><div class="s">' + esc(row[1]) + '</div></div><div class="res">Not the cause</div></div>';
    }).join("");
    var checkCard = checks ? '<div class="card"><span class="ex">Example</span><div class="h">Home-side checks</div><div class="s">Ruled out for the slow tests</div>' + checks + (claim.summary ? '<div class="sum">' + esc(claim.summary) + "</div>" : "") + "</div>" : "";
    return '<div class="row split"><article class="card"><span class="ex">Example</span><div class="s">CLAIM ' + esc(claim.id) + " · RECEIVED " + esc(claim.when).toUpperCase() + " · SHARED BY CODE</div><h2 class='title'>" + esc(claim.title) + "</h2><p class='s'>" + esc(claim.kind) + (claim.range ? ", " + esc(claim.range) : "") + (claim.account ? " · " + esc(claim.account) : "") + (claim.where ? " · " + esc(claim.where) : "") + '</p><div class="kv">' + facts + '</div><p class="quote"><b>Customer note:</b> "' + esc(claim.note) + '"</p></article><article class="card"><span class="ex">Example</span><div class="h">Evidence level</div>' + badge(claim) + '<ul class="clean">' + reasons + '</ul><p class="s">' + esc(claim.levelNote || "") + "</p></article></div>" + checkCard + '<article class="card"><span class="ex">Example</span><div class="h">Suggested next step</div><p class="title" style="font-size:18px">' + esc(claim.next || "Review the evidence") + '</p><p class="s">' + esc(claim.why || "") + '</p><p class="s">Any credit or offer is your call, applied in your own billing.</p><div id="panel-trace" class="bridge" data-bridge="trace-to-node"></div></article>';
  }
  function claimsView() {
    var claim = claimById(state.claim);
    var items = data.claims.map(queueItem).join("");
    return '<aside class="card"><span class="ex">Example</span><button type="button" class="text-btn" id="focus-queue" style="font-size:15px">Incoming claims</button><p class="s">Shared by customers with their OK</p>' + items + '<p class="s" style="margin-top:12px">Missing neighbor data never lowers a level.</p></aside><div class="main">' + detail(claim) + "</div>";
  }
  function chart() {
    return '<svg viewBox="0 0 320 120" width="100%" height="120" role="img" aria-label="Example week on Node 3B"><polyline fill="none" stroke="#829aaa" stroke-dasharray="5 4" stroke-width="2" points="10,30 55,28 100,70 145,26 190,78 235,34 280,30 310,28"/><polyline fill="none" stroke="#71def0" stroke-width="2.5" points="10,24 55,22 100,84 145,20 190,90 235,28 280,24 310,22"/></svg>';
  }
  function nodeView() {
    var node = data.node;
    return '<div class="main" style="grid-column:1 / -1"><article class="card"><span class="ex">Example</span><div class="s">' + esc(node.area) + "</div><h2 class='title'>" + esc(node.name) + '</h2><p class="s">Example group, percent of plan across the week</p><div class="stats"><div><span>Neighbor group</span><b>' + esc(node.households) + "</b></div><div><span>This week</span><b>Two evening dips</b></div><div><span>Open claims</span><b>1042 and 1031</b></div></div>" + chart() + '<p>' + esc(node.week) + "</p><p class='s'>" + esc(node.suggestion) + '</p><div id="panel-trace" class="bridge" data-bridge="trace-to-node"></div></article></div>';
  }
  function settingsView() {
    return '<div class="main" style="grid-column:1 / -1"><article class="card"><span class="ex">Example</span><h2 class="title">Settings</h2><p class="s">Example choices for the network team. Nothing here is saved.</p><div class="kv"><div><span>Landing view</span><b>Claims</b></div><div><span>Who can open it</span><b>Network team</b></div><div><span>Outage log</span><b>Connected in this example</b></div><div><span>Preview</span><b>Example only</b></div></div></article></div>';
  }
  function paintNav() {
    var meta = viewMeta(state.view);
    document.getElementById("nav-network").setAttribute("aria-current", meta.nav === "network" ? "page" : "false");
    document.getElementById("nav-support").setAttribute("aria-current", meta.nav === "support" ? "page" : "false");
    var sub = document.getElementById("subnav");
    if (meta.nav !== "network") {
      sub.innerHTML = "";
      return;
    }
    var claimsOn = state.view === "claim_queue" || state.view === "claim_detail";
    sub.innerHTML = '<button type="button" data-view="claim_queue"' + (claimsOn ? ' aria-current="page"' : "") + '>Claims</button><button type="button" data-view="node_health"' + (state.view === "node_health" ? ' aria-current="page"' : "") + ">Node health</button>";
  }
  function mountBridges() {
    var root = document.getElementById("panel-trace");
    if (!root) return;
    Object.keys(panels).forEach(function (name) {
      panels[name](root, { view: state.view, example: true, node: data.node.name });
    });
  }
  function paint() {
    paintNav();
    if (state.view === "node_health") stage.innerHTML = nodeView();
    else if (state.view === "settings") stage.innerHTML = settingsView();
    else stage.innerHTML = claimsView();
    stage.querySelectorAll("[data-claim]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.claim = button.getAttribute("data-claim");
        state.view = "claim_detail";
        paint();
        syncHelp();
      });
    });
    var queue = document.getElementById("focus-queue");
    if (queue) queue.addEventListener("click", function () {
      state.view = "claim_queue";
      paint();
      syncHelp();
    });
    mountBridges();
  }
  function syncHelp() {
    var meta = viewMeta(state.view);
    document.getElementById("help-title").textContent = meta.label;
    document.getElementById("help-copy").textContent = data.help[meta.helpKey];
    document.getElementById("help-screen").textContent = "This screen: " + meta.label;
    document.getElementById("help-copy").hidden = state.form !== "";
    document.getElementById("feature-form").hidden = state.form !== "feature";
    document.getElementById("bug-form").hidden = state.form !== "bug";
    var select = document.getElementById("bug-issue");
    if (state.form === "bug" && select && select.dataset.touched !== "yes") select.value = meta.issue;
  }
  function openPanel() {
    help.hidden = false;
    helpOpen.setAttribute("aria-expanded", "true");
    help.focus();
  }
  function closePanel() {
    help.hidden = true;
    helpOpen.setAttribute("aria-expanded", "false");
    state.form = "";
    syncHelp();
  }
  function openForm(kind) {
    state.form = kind;
    openPanel();
    syncHelp();
  }
  function showResult(message) {
    document.getElementById("help-result").textContent = message;
  }
  function readFile(input) {
    var file = input.files && input.files[0];
    if (!file) return Promise.resolve("");
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      return Promise.reject(new Error("Screenshot must be a PNG or JPEG of 1.5 MB or less."));
    }
    if (file.size > 1572864) {
      return Promise.reject(new Error("Screenshot must be a PNG or JPEG of 1.5 MB or less."));
    }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || "");
        var comma = text.indexOf(",");
        resolve(comma >= 0 ? text.slice(comma + 1) : text);
      };
      reader.onerror = function () { reject(new Error("That screenshot could not be read.")); };
      reader.readAsDataURL(file);
    });
  }
  function send(kind, form) {
    if (state.sending) return;
    var title = form.querySelector("[name=title]").value.replace(/^\\s+|\\s+$/g, "");
    var description = form.querySelector("[name=description]").value.replace(/^\\s+|\\s+$/g, "");
    if (!title) {
      showResult("Title is required.");
      return;
    }
    var meta = viewMeta(state.view);
    var body = { source: "isp", kind: kind, title: title, page_context: meta.label };
    if (description) body.description = description;
    if (kind === "bug") {
      body.issue_type = document.getElementById("bug-issue").value;
      var expected = form.querySelector("[name=expected_behavior]").value.replace(/^\\s+|\\s+$/g, "");
      if (expected) body.expected_behavior = expected;
    }
    state.sending = true;
    showResult("Sending...");
    readFile(form.querySelector("input[type=file]")).then(function (shot) {
      if (shot) body.screenshot = shot;
      return fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body)
      });
    }).then(function (response) {
      return response.text().then(function (text) {
        var payload = {};
        try { payload = JSON.parse(text); } catch (ignore) { payload = {}; }
        return { ok: response.ok, payload: payload };
      });
    }).then(function (result) {
      if (!result.ok) throw new Error((result.payload && result.payload.error) || "Please try again.");
      showResult("Got it. Reference HP-" + result.payload.id + ".");
      form.reset();
      var select = document.getElementById("bug-issue");
      if (select) delete select.dataset.touched;
      state.form = "";
      syncHelp();
    }).catch(function (error) {
      var message = error && error.message ? error.message : "Please try again.";
      if (message.indexOf("hello@honestping.com") < 0) message += " You can email hello@honestping.com.";
      showResult(message);
    }).then(function () {
      state.sending = false;
    });
  }

  document.getElementById("nav-network").addEventListener("click", function () {
    state.view = "claim_detail";
    paint();
    syncHelp();
  });
  document.getElementById("nav-support").addEventListener("click", function () {
    state.view = "settings";
    paint();
    syncHelp();
  });
  document.getElementById("subnav").addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    var next = button.getAttribute("data-view");
    if (next === "claim_queue" && state.claim) next = "claim_detail";
    state.view = next;
    paint();
    syncHelp();
  });
  helpOpen.addEventListener("click", function () {
    if (help.hidden) { state.form = ""; openPanel(); syncHelp(); }
    else closePanel();
  });
  document.getElementById("help-close").addEventListener("click", closePanel);
  document.getElementById("open-feature").addEventListener("click", function () { openForm("feature"); });
  document.getElementById("open-bug").addEventListener("click", function () { openForm("bug"); });
  document.getElementById("footer-bug").addEventListener("click", function () { openForm("bug"); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !help.hidden) closePanel();
  });
  document.getElementById("bug-issue").addEventListener("change", function (event) {
    event.target.dataset.touched = "yes";
  });
  document.getElementById("feature-form").addEventListener("submit", function (event) {
    event.preventDefault();
    send("feature", event.currentTarget);
  });
  document.getElementById("bug-form").addEventListener("submit", function (event) {
    event.preventDefault();
    send("bug", event.currentTarget);
  });
  paint();
  syncHelp();
})();
`;

export function ispPreviewResponse(env) {
  return new Response(renderIspPreview({ kMin: env && env.K_MIN }), { status: 200, headers: HEADERS });
}

export function isIspPreviewPath(pathname) {
  return pathname === "/isp-preview" || pathname === "/isp-preview/" || pathname === "/isp-preview/index.html";
}
