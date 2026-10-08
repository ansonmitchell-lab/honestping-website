import { renderPathCard } from "./path-card.js";

export function renderSupportView(model) {
  return `<header class="card" style="margin-bottom:16px">
    <div class="card-head">
      <div>
        <h1>Support</h1>
        <p class="kicker">Example claim, shared with the 7-day report. The path below uses confirmed nodes only.</p>
      </div>
      <span class="pill">Example</span>
    </div>
  </header>
  ${renderPathCard(model)}`;
}
