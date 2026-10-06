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

/* HonestPing marketing: example evidence report, rows reveal one by one, then Export glows */
(function () {
  var report = document.querySelector("[data-report-demo]");
  if (!report || !("IntersectionObserver" in window)) return; // content stays fully visible
  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (motion && motion.matches) return; // static, nothing hidden

  var rows = Array.prototype.slice.call(report.querySelectorAll(".report-row"));
  var glowTimer = 0, done = false;
  rows.forEach(function (row, i) { row.style.setProperty("--i", String(i)); });
  report.classList.add("is-ready"); // only now are rows hidden (see styles.css)

  function reveal() {
    if (done) return;
    done = true;
    report.classList.add("is-revealed");
    // Glow once the last row has landed
    glowTimer = setTimeout(function () { report.classList.add("is-glow"); }, rows.length * 140 + 500);
  }

  function finishNow() {
    clearTimeout(glowTimer);
    done = true;
    report.classList.add("is-instant", "is-revealed");
    if (!(motion && motion.matches)) report.classList.add("is-glow");
    else report.classList.remove("is-glow");
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { reveal(); io.disconnect(); }
    });
  }, { threshold: 0.35 });
  io.observe(report);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { io.disconnect(); finishNow(); }
  });
  if (motion) {
    var onChange = function () { if (motion.matches) { io.disconnect(); finishNow(); } };
    if (motion.addEventListener) motion.addEventListener("change", onChange);
    else if (motion.addListener) motion.addListener(onChange);
  }
})();
