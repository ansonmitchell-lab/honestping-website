/* One mascot moves at a time. The most visible one wins. The scroll
   companion and the hop card count: while either is moving, every
   section accent holds its still. A one-shot plays once (a loop plays
   two or three passes), then rests. Hover or focus replays it once.
   A hidden tab, an off-screen mascot, or reduced motion stays still. */
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
    listen: 2.4,
    crouch: 1.8,
    watch: 2.4,
    glance: 1.6,
    face: 2.2,
    peek: 2.0,
    blink: 2.0,
    zoomies: 2.2
  };
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
      var rw = runner.offsetWidth || 48;
      var rh = runner.offsetHeight || 48;
      var w = Math.max(24, el.clientWidth - rw - 8);
      var h = Math.max(16, el.clientHeight - rh - 8);
      var restX = w;
      var restY = Math.max(0, (el.clientHeight - rh) * 0.35);
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
      var per = 2 * (w + h);
      var d = u * per;
      var x;
      var y;
      var face;
      if (d < w) { x = d; y = 0; face = 1; }
      else if (d < w + h) { x = w; y = d - w; face = -1; }
      else if (d < 2 * w + h) { x = w - (d - w - h); y = h; face = -1; }
      else { x = 0; y = h - (d - 2 * w - h); face = 1; }
      var hop = Math.abs(Math.sin(u * Math.PI * 5)) * (rh / 3);
      pose("leap");
      runner.style.transform = "translate3d(" + x.toFixed(1) + "px," + (y - hop).toFixed(1) + "px,0) scaleX(" + face + ")";
    };
  }

  function actApi(el) {
    var name = el.getAttribute("data-act");
    var dur = ACT[name];
    if (!dur) return null;
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

  function winner() {
    if (reduce || document.hidden || blocked()) return null;
    var best = null;
    var bestRank = -1;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.once && slot.done) continue;
      if (blockCrest && slot.el.getAttribute("data-mascot") === "crest") continue;
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
