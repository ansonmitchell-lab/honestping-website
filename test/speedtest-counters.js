/* Event names only. This preview does not send them.
   No address, no id, no result, no plan value, and no Worker, so nothing is spent. */
(function (root) {
  var ALLOWED = { test_started: 1, test_completed: 1, cta_clicked: 1 };
  var events = [];
  root.HonestPingSpeedCounters = {
    events: events,
    count: function (name) {
      if (!ALLOWED[name]) return;
      events.push(name);
    }
  };
})(window);
