/* Three aggregate event names. Nothing is sent, stored, or read.
   No cookies, no localStorage, no sessionStorage, no plan, no price, no results.
   cta_clicked may carry hook:true when the app link is clicked from a branch
   panel. Any other detail is ignored. */
var ALLOWED = { test_started: 1, test_completed: 1, cta_clicked: 1 };
var events = [];

export function count(name, detail) {
  if (!ALLOWED[name]) return;
  if (name === "cta_clicked" && detail && detail.hook === true) {
    events.push({ name: name, hook: true });
    return;
  }
  events.push(name);
}

export function eventsSoFar() {
  return events.slice();
}
