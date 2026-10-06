/* HonestPing marketing: Trace-style hop demo (simulated, no network calls) */
(function () {
  var root = document.querySelector("[data-trace-demo]");
  if (!root) return;
  var track = root.querySelector("[data-trace-track]");
  var statusEl = root.querySelector("[data-trace-status]");
  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  // Abstract labels only; no real hostnames or brands
  var HOPS = [
    { label: "You", ms: 1, tone: "good" },
    { label: "Router", ms: 2, tone: "good" },
    { label: "ISP", ms: 18, tone: "good" },
    { label: "Hop 4", ms: 64, tone: "warn" },
    { label: "Hop 5", ms: null, tone: "bad" },
    { label: "Destination", ms: 42, tone: "good" }
  ];
  var STEP_MS = 520;
  var HOLD_MS = 2200;

  var timer = 0;
  var run = 0; // generation token: stale timers from an older run do nothing
  var nodes = [];

  function meta(hop) { return hop.ms == null ? "n/a" : hop.ms + " ms"; }

  // Status reflects state only. "Trace finished" is shown only in the finished state.
  function setState(state) {
    root.setAttribute("data-state", state);
    if (!statusEl) return;
    if (state === "finished") {
      statusEl.innerHTML = '<span class="status good">Trace finished</span>';
    } else {
      statusEl.innerHTML = '<span class="status">Tracing path…</span>';
    }
  }

  function build(lit) {
    track.innerHTML = "";
    nodes = [];
    HOPS.forEach(function (hop, i) {
      if (i) {
        var line = document.createElement("span");
        line.className = "trace-line" + (lit ? " is-on" : "");
        track.appendChild(line);
      }
      var node = document.createElement("div");
      node.className = "trace-hop tone-" + hop.tone + (lit ? " is-lit" : "");
      node.innerHTML =
        '<span class="trace-dot"></span>' +
        '<strong class="trace-label">' + (lit ? hop.label : "") + "</strong>" +
        '<small class="trace-meta">' + (lit ? meta(hop) : "") + "</small>";
      track.appendChild(node);
      nodes.push(node);
    });
    if (lit && nodes.length) nodes[nodes.length - 1].classList.add("is-newest");
  }

  function allLit() {
    if (!nodes.length) return false;
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].classList.contains("is-lit")) return false;
    }
    return true;
  }

  function lightHop(i) {
    var hop = HOPS[i];
    var node = nodes[i];
    if (!node) return;
    var line = node.previousElementSibling;
    if (line && line.classList.contains("trace-line")) line.classList.add("is-on");
    nodes.forEach(function (n) { n.classList.remove("is-newest"); });
    node.classList.add("is-lit", "is-newest");
    node.querySelector(".trace-label").textContent = hop.label;
    node.querySelector(".trace-meta").textContent = meta(hop);
  }

  function showStaticFinished() {
    run++;
    clearTimeout(timer);
    build(true);
    setState("finished");
  }

  function loop() {
    var myRun = ++run;
    clearTimeout(timer);
    // Reset: hide the finished pill first, then rebuild dim hops
    setState("tracing");
    build(false);
    var i = 0;
    function next() {
      if (myRun !== run) return;
      if (i < HOPS.length) {
        lightHop(i);
        i++;
        timer = setTimeout(next, STEP_MS);
        return;
      }
      // Only declare finished once every hop is lit
      if (allLit()) setState("finished");
      timer = setTimeout(function () {
        if (myRun === run) loop();
      }, HOLD_MS);
    }
    next();
  }

  function pause() {
    run++;
    clearTimeout(timer);
  }

  function update() {
    if (motion && motion.matches) { showStaticFinished(); return; }
    if (document.hidden) { pause(); return; }
    loop();
  }

  if (motion) {
    if (motion.addEventListener) motion.addEventListener("change", update);
    else if (motion.addListener) motion.addListener(update);
  }
  document.addEventListener("visibilitychange", update);
  update();
})();
