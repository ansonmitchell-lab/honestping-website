/* HonestPing marketing: animated example ISP verdict (simulated, no network calls) */
(function () {
  var card = document.querySelector("[data-verdict-demo]");
  if (!card) return;
  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (motion && motion.matches) return; // static final state already in the HTML

  var counters = Array.prototype.slice.call(card.querySelectorAll("[data-count]"));
  var fill = card.querySelector("[data-fill]");
  var target = fill ? Number(fill.getAttribute("data-fill")) : 0;
  var raf = 0, playing = false, replayTimer = 0;

  function ease(p) { return 1 - Math.pow(1 - p, 3); }

  function reset() {
    card.classList.remove("is-done");
    card.classList.add("is-running");
    counters.forEach(function (el) { el.textContent = "0"; });
    if (fill) fill.style.width = "0%";
  }

  function play() {
    if (playing) return;
    playing = true;
    clearTimeout(replayTimer);
    reset();
    var start = 0, dur = 2200;
    function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur);
      var e = ease(p);
      counters.forEach(function (el) {
        var end = Number(el.getAttribute("data-count"));
        var v = end * e;
        // Measured speed jitters a little while "testing", then settles
        if (end === 212 && p < 1) v += (Math.random() - 0.5) * 18 * (1 - p);
        el.textContent = String(Math.max(0, Math.round(v)));
      });
      if (fill) fill.style.width = (target * e).toFixed(1) + "%";
      if (p < 1) { raf = requestAnimationFrame(step); return; }
      counters.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
      if (fill) fill.style.width = target + "%";
      card.classList.remove("is-running");
      card.classList.add("is-done");
      playing = false;
    }
    raf = requestAnimationFrame(step);
  }

  function finishNow() {
    cancelAnimationFrame(raf);
    playing = false;
    counters.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
    if (fill) fill.style.width = target + "%";
    card.classList.remove("is-running");
    card.classList.add("is-done");
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) play();
      });
    }, { threshold: 0.45 });
    io.observe(card);
  } else {
    finishNow();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) finishNow();
  });
  if (motion) {
    var onChange = function () { if (motion.matches) finishNow(); };
    if (motion.addEventListener) motion.addEventListener("change", onChange);
    else if (motion.addListener) motion.addListener(onChange);
  }
})();
