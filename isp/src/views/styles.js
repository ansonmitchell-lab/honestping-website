export const previewStyles = `
:root {
  --hp-bg: #07131f;
  --hp-surface: #0d1e2e;
  --hp-subtle: #122a3a;
  --hp-text: #edf5fa;
  --hp-muted: #abc0ce;
  --hp-line: #203c4e;
  --hp-green: #45e5ad;
  --hp-cyan: #05d1e8;
  --hp-amber: #ffc478;
  --hp-amber-bg: #32281c;
  --hp-primary-text: #03271e;
  --font: "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
  --home: #9bb0c0;
  --access: #05d1e8;
  --aggregation: #7eb6ff;
  --core: #3ee0a6;
  --peering: #d2b0ff;
  --beyond: #ffc478;
  --unknown: #5d7280;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: radial-gradient(1200px 500px at 10% -10%, #123044 0%, var(--hp-bg) 55%);
  color: var(--hp-text);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.5;
}
a { color: var(--hp-cyan); }
.wrap { max-width: 1120px; margin: 0 auto; padding: 28px 20px 48px; }
.top {
  display: flex; justify-content: space-between; gap: 16px; align-items: center;
  margin-bottom: 22px;
}
.brand { font-weight: 650; letter-spacing: 0.01em; }
.brand small { display: block; color: var(--hp-muted); font-weight: 500; font-size: 12px; }
.nav { display: flex; gap: 8px; flex-wrap: wrap; }
.nav a {
  color: var(--hp-muted); text-decoration: none; border: 1px solid var(--hp-line);
  border-radius: 999px; padding: 6px 12px; font-size: 13px;
}
.nav a[aria-current="page"] { color: var(--hp-text); border-color: var(--hp-cyan); }
.card {
  background: linear-gradient(180deg, rgba(18, 42, 58, 0.55), rgba(13, 30, 46, 0.92));
  border: 1px solid var(--hp-line);
  border-radius: 18px;
  padding: 18px 18px 16px;
  box-shadow: 0 0 0 1px rgba(5, 209, 232, 0.04), 0 18px 40px rgba(0, 0, 0, 0.18);
}
.card + .card, .stack { margin-top: 16px; }
.card-head, .row-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
h1, h2, h3 { margin: 0; font-weight: 650; }
h1 { font-size: 28px; }
h2 { font-size: 18px; }
.kicker { color: var(--hp-muted); margin: 6px 0 0; font-size: 13px; }
.pill {
  border: 1px solid rgba(5, 209, 232, 0.45);
  color: var(--hp-cyan);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.pill.good { color: var(--hp-green); border-color: rgba(69, 229, 173, 0.5); background: #102a24; }
.pill.warn { color: var(--hp-amber); border-color: rgba(255, 196, 120, 0.5); background: var(--hp-amber-bg); }
.hop-line {
  list-style: none; display: flex; gap: 0; padding: 18px 0 8px; margin: 8px 0 4px;
  overflow-x: auto;
}
.hop { flex: 1 0 108px; text-align: center; position: relative; min-width: 108px; }
.hop:not(:last-child)::before {
  content: "";
  position: absolute; top: 8px; left: 50%; right: -50%; height: 2px;
  background: var(--hp-line); z-index: 0;
}
.dot {
  width: 16px; height: 16px; border-radius: 999px; display: inline-block; position: relative; z-index: 1;
  box-shadow: 0 0 0 4px rgba(7, 19, 31, 0.9);
}
.hop[data-segment="home"] .dot { background: var(--home); }
.hop[data-segment="access"] .dot { background: var(--access); }
.hop[data-segment="aggregation"] .dot { background: var(--aggregation); }
.hop[data-segment="core"] .dot { background: var(--core); }
.hop[data-segment="peering"] .dot { background: var(--peering); }
.hop[data-segment="beyond_isp"] .dot { background: var(--beyond); }
.hop[data-segment="unknown"] .dot { background: var(--unknown); }
.hop.suspect .dot { box-shadow: 0 0 0 4px rgba(255, 196, 120, 0.35); }
.hop-name { display: block; margin-top: 8px; font-size: 13px; font-weight: 650; }
.hop-ms, .hop-meta, .hop-addr { display: block; color: var(--hp-muted); font-size: 12px; }
.hop.suspect .hop-name { color: var(--hp-amber); }
.legend { display: flex; flex-wrap: wrap; gap: 10px 14px; color: var(--hp-muted); font-size: 12px; margin: 8px 0 14px; }
.swatch { width: 8px; height: 8px; border-radius: 99px; display: inline-block; margin-right: 6px; }
.verdict { display: flex; gap: 12px; align-items: flex-start; margin-top: 8px; }
.verdict p { margin: 2px 0 0; }
.area { margin: 12px 0 0; color: var(--hp-green); }
.note, .foot, .help { color: var(--hp-muted); font-size: 13px; }
.grid { display: grid; grid-template-columns: 1.3fr 0.9fr; gap: 16px; }
.table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.table th, .table td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--hp-line); vertical-align: top; font-size: 14px; }
.table th { color: var(--hp-muted); font-weight: 600; font-size: 12px; }
.sug { border: 1px solid var(--hp-line); border-radius: 14px; padding: 12px; margin-top: 10px; background: rgba(7, 19, 31, 0.35); }
.sug h3 { font-size: 16px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
input, select, button, textarea {
  font: inherit; color: var(--hp-text); background: var(--hp-bg); border: 1px solid var(--hp-line);
  border-radius: 10px; padding: 8px 10px;
}
button { cursor: pointer; }
button.primary { background: var(--hp-cyan); color: var(--hp-primary-text); border-color: transparent; font-weight: 650; }
button.quiet { background: transparent; }
.banner { background: #102a24; border: 1px solid rgba(69, 229, 173, 0.4); color: var(--hp-green); border-radius: 12px; padding: 10px 12px; margin-bottom: 14px; }
.forms { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
label { display: block; font-size: 12px; color: var(--hp-muted); margin-bottom: 8px; }
label span { display: block; margin-bottom: 4px; }
textarea { width: 100%; min-height: 88px; }
.foot { margin-top: 22px; }
@media (max-width: 860px) {
  .grid, .forms { grid-template-columns: 1fr; }
  .top { flex-direction: column; align-items: flex-start; }
}
`;
