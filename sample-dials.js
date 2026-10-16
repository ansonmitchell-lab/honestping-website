/* Example Free and Pro dials. Below the fold, and only while in view.
   A cold first screen never starts this timer. Reduced motion stays on the HTML frame. */
(function () {
  var root = document.querySelector("[data-sample-dials]");
  if (!root) return;
  var reduce = document.documentElement.classList.contains("hp-reduce")
    || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduce) return;

  var statusEl = root.querySelector("[data-free-status]");
  var ring = root.querySelector("[data-free-ring]");
  var msEl = root.querySelector("[data-pro-ms]");
  var arc = root.querySelector("[data-pro-arc]");
  var jitEl = root.querySelector("[data-pro-jitter]");
  var lossEl = root.querySelector("[data-pro-loss]");
  if (!statusEl || !ring || !msEl || !arc || !jitEl || !lossEl) return;

  var ping = 28;
  var jitter = 3;
  var loss = 0;
  var lossBlips = 0;
  var fairLeft = 0;
  var tick = 0;
  var timer = 0;
  var inView = false;
  var CIRC = 2 * Math.PI * 47;

  function fmtLoss(v) {
    if (v < 0.05) return "0";
    var n = Math.round(v * 2) / 2;
    if (n === 0) return "0";
    return (n % 1) ? n.toFixed(1) : String(n);
  }

  function paint() {
    msEl.textContent = String(ping);
    jitEl.textContent = String(jitter);
    lossEl.textContent = fmtLoss(loss);
    var q = (40 - ping) / 18;
    var len = CIRC * (0.38 + q * 0.54);
    arc.setAttribute("stroke-dasharray", len.toFixed(1) + " " + CIRC.toFixed(1));
    arc.setAttribute("stroke", (ping >= 34 || loss > 0) ? "#ffc478" : "#45e5ad");
    if (fairLeft > 0) {
      statusEl.textContent = "Fair";
      ring.classList.add("is-fair");
    } else {
      statusEl.textContent = "Healthy";
      ring.classList.remove("is-fair");
    }
  }

  function step() {
    tick += 1;
    var next = ping + (28 - ping) * 0.35 + (Math.random() - 0.5) * 7;
    if (Math.random() < 0.1) next += 5 + Math.random() * 8;
    ping = Math.max(22, Math.min(40, Math.round(next)));
    var jNext = jitter + (Math.random() - 0.5) * 3;
    if (ping > 34) jNext += 1;
    jitter = Math.max(1, Math.min(9, Math.round(jNext)));
    if (lossBlips > 0) {
      lossBlips -= 1;
      if (lossBlips === 0) loss = 0;
    } else if (Math.random() < 0.08) {
      loss = [0.5, 1, 1.5, 2][Math.floor(Math.random() * 4)];
      lossBlips = 1 + Math.floor(Math.random() * 2);
    } else {
      loss = 0;
    }
    if (fairLeft > 0) fairLeft -= 1;
    else if (tick > 4 && tick % 9 === 0) fairLeft = 2;
    paint();
    timer = setTimeout(step, 1400);
  }

  function stop() {
    clearTimeout(timer);
    timer = 0;
    root.classList.remove("is-on");
  }

  function start() {
    if (timer || !inView) return;
    root.classList.add("is-on");
    step();
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      });
    }, { threshold: 0.35 });
    io.observe(root);
  } else {
    inView = true;
    start();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (inView) start();
  });
})();
