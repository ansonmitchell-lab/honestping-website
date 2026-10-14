import { escapeHtml } from "./format.js";

export function renderNetworkAdmin(model) {
  const floor = Number(model.kMin) || 10;
  const health = (model.nodes || []).map((node) => `<tr>
    <td>${escapeHtml(node.name)}</td>
    <td>${escapeHtml(node.area)}</td>
    <td>${escapeHtml(node.roleLabel)}</td>
    <td>${escapeHtml(node.countLabel)}</td>
    <td>${escapeHtml(node.evidence)}</td>
  </tr>`).join("");
  const targets = (model.mergeTargets || []).map((node) => (
    `<option value="${escapeHtml(node.id)}">${escapeHtml(node.name)}</option>`
  )).join("");
  const suggestions = (model.suggestions || []).map((row) => `<article class="sug">
    <div class="row-head">
      <h3>${escapeHtml(row.name)}</h3>
      <span class="pill">${escapeHtml(row.layerLabel)}</span>
    </div>
    <p class="kicker">${escapeHtml(String(row.households))} households · confidence ${escapeHtml(row.confidenceLabel)}</p>
    <p>${escapeHtml(row.evidence)}</p>
    <p class="note">Ranges: ${escapeHtml(row.ranges)}</p>
    <form method="post" action="/isp-preview/network/suggestions" class="actions">
      <input type="hidden" name="suggestion_id" value="${escapeHtml(row.id)}">
      <label>Rename <input name="name" value="${escapeHtml(row.name)}" maxlength="80"></label>
      <label>Merge into <select name="merge_into"><option value="">Choose a node</option>${targets}</select></label>
      <button class="primary" name="action" value="confirm">Confirm</button>
      <button name="action" value="merge">Merge</button>
      <button class="quiet" name="action" value="reject">Reject</button>
    </form>
  </article>`).join("");
  const ranges = (model.ranges || []).map((range) => `<tr>
    <td>${escapeHtml(range.nodeName)}</td>
    <td>${escapeHtml(range.cidr)}</td>
    <td>${escapeHtml(range.source)}</td>
  </tr>`).join("");
  const nodeOptions = (model.mergeTargets || []).map((node) => (
    `<option value="${escapeHtml(node.id)}">${escapeHtml(node.name)}</option>`
  )).join("");
  return `<div class="grid">
    <section class="card" id="suggestions">
      <div class="card-head">
        <h2>Node suggestions</h2>
        <span class="pill">Example</span>
      </div>
      <p class="kicker">Review queue. Confirm with a name, merge into a node, or reject. Rejected suggestions are not offered again. Nothing under ${floor} households is shown.</p>
      ${suggestions || `<p class="note">No suggestions are waiting.</p>`}
    </section>
    <section class="card" id="node-health">
      <div class="card-head">
        <h2>Node health</h2>
        <span class="pill">Example</span>
      </div>
      <p class="kicker">7-day report window. Each household counts once. Area counts and alerts use the same minimum, currently ${floor}. The final minimum is not decided.</p>
      <table class="table">
        <thead><tr><th>Node</th><th>Area</th><th>Role</th><th>Households</th><th>Trace evidence</th></tr></thead>
        <tbody>${health}</tbody>
      </table>
    </section>
  </div>
  <section class="card stack" id="ranges">
    <div class="card-head">
      <h2>Ranges and nodes</h2>
      <span class="pill">Example</span>
    </div>
    <p class="kicker">Node names, areas, roles, and ranges only. Customer lists and MAC addresses are dropped.</p>
    <table class="table">
      <thead><tr><th>Node</th><th>Range</th><th>Source</th></tr></thead>
      <tbody>${ranges}</tbody>
    </table>
    <div class="forms">
      <form method="post" action="/isp-preview/network/nodes">
        <h3>Add a node</h3>
        <label><span>Name</span><input name="name" required maxlength="80"></label>
        <label><span>Area</span><input name="area" maxlength="80"></label>
        <label><span>Role</span><select name="role">
          <option value="access">Last mile</option>
          <option value="aggregation">Aggregation</option>
          <option value="core">Core</option>
          <option value="peering">Peering</option>
        </select></label>
        <label><span>Range</span><input name="cidr" placeholder="203.0.113.0/24" required></label>
        <button class="primary">Save node</button>
      </form>
      <form method="post" action="/isp-preview/network/ranges">
        <h3>Add a range</h3>
        <label><span>Node</span><select name="node_id">${nodeOptions}</select></label>
        <label><span>Range</span><input name="cidr" required></label>
        <button class="primary">Save range</button>
      </form>
    </div>
    <form method="post" action="/isp-preview/network/upload" enctype="multipart/form-data" class="stack">
      <h3>Upload a node file</h3>
      <label><span>Kind</span><select name="kind">
        <option value="plain">Plain CSV</option>
        <option value="netbox">NetBox CSV</option>
        <option value="uisp">UISP device export</option>
      </select></label>
      <label><span>CSV file</span><input type="file" name="file" accept=".csv,text/csv"></label>
      <p class="help">Or paste CSV here if a file picker is unavailable.</p>
      <textarea name="csv" placeholder="name,area,role,cidr"></textarea>
      <button class="primary">Upload</button>
    </form>
  </section>`;
}
