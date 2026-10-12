/* One mascot moves at a time. A one-shot plays once, then holds its still.
   A loop plays only while it is the mascot on screen. A hidden tab, an
   off-screen mascot, or reduced motion stays on the still frame. */
(function () {
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = mq.matches;
  var apis = {
    crest: window.HonestPingCrest,
    hero: window.HonestPingHero,
    turn: window.HonestPingTurn
  };
  var slots = [];
  var active = null;
  var raf = 0;
  var pending = false;
  var blockCrest = false;
  var companionOn = false;
  var hopOn = false;
  var MIN = 0.25;

  function syncSleep() {
    var nodes = document.querySelectorAll("[data-sleep]");
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var r = el.getBoundingClientRect();
      var inView = r.width > 0 && r.bottom > 24 && r.top < (window.innerHeight || 1) - 24;
      var block = companionOn || hopOn || document.hidden;
      el.classList.toggle("is-live", inView && !reduce && !block);
      el.classList.toggle("is-hold", inView && !reduce && block);
    }
  }

  window.HonestPingMotion = {
    companionMoving: function (on) {
      companionOn = !!on;
      blockCrest = companionOn || hopOn;
      schedule();
      syncSleep();
    },
    hopCardMoving: function (on) {
      hopOn = !!on;
      blockCrest = companionOn || hopOn;
      schedule();
      syncSleep();
    },
    hopIsMoving: function () {
      return hopOn;
    }
  };

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
      if (slot.once && slot.done) continue;
      if (blockCrest && slot.el.getAttribute("data-mascot") === "crest") continue;
      var box = measure(slot.el);
      slot.ratio = box.ratio;
      if (box.ratio < MIN) continue;
      var rank = box.ratio * 10 - box.dist + slot.priority;
      if (slot.once) rank += 8;
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
    active = null;
  }

  function tick(now) {
    if (!active) {
      raf = 0;
      return;
    }
    if (reduce || document.hidden || measure(active.el).ratio < MIN) {
      var gone = active;
      if (gone.once) gone.done = true;
      halt();
      rest(gone);
      reconcile();
      return;
    }
    var elapsed = (now - active.t0) / 1000;
    if (active.once && elapsed >= active.api.loop) {
      var done = active;
      done.done = true;
      halt();
      rest(done);
      reconcile();
      return;
    }
    active.api.draw(elapsed);
    raf = requestAnimationFrame(tick);
  }

  function start(slot) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] !== slot) rest(slots[i]);
    }
    slot.t0 = performance.now();
    active = slot;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function reconcile() {
    if (reduce || document.hidden) {
      if (active && active.once) active.done = true;
      halt();
      for (var i = 0; i < slots.length; i++) rest(slots[i]);
      return;
    }
    var next = winner();
    for (var k = 0; k < slots.length; k++) {
      if (slots[k] !== next) rest(slots[k]);
    }
    if (!next) {
      if (active) {
        var idle = active;
        if (idle.once) idle.done = true;
        halt();
        rest(idle);
      }
      return;
    }
    if (active === next) return;
    if (active) {
      var prev = active;
      if (prev.once) prev.done = true;
      halt();
      rest(prev);
    }
    start(next);
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      reconcile();
      syncSleep();
    });
  }

  document.querySelectorAll("[data-mascot]").forEach(function (el) {
    var api = apis[el.getAttribute("data-mascot")];
    if (!api || typeof api.draw !== "function") return;
    var slot = {
      el: el,
      api: api,
      once: !!api.once,
      done: false,
      priority: api.once ? 40 : 10,
      t0: 0,
      ratio: 0
    };
    slots.push(slot);
    rest(slot);
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
