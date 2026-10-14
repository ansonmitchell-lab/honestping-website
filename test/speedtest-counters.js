/* Three aggregate event names. Nothing is sent, stored, or read.
   No cookies, no localStorage, no sessionStorage, no plan, no price, no results. */
var ALLOWED = { test_started: 1, test_completed: 1, cta_clicked: 1 };
var events = [];

export function count(name) {
  if (!ALLOWED[name]) return;
  events.push(name);
}

export function eventsSoFar() {
  return events.slice();
}
