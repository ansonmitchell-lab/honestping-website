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
  var timer = 0, raf = 0, settle = 0;

  function render(v) { if (msEl) msEl.textContent = String(Math.round(v)); }

  function reset() {
    clearTimeout(timer); clearTimeout(settle); cancelAnimationFrame(raf);
    shown = target = BASE; render(BASE);
    if (jitterEl) jitterEl.textContent = "3";
    if (lossEl) lossEl.textContent = "0";
  }

  function tween(from, to) {
    var start = 0, dur = 650;
    cancelAnimationFrame(raf);
    function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      shown = from + (to - from) * e;
      render(shown);
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    clearTimeout(settle); // guarantee the final value even if frames are throttled
    settle = setTimeout(function () { if (target === to) { shown = to; render(to); } }, dur + 80);
  }

  function sample() {
    // Mean-reverting random walk around 28 ms, with a rare small spike.
    var next = target + (BASE - target) * 0.35 + (Math.random() - 0.5) * 6;
    if (Math.random() < 0.06) next += 4 + Math.random() * 3;
    next = Math.max(MIN, Math.min(MAX, Math.round(next)));
    tween(shown, next);
    target = next;

    history.push(next);
    if (history.length > 6) history.shift();
    var d = 0;
    for (var i = 1; i < history.length; i++) d += Math.abs(history[i] - history[i - 1]);
    var jitter = Math.max(2, Math.min(5, Math.round(d / (history.length - 1))));
    if (jitterEl) jitterEl.textContent = String(jitter);
    if (lossEl) lossEl.textContent = "0";

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
