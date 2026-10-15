/* HonestPing hero: live Overview dial demo (sample readings, no network calls) */
(function () {
  var root = document.querySelector(".hero-gauge");
  if (!root) return;
  var msEl = document.getElementById("hero-ping-ms");
  var jitterEl = document.getElementById("hero-jitter");
  var lossEl = document.getElementById("hero-loss");
  var pulse = root.querySelector(".gauge-pulse");
  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  var BASE = 28, MIN = 22, MAX = 36;
  var shown = BASE, target = BASE, history = [BASE, 27, 29, 28];
  var jitterShown = 3, jitterTarget = 3;
  var lossShown = 0, lossTarget = 0, lossBlipLeft = 0;
  var timer = 0, raf = 0, settle = 0;

  function fmtLoss(v) {
    if (v < 0.05) return "0";
    return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
  }

  function render(v) { if (msEl) msEl.textContent = String(Math.round(v)); }
  function renderSide() {
    if (jitterEl) jitterEl.textContent = String(Math.round(jitterShown));
    if (lossEl) lossEl.textContent = fmtLoss(lossShown);
  }

  function reset() {
    clearTimeout(timer); clearTimeout(settle); cancelAnimationFrame(raf);
    shown = target = BASE;
    jitterShown = jitterTarget = 3;
    lossShown = lossTarget = 0;
    lossBlipLeft = 0;
    render(BASE);
    renderSide();
  }

  function tween(from, to) {
    var start = 0, dur = 650;
    var jFrom = jitterShown, jTo = jitterTarget;
    var lFrom = lossShown, lTo = lossTarget;
    cancelAnimationFrame(raf);
    function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      shown = from + (to - from) * e;
      jitterShown = jFrom + (jTo - jFrom) * e;
      lossShown = lFrom + (lTo - lFrom) * e;
      render(shown);
      renderSide();
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    clearTimeout(settle); // guarantee the final value even if frames are throttled
    settle = setTimeout(function () {
      if (target === to) {
        shown = to;
        jitterShown = jTo;
        lossShown = lTo;
        render(to);
        renderSide();
      }
    }, dur + 80);
  }

  function sample() {
    // Mean-reverting random walk around 28 ms, with a rare small spike.
    var next = target + (BASE - target) * 0.35 + (Math.random() - 0.5) * 6;
    if (Math.random() < 0.06) next += 4 + Math.random() * 3;
    next = Math.max(MIN, Math.min(MAX, Math.round(next)));

    history.push(next);
    if (history.length > 6) history.shift();
    var d = 0;
    for (var i = 1; i < history.length; i++) d += Math.abs(history[i] - history[i - 1]);
    // Subtle smooth jitter 1 to 6 ms
    var jRaw = Math.max(1, Math.min(6, d / Math.max(1, history.length - 1) + (Math.random() - 0.5) * 1.2));
    jitterTarget = Math.round(jitterTarget * 0.55 + jRaw * 0.45);
    jitterTarget = Math.max(1, Math.min(6, jitterTarget));

    // Packet loss mostly 0; occasional 0.1 to 0.6% blips that ease back to 0
    if (lossBlipLeft > 0) {
      lossBlipLeft -= 1;
      lossTarget = lossTarget * 0.45; // ease back
      if (lossBlipLeft === 0 || lossTarget < 0.05) lossTarget = 0;
    } else if (Math.random() < 0.08) {
      lossTarget = 0.1 + Math.random() * 0.5; // 0.1 to 0.6
      lossBlipLeft = 2 + Math.floor(Math.random() * 2); // 2 to 3 samples easing
    } else {
      lossTarget = 0;
    }

    tween(shown, next);
    target = next;

    if (pulse) { // restart the outward ping ring
      pulse.classList.remove("is-on");
      void pulse.getBoundingClientRect();
      pulse.classList.add("is-on");
    }
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(sample, 1200 + Math.random() * 800);
  }

  function update() {
    if ((motion && motion.matches) || document.hidden) reset();
    else schedule();
  }

  if (motion) {
    if (motion.addEventListener) motion.addEventListener("change", update);
    else if (motion.addListener) motion.addListener(update);
  }
  document.addEventListener("visibilitychange", update);
  update();
})();
