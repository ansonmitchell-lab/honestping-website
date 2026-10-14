/* One mascot moves at a time. The most visible one wins. The scroll
   companion and the hop card count: while either is moving, every
   section accent holds its still. A one-shot plays once (a loop plays
   two or three passes), then rests. Hover or focus replays it once.
   The gamer tier hop runs right to left, then the crest snicker plays
   while that rabbit stays still. A hidden tab, an off-screen mascot,
   or reduced motion stays still. */
(function () {
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = mq.matches;
  var apis = {
    crest: window.HonestPingCrest,
    hero: window.HonestPingHero,
    turn: window.HonestPingTurn
  };
  var ACT = {
    quick: 2.2,
    days: 2.6,
    watch: 2.6,
    stack: 2.2,
    tape: 2.2,
    wave: 2.2,
    claim: 2.4,
    climb: 2.2,
    hats: 2.8,
    bye: 2.2,
    house: 2.4,
    zoomies: 2.2,
    tierhop: 2.5
  };
  var TIER_HOP = 0.5;
  var TIER_HOPS = 5;
  var slots = [];
  var active = null;
  var raf = 0;
  var pending = false;
  var blockCrest = false;
  var companionOn = false;
  var hopOn = false;
  var MIN = 0.25;

  function blocked() {
    return companionOn || hopOn;
  }

  function cssDraw(el, dur) {
    var primed = false;
    return function (t) {
      if (t >= dur - 0.02) {
        el.classList.remove("is-act");
        return;
      }
      if (!primed) {
        el.classList.remove("is-act");
        void el.offsetWidth;
        primed = true;
      }
      if (!el.classList.contains("is-act")) el.classList.add("is-act");
    };
  }

  function zoomDraw(el, dur) {
    return function (t) {
      var runner = el.querySelector(".zoom-runner");
      var leap = el.querySelector(".zoom-leap");
      var sit = el.querySelector(".zoom-sit");
      var front = el.querySelector(".zoom-front");
      var grin = el.querySelector(".zoom-grin");
      if (!runner) return;
      var rw = runner.offsetWidth || 32;
      var rh = runner.offsetHeight || 32;
      var w = Math.max(24, el.clientWidth - rw - 16);
      var h = Math.max(16, el.clientHeight - rh - 12);
      var restX = w;
      var restY = Math.max(0, (el.clientHeight - rh) * 0.42);
      function pose(which) {
        if (leap) leap.hidden = which !== "leap";
        if (sit) sit.hidden = which !== "sit";
        if (front) front.hidden = which !== "front";
        if (grin) {
          if (which === "front") grin.removeAttribute("hidden");
          else grin.setAttribute("hidden", "");
        }
      }
      function park(snicker, sy) {
        pose(snicker ? "front" : "sit");
        var squash = sy == null ? 1 : sy;
        runner.style.transform = "translate3d(" + restX.toFixed(1) + "px," + restY.toFixed(1) + "px,0) scale(1," + squash.toFixed(3) + ")";
        if (grin && snicker) grin.style.transform = "scaleX(" + (1 + (1 - squash) * 3).toFixed(3) + ")";
      }
      if (reduce || t < 0) {
        park(false, 1);
        return;
      }
      if (t >= dur) {
        park(true, 1);
        return;
      }
      var land = dur - 0.4;
      if (t >= land) {
        var k = (t - land) / 0.4;
        var wave = Math.sin(Math.min(1, k) * Math.PI);
        park(true, 1 - wave * 0.1);
        return;
      }
      var u = t / land;
      var up = Math.max(0, restY);
      var down = Math.max(0, h - restY);
      var segs = [up, w, h, w, down];
      var per = up + w + h + w + down;
      var d = u * per;
      var x = restX;
      var y = restY;
      var face = -1;
      if (d < segs[0]) { x = w; y = restY - d; face = -1; }
      else if (d < segs[0] + segs[1]) { x = w - (d - segs[0]); y = 0; face = -1; }
      else if (d < segs[0] + segs[1] + segs[2]) { x = 0; y = d - segs[0] - segs[1]; face = 1; }
      else if (d < per - segs[4]) { x = d - segs[0] - segs[1] - segs[2]; y = h; face = 1; }
      else { x = w; y = h - (d - (per - segs[4])); face = -1; }
      var hop = Math.abs(Math.sin(u * Math.PI * 6)) * (rh / 4);
      pose("leap");
      runner.style.transform = "translate3d(" + x.toFixed(1) + "px," + (y - hop).toFixed(1) + "px,0) scaleX(" + face + ")";
    };
  }

  function tierStill(el) {
    if (reduce) return true;
    if (window.matchMedia("(max-width: 800px)").matches) return true;
    var cards = el.querySelectorAll(".tier-card");
    if (cards.length < 5) return true;
    var a = cards[0].getBoundingClientRect();
    var b = cards[cards.length - 1].getBoundingClientRect();
    if (a.width < 8 || Math.abs(a.top - b.top) > 12) return true;
    if (el.scrollWidth > el.clientWidth + 8) return true;
    return false;
  }

  function tierDraw(el) {
    var dur = TIER_HOP * TIER_HOPS;
    return function (t) {
      var runner = el.querySelector(".tier-runner");
      var leap = el.querySelector(".tier-leap");
      var sit = el.querySelector(".tier-sit");
      var cards = el.querySelectorAll(".tier-card");
      if (!runner || !cards.length) return;
      function showSit(on) {
        if (leap) leap.hidden = on;
        if (sit) sit.hidden = !on;
      }
      function perch(card) {
        var rr = el.getBoundingClientRect();
        var cr = card.getBoundingClientRect();
        var rw = runner.offsetWidth || 48;
        var rh = runner.offsetHeight || 52;
        return {
          x: cr.left + cr.width / 2 - rr.left - rw / 2,
          y: cr.top - rr.top - rh + 4
        };
      }
      function put(p, face) {
        runner.style.transform = "translate3d(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px,0) scaleX(" + face + ")";
        el.classList.add("is-tier-placed");
      }
      function points() {
        var pads = [];
        var n;
        for (n = cards.length - 1; n >= 0; n--) pads.push(perch(cards[n]));
        var gap = Math.max(36, cards[cards.length - 1].offsetWidth * 0.72);
        var start = { x: pads[0].x + gap, y: pads[0].y };
        var maxX = Math.max(pads[0].x + 16, el.clientWidth - (runner.offsetWidth || 48) + 8);
        if (start.x > maxX) start.x = maxX;
        return [start].concat(pads);
      }
      function park() {
        showSit(true);
        put(perch(cards[0]), 1);
        el.classList.add("is-tier-placed");
      }
      if (tierStill(el) || t >= dur) {
        park();
        return;
      }
      if (t < 0) {
        showSit(false);
        put(points()[0], -1);
        el.classList.add("is-tier-placed");
        return;
      }
      var pts = points();
      var idx = Math.min(TIER_HOPS - 1, Math.floor(t / TIER_HOP));
      var u = (t - idx * TIER_HOP) / TIER_HOP;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      var from = pts[idx];
      var to = pts[idx + 1];
      var arc = 11;
      var landing = idx === TIER_HOPS - 1 && u > 0.84;
      showSit(landing);
      put({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * u) * arc
      }, landing ? 1 : -1);
    };
  }

  function actApi(el) {
    var name = el.getAttribute("data-act");
    var dur = ACT[name];
    if (!dur) return null;
    if (name === "tierhop") {
      return {
        draw: tierDraw(el),
        restTime: -1,
        get loop() { return tierStill(el) ? 0.04 : dur; },
        once: true
      };
    }
    var draw = name === "zoomies" ? zoomDraw(el, dur) : cssDraw(el, dur);
    return { draw: draw, restTime: dur, loop: dur, once: true };
  }

  function sleepApi(el) {
    var dur = 7.2;
    return {
      once: true,
      loop: dur,
      restTime: dur,
      draw: function (t) {
        if (t >= dur - 0.02) {
          el.classList.remove("is-live");
          el.classList.add("is-rest");
          el.classList.remove("is-hold");
          return;
        }
        el.classList.add("is-live");
        el.classList.remove("is-hold");
        el.classList.remove("is-rest");
      }
    };
  }

  function rest(slot) {
    if (slot.sleep) {
      slot.el.classList.remove("is-live");
      if (slot.done) {
        slot.el.classList.add("is-rest");
        slot.el.classList.remove("is-hold");
        return;
      }
      slot.el.classList.remove("is-rest");
      var r = slot.el.getBoundingClientRect();
      var inView = r.width > 0 && r.bottom > 24 && r.top < (window.innerHeight || 1) - 24;
      slot.el.classList.toggle("is-hold", inView && !reduce && blocked());
      return;
    }
    if (slot.api && typeof slot.api.draw === "function") {
      if (slot.el.getAttribute("data-act") === "tierhop") {
        slot.api.draw(slot.done && !reduce ? slot.api.loop : -1);
        return;
      }
      var at = slot.api.restTime;
      if (slot.el.getAttribute("data-act") === "zoomies" && (!slot.done || reduce)) at = -1;
      slot.api.draw(at);
    }
  }

  window.HonestPingMotion = {
    companionMoving: function (on) {
      companionOn = !!on;
      blockCrest = blocked();
      schedule();
    },
    hopCardMoving: function (on) {
      hopOn = !!on;
      blockCrest = blocked();
      schedule();
    },
    hopIsMoving: function () {
      return hopOn;
    },
    accentMoving: function () {
      return !!active;
    }
  };

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

  function tierHopPending() {
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.el.getAttribute("data-act") !== "tierhop" || slot.done) continue;
      if (tierStill(slot.el)) return false;
      if (measure(slot.el).ratio >= MIN) return true;
    }
    return false;
  }

  function winner() {
    if (reduce || document.hidden || blocked()) return null;
    var holdCrest = blockCrest || tierHopPending();
    var best = null;
    var bestRank = -1;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.once && slot.done) continue;
      if (holdCrest && slot.el.getAttribute("data-mascot") === "crest") continue;
      var box = measure(slot.el);
      slot.ratio = box.ratio;
      if (box.ratio < MIN) continue;
      var rank = box.ratio * 10 - box.dist + slot.priority + (slot.boost || 0);
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
    if (reduce || document.hidden || blocked()) {
      var paused = active;
      halt();
      rest(paused);
      return;
    }
    if (measure(active.el).ratio < MIN) {
      var gone = active;
      gone.boost = 0;
      halt();
      rest(gone);
      reconcile();
      return;
    }
    var elapsed = (now - active.t0) / 1000;
    if (active.once && elapsed >= active.api.loop) {
      var done = active;
      done.done = true;
      done.boost = 0;
      halt();
      rest(done);
      if (done.el.getAttribute("data-act") === "tierhop") {
        for (var c = 0; c < slots.length; c++) {
          if (slots[c].el.getAttribute("data-mascot") === "crest" && !slots[c].done) slots[c].boost = 40;
        }
      }
      reconcile();
      return;
    }
    active.api.draw(elapsed);
    raf = requestAnimationFrame(tick);
  }

  function quietCompanion() {
    var pal = document.getElementById("scroll-pal");
    if (!pal) return;
    pal.classList.remove("is-breathe", "is-dust");
  }

  function start(slot) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] !== slot) rest(slots[i]);
    }
    quietCompanion();
    slot.t0 = performance.now();
    active = slot;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function reconcile() {
    if (reduce || document.hidden || blocked()) {
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
        idle.boost = 0;
        halt();
        rest(idle);
      }
      return;
    }
    if (active === next) return;
    if (active) {
      var prev = active;
      prev.boost = 0;
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
    });
  }

  function replay(slot) {
    if (reduce || document.hidden || blocked()) return;
    if (active === slot && !slot.once) return;
    if (slot.el.getAttribute("data-act") === "tierhop") {
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].el.getAttribute("data-mascot") === "crest") {
          slots[i].done = false;
          slots[i].boost = 0;
        }
      }
    }
    slot.done = false;
    slot.boost = 30;
    schedule();
  }

  function addSlot(el, api, opts) {
    if (!api || typeof api.draw !== "function") return;
    var slot = {
      el: el,
      api: api,
      once: !!api.once,
      done: false,
      priority: opts.priority,
      boost: 0,
      sleep: !!opts.sleep,
      t0: 0,
      ratio: 0
    };
    slots.push(slot);
    rest(slot);
    if (opts.replay) {
      el.addEventListener("pointerenter", function () { replay(slot); });
      el.addEventListener("focusin", function () { replay(slot); });
    }
  }

  document.querySelectorAll("[data-mascot]").forEach(function (el) {
    var name = el.getAttribute("data-mascot");
    var api = apis[name];
    addSlot(el, api, { priority: name === "turn" ? 36 : 12, replay: !!(api && api.once) });
  });

  document.querySelectorAll("[data-act]").forEach(function (el) {
    var onceView = el.getAttribute("data-act") === "zoomies";
    addSlot(el, actApi(el), { priority: 16, replay: !onceView });
  });

  document.querySelectorAll("[data-sleep]").forEach(function (el) {
    addSlot(el, sleepApi(el), { priority: 14, sleep: true, replay: false });
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
