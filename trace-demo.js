/* HonestPing marketing: Trace-style hop demo (simulated, no network calls) */
(function () {
  var root = document.querySelector("[data-trace-demo]");
  if (!root) return;
  var track = root.querySelector("[data-trace-track]");
  var statusEl = root.querySelector("[data-trace-status]");
  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  // Abstract labels only; no real hostnames or brands
  var HOPS = [
    { label: "You", detail: "PC", ms: 1, tone: "good" },
    { label: "Router", detail: "Local", ms: 2, tone: "good" },
    { label: "ISP", detail: "Edge", ms: 18, tone: "good" },
    { label: "Hop 4", detail: "Upstream", ms: 64, tone: "warn" },
    { label: "Hop 5", detail: "No reply", ms: null, tone: "bad" },
    { label: "Destination", detail: "Target", ms: 42, tone: "good" }
  ];

  var timer = 0;
  var step = 0;
  var nodes = [];

  function clearTimers() {
    clearTimeout(timer);
  }

  function setStatus(html) {
    if (statusEl) statusEl.innerHTML = html;
  }

  function buildStaticFinished() {
    track.innerHTML = "";
    nodes = [];
    HOPS.forEach(function (hop, i) {
      if (i) {
        var line = document.createElement("span");
        line.className = "trace-line is-on";
        track.appendChild(line);
      }
      var node = document.createElement("div");
      node.className = "trace-hop is-lit tone-" + hop.tone + (i === HOPS.length - 1 ? " is-newest" : "");
      var meta = hop.ms == null ? "n/a" : hop.ms + " ms";
      node.innerHTML =
        '<span class="trace-dot"></span>' +
        '<strong class="trace-label">' + hop.label + "</strong>" +
        '<small class="trace-meta">' + meta + "</small>";
      track.appendChild(node);
      nodes.push(node);
    });
    setStatus('<span class="status good">Trace finished</span>');
  }

  function resetTrack() {
    track.innerHTML = "";
    nodes = [];
    HOPS.forEach(function (hop, i) {
      if (i) {
        var line = document.createElement("span");
        line.className = "trace-line";
        track.appendChild(line);
      }
      var node = document.createElement("div");
      node.className = "trace-hop tone-" + hop.tone;
      node.innerHTML =
        '<span class="trace-dot"></span>' +
        '<strong class="trace-label"></strong>' +
        '<small class="trace-meta"></small>';
      track.appendChild(node);
      nodes.push(node);
    });
    setStatus('<span class="status">Tracing path…</span>');
  }

  function lightHop(i) {
    var hop = HOPS[i];
    var node = nodes[i];
    if (!node) return;
    if (i > 0) {
      var line = node.previousElementSibling;
      if (line && line.classList.contains("trace-line")) line.classList.add("is-on");
    }
    nodes.forEach(function (n) { n.classList.remove("is-newest"); });
    node.classList.add("is-lit", "is-newest");
    var label = node.querySelector(".trace-label");
    var meta = node.querySelector(".trace-meta");
    if (label) label.textContent = hop.label;
    if (meta) meta.textContent = hop.ms == null ? "n/a" : hop.ms + " ms";
  }

  function runStep() {
    if (document.hidden || (motion && motion.matches)) {
      buildStaticFinished();
      return;
    }
    if (step === 0) resetTrack();
    if (step < HOPS.length) {
      lightHop(step);
      step += 1;
      timer = setTimeout(runStep, 520);
      return;
    }
    setStatus('<span class="status good">Trace finished</span>');
    nodes.forEach(function (n) { n.classList.remove("is-newest"); });
    if (nodes.length) nodes[nodes.length - 1].classList.add("is-newest");
    step = 0;
    timer = setTimeout(runStep, 2200);
  }

  function start() {
    clearTimers();
    if ((motion && motion.matches) || document.hidden) {
      buildStaticFinished();
      return;
    }
    step = 0;
    runStep();
  }

  if (motion) {
    if (motion.addEventListener) motion.addEventListener("change", start);
    else if (motion.addListener) motion.addListener(start);
  }
  document.addEventListener("visibilitychange", start);
  start();
})();
