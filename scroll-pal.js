/* Scroll companion. Travel is a series of short hops along the rail.
   Down the page the head points down. Up the page the head points up.
   When the hops finish it holds the still pose for the section in view.
   Hidden near money, the sample week, and legal lines. Reduced motion
   never builds it. */
(function () {
  var root = document.getElementById("scroll-pal");
  if (!root) return;
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq.matches) return;

  var mover = root.querySelector(".scroll-pal-mover");
  var hopEl = root.querySelector(".scroll-pal-hop");
  var rail = root.querySelector(".scroll-pal-rail");
  var imgs = root.querySelectorAll(".pal-img");
  var dots = root.querySelectorAll(".scroll-pal-dot");
  var hero = document.querySelector(".hero");
  var hides = document.querySelectorAll(".pal-hide");
  var marks = [];
  var nodes = document.querySelectorAll("[data-pal]");
  for (var i = 0; i < nodes.length; i++) {
    var section = nodes[i].closest("section");
    var dot = nodes[i].id || (section && section.id) || (nodes[i].tagName === "FOOTER" ? "footer" : "");
    marks.push({ el: nodes[i], pose: nodes[i].getAttribute("data-pal"), dot: dot });
  }

  var crest = document.querySelector(".crest-mark");
  if (crest && hopEl) {
    var clone = crest.cloneNode(true);
    clone.setAttribute("class", "pal-img pal-crest");
    clone.setAttribute("data-pose", "crest");
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("focusable", "false");
    var tagged = clone.querySelectorAll("[id]");
    for (var c = 0; c < tagged.length; c++) tagged[c].removeAttribute("id");
    hopEl.appendChild(clone);
    imgs = root.querySelectorAll(".pal-img");
  }

  var pose = "leap";
  var face = 1;
  var landY = 0;
  var hop = null;
  var lastHopAt = -1000;
  var placed = false;
  var lastY = window.scrollY || 0;
  var lastAt = 0;
  var raf = 0;
  var running = false;
  var reported = false;
  var activeDot = "";
  var HOP_MS = 360;
  var leapImg = hopEl.querySelector("[data-pose='leap']");
  var trip = null;
  var tripBack = false;
  var used = {};
  var nextTripAt = 0;
  var REST_MS = 1500;
  var GAP_MS = 4500;
  var SIT_MS = 2800;
  var restTimer = 0;

  function report(on) {
    if (reported === on) return;
    reported = on;
    if (window.HonestPingMotion) window.HonestPingMotion.companionMoving(on);
  }

  function maxScroll() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function metrics() {
    var mobile = window.innerWidth < 720;
    var size = mobile ? 40 : 64;
    var railH = rail ? rail.getBoundingClientRect().height : window.innerHeight - 96;
    if (railH < size + 8) railH = size + 8;
    return { size: size, railH: railH };
  }

  function blocksView(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var vh = window.innerHeight || 1;
    var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (vis <= 0) return false;
    if (r.height <= 180) return vis >= r.height * 0.5;
    var mid = (r.top + r.bottom) / 2;
    return vis >= 120 && mid > vh * 0.08 && mid < vh * 0.92;
  }

  function heroGone() {
    if (!hero) return true;
    return hero.getBoundingClientRect().bottom <= 8;
  }

  function coversButton() {
    if (window.innerWidth >= 720) return false;
    var zoneTop = window.innerHeight - 168;
    var zoneLeft = window.innerWidth - 64;
    var buttons = document.querySelectorAll("a.btn, button");
    for (var b = 0; b < buttons.length; b++) {
      var r = buttons[b].getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.bottom > zoneTop && r.top < window.innerHeight && r.right > zoneLeft && r.left < window.innerWidth) return true;
    }
    return false;
  }

  function away() {
    if (!heroGone()) return true;
    for (var h = 0; h < hides.length; h++) {
      if (blocksView(hides[h])) return true;
    }
    if (window.innerWidth < 720) {
      var wait = document.getElementById("waitlist");
      if (wait && blocksView(wait)) return true;
    }
    return coversButton();
  }

  function focusMark() {
    var best = null;
    var bestScore = -1;
    var vh = window.innerHeight || 1;
    for (var m = 0; m < marks.length; m++) {
      var r = marks[m].el.getBoundingClientRect();
      var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (vis < 24) continue;
      var mid = (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2;
      var score = vis - Math.abs(mid - vh * 0.42) * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = marks[m];
      }
    }
    return best;
  }

  function showPose(name) {
    if (pose === name) return;
    pose = name;
    for (var n = 0; n < imgs.length; n++) {
      imgs[n].classList.toggle("is-on", imgs[n].getAttribute("data-pose") === name);
    }
  }

  function placeDots() {
    var doc = maxScroll();
    var box = metrics();
    for (var d = 0; d < dots.length; d++) {
      var el = document.getElementById(dots[d].getAttribute("data-for"));
      if (!el) continue;
      var y = el.getBoundingClientRect().top + (window.scrollY || 0);
      var p = Math.max(0, Math.min(1, y / doc));
      var center = box.size / 2 + p * Math.max(0, box.railH - box.size);
      dots[d].style.transform = "translate3d(-50%," + (center - 3).toFixed(1) + "px,0)";
    }
  }

  function goalY(box) {
    var p = Math.max(0, Math.min(1, (window.scrollY || 0) / maxScroll()));
    return p * Math.max(0, box.railH - box.size);
  }

  function ease(u) {
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }

  function paint(x, y, lift, dx, dy) {
    mover.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0)";
    hopEl.style.transform = "translate3d(0," + (-lift).toFixed(2) + "px,0)";
    if (!leapImg) return;
    if (Math.abs(dy) > Math.abs(dx) + 6) {
      leapImg.style.transform = "rotate(" + (dy > 0 ? 90 : -90) + "deg)";
    } else if (dx < -6) {
      leapImg.style.transform = "scaleX(-1)";
    } else {
      leapImg.style.transform = "none";
    }
  }

  function settle() {
    var mark = focusMark();
    showPose(mark ? mark.pose : "rest");
    var nextDot = mark ? mark.dot : "";
    if (nextDot !== activeDot) {
      activeDot = nextDot;
      for (var k = 0; k < dots.length; k++) {
        dots[k].classList.toggle("is-here", dots[k].getAttribute("data-for") === activeDot);
      }
    }
    paint(0, landY, 0, 0, 0);
    report(false);
  }

  function moverOrigin() {
    var pal = root.getBoundingClientRect();
    return { x: pal.left + 4, y: pal.top };
  }

  function spotFor(el, box) {
    var r = el.getBoundingClientRect();
    var origin = moverOrigin();
    var size = box.size;
    var vx;
    var vy;
    if (el.getAttribute("data-perch") === "hops") {
      vx = r.left + r.width / 2 - size / 2;
      vy = r.top - size + 10;
    } else {
      vx = r.right - size * 0.82;
      vy = r.top - size + 16;
    }
    vx = Math.max(12, Math.min(vx, window.innerWidth - size - 8));
    vy = Math.max(8, Math.min(vy, window.innerHeight - size - 8));
    return { x: vx - origin.x, y: vy - origin.y, vx: vx, vy: vy };
  }

  function blockedSpot(spot, size) {
    if (spot.vx < window.innerWidth * 0.42) return true;
    var nodes = document.querySelectorAll(".pal-hide, a.btn, button, .waitlist-form");
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > spot.vx && r.left < spot.vx + size && r.bottom > spot.vy && r.top < spot.vy + size) return true;
    }
    return false;
  }

  function pickPerch(box) {
    if (window.innerWidth < 720) return null;
    var mark = focusMark();
    if (!mark) return null;
    var section = mark.el.closest("section");
    var sid = section ? section.id : "";
    if (!sid || used[sid]) return null;
    var all = document.querySelectorAll("[data-perch]");
    var best = null;
    var bestD = 1e9;
    var vh = window.innerHeight || 1;
    var preferHops = mark.el.classList.contains("hop-explain") || (mark.el.closest && mark.el.closest(".hop-explain"));
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var host = el.closest("section");
      if (!host || host.id !== sid) continue;
      if (preferHops && el.getAttribute("data-perch") !== "hops") continue;
      if (!preferHops && el.getAttribute("data-perch") === "hops") continue;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.bottom < 48 || r.top > vh - 36) continue;
      var mid = (r.top + r.bottom) / 2;
      var d = Math.abs(mid - vh * 0.46);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    }
    if (!best) return null;
    var name = best.getAttribute("data-perch");
    var els = [];
    for (var j = 0; j < all.length; j++) {
      if (all[j].getAttribute("data-perch") !== name) continue;
      var home = all[j].closest("section");
      if (!home || home.id !== sid) continue;
      els.push(all[j]);
    }
    els.sort(function (a, b) {
      return (parseInt(a.getAttribute("data-perch-i"), 10) || 0) - (parseInt(b.getAttribute("data-perch-i"), 10) || 0);
    });
    var spots = [];
    for (var s = 0; s < els.length; s++) {
      var spot = spotFor(els[s], box);
      if (blockedSpot(spot, box.size)) return null;
      spots.push(spot);
    }
    if (!spots.length) return null;
    return { sid: sid, pose: mark.pose, spots: spots };
  }

  function arcDur(count) {
    return Math.max(420, Math.min(700, Math.floor(2400 / Math.max(1, count))));
  }

  function beginOut(group) {
    var from = { x: 0, y: landY };
    var pts = [from];
    if (group.spots.length === 1) {
      var end = group.spots[0];
      pts.push({ x: from.x + (end.x - from.x) * 0.55, y: Math.min(from.y, end.y) - 26 });
      pts.push(end);
    } else {
      for (var i = 0; i < group.spots.length; i++) pts.push(group.spots[i]);
    }
    trip = {
      phase: "out",
      pts: pts,
      i: 0,
      arc: null,
      sid: group.sid,
      pose: group.pose,
      dur: arcDur(pts.length - 1),
      sitUntil: 0
    };
    used[group.sid] = true;
    tripBack = false;
    armArc(performance.now());
  }

  function armArc(now) {
    trip.arc = {
      from: trip.pts[trip.i],
      to: trip.pts[trip.i + 1],
      t0: now,
      dur: trip.dur
    };
  }

  function beginBack(now, goal) {
    var cur = trip.arc ? atArc(Math.min(1, (now - trip.arc.t0) / trip.arc.dur)) : trip.pts[trip.pts.length - 1];
    if (trip.phase === "sit") cur = trip.pts[trip.pts.length - 1];
    var end = { x: 0, y: goal };
    var mid = { x: cur.x * 0.42, y: Math.min(cur.y, end.y) - 22 };
    trip.phase = "back";
    trip.pts = [cur, mid, end];
    trip.i = 0;
    trip.dur = 700;
    trip.sitUntil = 0;
    tripBack = false;
    armArc(now);
  }

  function atArc(u) {
    var e = ease(u);
    var a = trip.arc.from;
    var b = trip.arc.to;
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
  }

  function runTrip(now, box, goal) {
    if (tripBack && trip.phase !== "back") beginBack(now, goal);
    if (trip.phase === "sit") {
      var seat = trip.pts[trip.pts.length - 1];
      paint(seat.x, seat.y, 0, 0, 0);
      showPose(trip.pose || "rest");
      report(true);
      if (now >= trip.sitUntil) beginBack(now, goal);
      return;
    }
    var u = Math.min(1, (now - trip.arc.t0) / trip.arc.dur);
    var pos = atArc(u);
    var lift = Math.sin(Math.PI * u) * box.size * 0.33;
    var dx = trip.arc.to.x - trip.arc.from.x;
    var dy = trip.arc.to.y - trip.arc.from.y;
    paint(pos.x, pos.y, lift, dx, dy);
    showPose("leap");
    report(true);
    if (u < 1) return;
    trip.i += 1;
    if (trip.i < trip.pts.length - 1) {
      armArc(now);
      return;
    }
    if (trip.phase === "out") {
      trip.phase = "sit";
      trip.arc = null;
      trip.sitUntil = now + SIT_MS;
      return;
    }
    landY = goal;
    nextTripAt = now + GAP_MS;
    trip = null;
    settle();
  }

  function frame(now) {
    if (document.hidden || mq.matches) {
      report(false);
      raf = 0;
      running = false;
      return;
    }
    var box = metrics();
    var goal = goalY(box);
    var hidden = away();
    root.classList.toggle("is-away", hidden);
    var mobile = window.innerWidth < 720;
    var dead = mobile ? 6 : 10;
    var step = mobile ? 14 : 40;

    if (hidden || !placed) {
      trip = null;
      hop = null;
      landY = goal;
      placed = true;
      paint(0, landY, 0, 0, 0);
      report(false);
      raf = 0;
      running = false;
      return;
    }
    if (mobile) {
      trip = null;
      tripBack = false;
    }

    if (trip && !mobile) {
      runTrip(now, box, goal);
      if (trip) {
        raf = requestAnimationFrame(frame);
        return;
      }
    }

    if (hop) {
      var u = Math.min(1, (now - hop.t0) / hop.dur);
      var along = hop.from + (hop.to - hop.from) * ease(u);
      var lift = Math.sin(Math.PI * u) * box.size * 0.33;
      paint(0, along, lift, 0, (hop.to - hop.from) || hop.dir);
      showPose("leap");
      report(true);
      if (u < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      landY = hop.to;
      face = hop.dir;
      hop = null;
    }

    var gap = goal - landY;
    var abs = Math.abs(gap);
    var scrolling = (now - lastAt) < 160;
    var ready = (now - lastHopAt) >= HOP_MS;
    if (ready && abs >= (scrolling ? step * 0.85 : dead)) {
      var dir = gap > 0 ? 1 : -1;
      var mag = abs;
      if (abs > step) mag = Math.min(abs, step + Math.min(step, (abs - step) * 0.35));
      hop = { from: landY, to: landY + dir * mag, t0: now, dur: HOP_MS, dir: dir };
      lastHopAt = now;
      face = dir;
      raf = requestAnimationFrame(frame);
      return;
    }

    if (abs < dead) landY = goal;
    settle();
    if (!mobile && !scrolling) {
      var due = Math.max(lastAt + REST_MS, nextTripAt);
      if (now >= due) {
        var group = pickPerch(box);
        if (group) {
          beginOut(group);
          raf = requestAnimationFrame(frame);
          return;
        }
      } else {
        armRest(due - now);
      }
    }
    raf = 0;
    running = false;
  }

  function armRest(ms) {
    if (restTimer) return;
    restTimer = setTimeout(function () {
      restTimer = 0;
      kick();
    }, Math.max(40, ms));
  }

  function kick() {
    if (restTimer) {
      clearTimeout(restTimer);
      restTimer = 0;
    }
    if (running || document.hidden || mq.matches) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", function () {
    var y = window.scrollY || 0;
    var delta = y - lastY;
    if (Math.abs(delta) >= 6) {
      if (delta > 0) face = 1;
      else face = -1;
      lastAt = performance.now();
      if (trip) tripBack = true;
    }
    lastY = y;
    kick();
  }, { passive: true });

  window.addEventListener("resize", function () {
    placeDots();
    trip = null;
    tripBack = false;
    hop = null;
    placed = false;
    kick();
  });

  document.addEventListener("visibilitychange", function () {
    var t = performance.now();
    if (document.hidden) {
      report(false);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      if (hop) hop.hold = t;
      if (trip) trip.hold = t;
      return;
    }
    if (hop && hop.hold) {
      hop.t0 += t - hop.hold;
      hop.hold = 0;
    }
    if (trip && trip.hold) {
      var slipped = t - trip.hold;
      if (trip.arc) trip.arc.t0 += slipped;
      if (trip.sitUntil) trip.sitUntil += slipped;
      trip.hold = 0;
    }
    kick();
  });

  if (mq.addEventListener) mq.addEventListener("change", function () {
    if (mq.matches) {
      report(false);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    }
  });

  placeDots();
  kick();
})();
