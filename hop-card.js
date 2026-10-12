/* How hops work: one rabbit hops the four dots, then sits on Server,
   facing back into the card. Two passes when the card scrolls in, one
   more on hover or focus. Pauses off screen and while the tab is hidden.
   Reduced motion rests on Server with every dot lit. */
(function () {
  var card = document.querySelector("[data-hop-card]");
  if (!card) return;
  var path = card.querySelector(".hop-path");
  var runner = card.querySelector(".hop-runner");
  var leap = card.querySelector(".hop-leap");
  var sit = card.querySelector(".hop-sit");
  var stops = card.querySelectorAll(".hop-stop");
  if (!path || !runner || !leap || !sit || stops.length < 2) return;

  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var HOP = 560;
  var HOLD = 420;
  var reduce = mq.matches;
  var playing = false;
  var raf = 0;
  var hopI = 0;
  var t0 = 0;
  var phase = "hop";
  var passes = 0;
  var passCap = 0;
  var held = false;

  function motion(on) {
    if (window.HonestPingMotion && window.HonestPingMotion.hopCardMoving) {
      window.HonestPingMotion.hopCardMoving(on);
    }
  }

  function dotCenter(i) {
    var mark = stops[i].querySelector("i");
    var pr = path.getBoundingClientRect();
    var r = mark.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - pr.left - runner.offsetWidth / 2,
      y: r.bottom - pr.top - runner.offsetHeight
    };
  }

  function fit(p) {
    var cr = card.getBoundingClientRect();
    var pr = path.getBoundingClientRect();
    var rw = runner.offsetWidth;
    var rh = runner.offsetHeight;
    var minX = cr.left + 6 - pr.left;
    var maxX = cr.right - 6 - rw - pr.left;
    var minY = cr.top + 4 - pr.top;
    var maxY = cr.bottom - 4 - rh - pr.top;
    if (maxX < minX) maxX = minX;
    if (maxY < minY) maxY = minY;
    return {
      x: Math.max(minX, Math.min(maxX, p.x)),
      y: Math.max(minY, Math.min(maxY, p.y))
    };
  }

  function put(p, face) {
    var q = fit(p);
    runner.style.transform = "translate3d(" + q.x.toFixed(1) + "px," + q.y.toFixed(1) + "px,0) scaleX(" + face + ")";
  }

  function showSit(on) {
    leap.hidden = on;
    sit.hidden = !on;
  }

  function light(n) {
    for (var i = 0; i < stops.length; i++) {
      stops[i].classList.toggle("is-on", i <= n);
    }
  }

  function park() {
    var last = stops.length - 1;
    var p = dotCenter(last);
    p.x += 8;
    put(p, -1);
    showSit(true);
    light(last);
  }

  function paintHop(u) {
    var a = dotCenter(hopI);
    var b = dotCenter(hopI + 1);
    var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    var x = a.x + (b.x - a.x) * e;
    var arc = Math.min(14, runner.offsetHeight / 5);
    var y = a.y + (b.y - a.y) * e - Math.sin(Math.PI * u) * arc;
    put({ x: x, y: y }, 1);
    showSit(false);
    light(u > 0.92 ? hopI + 1 : hopI);
  }

  function stop(rest) {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    motion(false);
    if (rest) park();
  }

  function frame(now) {
    if (!playing) return;
    if (document.hidden || !onScreen()) {
      held = true;
      motion(false);
      raf = 0;
      return;
    }
    var dur = phase === "hop" ? HOP : HOLD;
    var u = Math.min(1, (now - t0) / dur);
    if (phase === "hop") paintHop(u);
    if (u < 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    if (phase === "hop") {
      if (hopI < stops.length - 2) {
        hopI += 1;
        t0 = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      phase = "sit";
      t0 = now;
      park();
      raf = requestAnimationFrame(frame);
      return;
    }
    passes += 1;
    if (passes < passCap) {
      hopI = 0;
      phase = "hop";
      t0 = now;
      light(0);
      showSit(false);
      raf = requestAnimationFrame(frame);
      return;
    }
    stop(true);
  }

  function onScreen() {
    var r = card.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return vis > Math.min(r.height, vh) * 0.35;
  }

  function begin(cap) {
    if (reduce) {
      park();
      return;
    }
    passCap = cap;
    passes = 0;
    hopI = 0;
    phase = "hop";
    playing = true;
    held = false;
    light(0);
    showSit(false);
    put(dotCenter(0), 1);
    motion(true);
    t0 = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function replay() {
    if (reduce || playing) return;
    begin(1);
  }

  if (reduce) park();

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (reduce || passes > 0 || playing) return;
      if (entries[0] && entries[0].isIntersecting) begin(2);
    }, { threshold: 0.4 });
    io.observe(card);
  } else if (!reduce) {
    begin(2);
  }

  document.addEventListener("visibilitychange", function () {
    if (!playing) return;
    if (document.hidden) {
      held = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      motion(false);
      return;
    }
    if (held && onScreen()) {
      held = false;
      motion(true);
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });

  window.addEventListener("scroll", function () {
    if (!playing || !held || document.hidden || !onScreen()) return;
    held = false;
    motion(true);
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }, { passive: true });

  card.addEventListener("mouseenter", replay);
  card.addEventListener("focusin", replay);
  window.addEventListener("resize", function () {
    if (!playing) park();
  });

  if (mq.addEventListener) mq.addEventListener("change", function () {
    reduce = mq.matches;
    if (reduce) stop(true);
  });
})();
