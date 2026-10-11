/* One mascot moves at a time. The most visible loop plays two cycles, then rests.
   A hover or keyboard focus replays that loop once. Reduced motion stays on the still frame. */
(function () {
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = mq.matches;
  var apis = { crest: window.HonestPingCrest, hop: window.HonestPingHop };
  var slots = [];
  var active = null;
  var raf = 0;
  var pending = false;
  var MIN = 0.25;

  function rest(slot) {
    if (slot.api && typeof slot.api.draw === "function") slot.api.draw(slot.api.restTime);
  }

  function measure(el) {
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth || 1;
    var vh = window.innerHeight || 1;
    var visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    var visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    var area = r.width * r.height;
    var ratio = area > 0 ? (visW * visH) / area : 0;
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var dx = (cx - vw / 2) / vw;
    var dy = (cy - vh / 2) / vh;
    return { ratio: ratio, dist: Math.sqrt(dx * dx + dy * dy) };
  }

  function winner() {
    var best = null;
    var bestRank = -1;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var box = measure(slot.el);
      slot.ratio = box.ratio;
      if (box.ratio < MIN) continue;
      var rank = box.ratio * 10 - box.dist;
      if (rank > bestRank) {
        bestRank = rank;
        best = slot;
      }
    }
    return best;
  }

  function halt() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (active) {
      active.playing = false;
      active.locked = false;
      active = null;
    }
  }

  function tick(now) {
    if (!active) {
      raf = 0;
      return;
    }
    var elapsed = (now - active.t0) / 1000;
    if (elapsed >= active.cycles * active.api.loop) {
      var done = active;
      halt();
      rest(done);
      reconcile();
      return;
    }
    active.api.draw(elapsed);
    raf = requestAnimationFrame(tick);
  }

  function start(slot, cycles, locked) {
    slot.introduced = true;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] !== slot) rest(slots[i]);
    }
    if (active && active !== slot) {
      active.playing = false;
      active.locked = false;
    }
    slot.playing = true;
    slot.locked = locked;
    slot.cycles = cycles;
    slot.t0 = performance.now();
    active = slot;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function reconcile() {
    if (reduce || document.hidden) {
      halt();
      for (var i = 0; i < slots.length; i++) rest(slots[i]);
      return;
    }
    if (active && active.locked) {
      if (measure(active.el).ratio < MIN) {
        var gone = active;
        halt();
        rest(gone);
      } else {
        for (var j = 0; j < slots.length; j++) {
          if (slots[j] !== active) rest(slots[j]);
        }
        return;
      }
    }
    var next = winner();
    for (var k = 0; k < slots.length; k++) {
      if (slots[k] !== next && slots[k] !== active) rest(slots[k]);
    }
    if (!next) {
      if (active) {
        var idle = active;
        halt();
        rest(idle);
      }
      return;
    }
    if (active === next) return;
    if (active) {
      var prev = active;
      halt();
      rest(prev);
    }
    if (!next.introduced) {
      next.introduced = true;
      start(next, 2, false);
    } else {
      rest(next);
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      reconcile();
    });
  }

  function replay(slot) {
    if (reduce || slot.playing) return;
    start(slot, 1, true);
  }

  document.querySelectorAll("[data-mascot]").forEach(function (el) {
    var api = apis[el.getAttribute("data-mascot")];
    if (!api || typeof api.draw !== "function") return;
    var slot = { el: el, api: api, introduced: false, playing: false, locked: false, cycles: 0, t0: 0, ratio: 0 };
    slots.push(slot);
    rest(slot);
    el.addEventListener("mouseenter", function () { replay(slot); });
    el.addEventListener("focus", function () {
      requestAnimationFrame(function () {
        if (document.activeElement === el && el.matches(":focus-visible")) replay(slot);
      });
    });
  });

  if (!slots.length) return;

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(schedule, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    slots.forEach(function (slot) { io.observe(slot.el); });
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  if (mq.addEventListener) mq.addEventListener("change", function () {
    reduce = mq.matches;
    schedule();
  });
  schedule();
})();
