/* Scroll companion. No rail. Scroll progress walks a path of perches
   down the page, and the rabbit hops between the left and right sides.
   Each section has a perch, a pose, a tiny hex prop, and one short
   landing action. The 7-day good-news card owns the zoomies lap.
   The coin-roll tumble stays in this file and stays off.
   Hidden near money tiles, the sample week, and legal lines.
   Reduced motion never builds it. */
(function () {
  var COIN_ROLL_ENABLED = false;
  var root = document.getElementById("scroll-pal");
  if (!root) return;
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq.matches) return;

  var mover = root.querySelector(".scroll-pal-mover");
  var hopEl = root.querySelector(".scroll-pal-hop");
  var actEl = root.querySelector(".pal-act") || hopEl;
  var pile = null;
  var imgs = root.querySelectorAll(".pal-img");
  var hero = document.querySelector(".hero");
  var hides = document.querySelectorAll(".pal-hide");
  var crest = document.querySelector(".crest-mark");
  if (crest && hopEl) {
    var clone = crest.cloneNode(true);
    clone.setAttribute("class", "pal-img pal-crest");
    clone.setAttribute("data-pose", "crest");
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("focusable", "false");
    var tagged = clone.querySelectorAll("[id]");
    for (var c = 0; c < tagged.length; c++) tagged[c].removeAttribute("id");
    actEl.appendChild(clone);
    imgs = root.querySelectorAll(".pal-img");
  }

  var HOP_MS = 340;
  var REST_MS = 1500;
  var GAP_MS = 5200;
  var SIT_MS = 1000;
  var CASH_MS = 2100;
  var REPLAY_MS = 30000;
  var ACT_MS = {
    launch: 1150,
    ready: 1700,
    listen: 1350,
    watch: 1600,
    glance: 1300,
    turn: 1900,
    peek: 1350,
    blink: 1050,
    nod: 1150,
    settle: 900
  };

  var pts = [];
  var landI = 0;
  var pos = { x: 24, y: 120 };
  var hop = null;
  var excursion = null;
  var cash = null;
  var cashPlayed = false;
  var cashLeftAt = 0;
  var act = null;
  var acted = {};
  var visitSid = "";
  var placed = false;
  var lastY = window.scrollY || 0;
  var baseY = lastY;
  var armed = false;
  var lastAt = 0;
  var nextEx = 0;
  var raf = 0;
  var running = false;
  var reported = false;
  var restTimer = 0;
  var pose = "leap";
  var leapImg = hopEl.querySelector("[data-pose='leap']");

  function report(on) {
    if (reported === on) return;
    reported = on;
    if (window.HonestPingMotion) window.HonestPingMotion.companionMoving(on);
  }

  function ease(u) {
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function pageTop(el) {
    return el.getBoundingClientRect().top + (window.scrollY || 0);
  }

  function add(list, el, kind, side, poseName, actName, prop, sid, pageY) {
    list.push({
      el: el,
      kind: kind,
      side: side,
      pose: poseName,
      act: actName || "",
      prop: prop || "",
      sid: sid,
      pageY: pageY
    });
  }

  function build() {
    var list = [];
    var sections = document.querySelectorAll("main > section[id]");
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      if (sec.classList.contains("pal-hide")) continue;
      var sid = sec.id;
      var head = sec.querySelector("h2") || sec;
      if (sid === "free") {
        add(list, sec, "theme", -1, "leap", "launch", "", sid, pageTop(sec) + 20);
        add(list, sec, "gap", 1, "leap", "", "", sid, pageTop(sec) - 28);
      } else if (sid === "gamers") {
        var tiers = sec.querySelector(".tier-row") || head;
        add(list, tiers, "theme", 1, "sit", "ready", "pad", sid, pageTop(tiers) - 8);
        add(list, sec, "gap", -1, "sit", "", "", sid, pageTop(sec) - 28);
      } else if (sid === "isp") {
        var mark = sec.querySelector(".isp-mark") || head;
        add(list, sec, "gap", -1, "rest", "", "", sid, pageTop(sec) - 28);
        if (COIN_ROLL_ENABLED) {
          add(list, mark, "cash", 1, "rest", "cash", "", sid, pageTop(mark) + 16);
        }
        var extras = [".isp-flow", ".isp-proof", ".uses-card"];
        for (var e = 0; e < extras.length; e++) {
          var node = sec.querySelector(extras[e]);
          if (!node) continue;
          add(list, node, "head", e % 2 ? 1 : -1, "rest", "", "", sid, pageTop(node) + 12);
        }
      } else if (sid === "wfh") {
        add(list, sec, "theme", -1, "ears", "listen", "headset", sid, pageTop(sec) + 160);
      } else if (sid === "streaming") {
        var screen = sec.querySelector(".streaming-screen") || head;
        add(list, screen, "theme", -1, "sit", "watch", "screen", sid, pageTop(screen) - 6);
        add(list, sec, "gap", 1, "sit", "", "", sid, pageTop(sec) - 28);
      } else if (sid === "value") {
        var hist = sec.querySelector(".value-card-history") || head;
        add(list, hist, "theme", -1, "look", "glance", "", sid, pageTop(hist) + 8);
        add(list, sec, "gap", 1, "look", "", "", sid, pageTop(sec) - 28);
      } else if (sid === "gap") {
        add(list, head, "theme", 1, "rest", "settle", "", sid, pageTop(head) + 8);
        add(list, sec, "gap", -1, "rest", "", "", sid, pageTop(sec) - 28);
      } else if (sid === "benefits") {
        add(list, head, "theme", -1, "ears", "nod", "", sid, pageTop(head) + 8);
        add(list, sec, "gap", 1, "ears", "", "", sid, pageTop(sec) - 28);
      } else if (sid === "preview") {
        var frame = sec.querySelector(".window") || head;
        add(list, frame, "peek", 1, "look", "peek", "", sid, pageTop(frame) + 6);
        add(list, sec, "gap", -1, "look", "", "", sid, pageTop(sec) - 20);
      } else if (sid === "user-types") {
        add(list, head, "theme", 1, "quarter", "turn", "", sid, pageTop(head) + 8);
        add(list, sec, "gap", -1, "quarter", "", "", sid, pageTop(sec) - 28);
      }
    }
    var foot = document.getElementById("footer");
    if (foot) {
      add(list, foot, "theme", -1, "rest", "blink", "", "footer", pageTop(foot) - 24);
      add(list, foot, "gap", 1, "rest", "", "", "footer", pageTop(foot) + 6);
    }
    list.sort(function (a, b) { return a.pageY - b.pageY; });
    var out = [];
    for (var j = 0; j < list.length; j++) {
      var prev = out[out.length - 1];
      if (!prev || list[j].kind === "cash" || list[j].pageY - prev.pageY > 70 || list[j].side !== prev.side) {
        out.push(list[j]);
      }
    }
    pts = out.length ? out : [{ el: document.body, kind: "gap", side: 1, pose: "rest", act: "", prop: "", sid: "footer", pageY: 0 }];
    landI = clamp(landI, 0, pts.length - 1);
  }

  function metrics() {
    return { size: window.innerWidth < 720 ? 40 : 64, mobile: window.innerWidth < 720 };
  }

  function gutters(size) {
    var col = document.querySelector("main .wrap");
    var r = col ? col.getBoundingClientRect() : { left: 16, right: window.innerWidth - 16 };
    var left = r.left - size - 10;
    var right = r.right + 10;
    var wide = left >= 6 && right <= window.innerWidth - size - 6;
    if (!wide) {
      left = 6;
      right = window.innerWidth - size - 6;
    }
    return { left: left, right: right, wide: wide };
  }

  function cornerBlocked(x, y, size) {
    var nodes = document.querySelectorAll("a.btn, button, input, textarea, .waitlist-form, .pal-hide");
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right > x - 6 && r.left < x + size + 6 && r.bottom > y - 6 && r.top < y + size + 6) return true;
    }
    return false;
  }

  function hits(x, y, size, allowMark, allowPeek) {
    var samples = [
      [x + size * 0.5, y + size * 0.62],
      [x + size * 0.22, y + size * 0.72],
      [x + size * 0.78, y + size * 0.72],
      [x + size * 0.5, y + size * 0.28]
    ];
    for (var i = 0; i < samples.length; i++) {
      var el = document.elementFromPoint(samples[i][0], samples[i][1]);
      if (!el || !el.closest) continue;
      if (el.closest("#scroll-pal")) continue;
      if (allowMark && el.closest(".isp-mark")) continue;
      if (allowPeek) {
        var win = el.closest("#preview .window");
        if (win && samples[i][1] <= win.getBoundingClientRect().top + 46) continue;
      }
      if (el.closest(".mascot-accent, .crest-mark, .hero-mascot, .mascot-sleep, .hop-explain, .free-bar, .mascot-play, .pal-hide, .waitlist-form, button, a, input, textarea, h1, h2, h3, h4, p, li, figcaption, label, .section-label, .card, .tier-card")) return true;
    }
    return false;
  }

  function peekSpot(box) {
    var frame = document.querySelector("#preview .window");
    if (!frame) return null;
    var r = frame.getBoundingClientRect();
    var size = box.size;
    var x = r.right - size - 72;
    var y = r.top - 6;
    var hi = Math.min(window.innerHeight - size - 16, window.innerHeight * 0.72);
    if (y < 96 || y > hi) return null;
    if (x < 8 || x > window.innerWidth - size - 8) return null;
    return { x: x, y: y };
  }

  function anchorY(wp) {
    return wp.pageY - (window.scrollY || 0);
  }

  function rawSpot(wp, size) {
    var g = gutters(size);
    var x = wp.side < 0 ? g.left : g.right;
    if (wp.kind === "cash") x = g.right;
    var y = anchorY(wp);
    var lo = 132;
    var hi = Math.min(window.innerHeight - size - 16, window.innerHeight * 0.7);
    if (y < lo || y > hi) return null;
    if (wp.kind === "head" && !g.wide) {
      var sec = wp.el.closest ? (wp.el.closest("section") || wp.el) : wp.el;
      var gapY = sec.getBoundingClientRect().top - size * 0.62;
      if (gapY >= lo && gapY <= hi) y = gapY;
    }
    x = clamp(x, 6, window.innerWidth - size - 6);
    return { x: x, y: y };
  }

  function footerSpot(wp, box) {
    var foot = document.getElementById("footer");
    if (!foot) return null;
    var fr = foot.getBoundingClientRect();
    if (fr.top > window.innerHeight - 24 || fr.bottom < 48) return null;
    var g = gutters(box.size);
    var x = wp.side < 0 ? g.left : g.right;
    var y = clamp(fr.top + 4, 132, window.innerHeight - box.size - 12);
    x = clamp(x, 6, window.innerWidth - box.size - 6);
    if (hits(x, y, box.size, false)) return null;
    return { x: x, y: y };
  }

  function spot(wp, box) {
    if (!wp) return null;
    if (!box.mobile && wp.sid === "footer") {
      var fs = footerSpot(wp, box);
      if (fs) return fs;
    }
    if (!box.mobile && wp.kind === "peek") {
      var pk = peekSpot(box);
      if (pk && !hits(pk.x, pk.y, box.size, false, true)) return pk;
    }
    if (box.mobile) {
      var x = wp.side < 0 ? 8 : window.innerWidth - box.size - 8;
      var y = window.innerHeight - box.size - 14;
      if (cornerBlocked(x, y, box.size)) {
        var x2 = wp.side < 0 ? window.innerWidth - box.size - 8 : 8;
        if (!cornerBlocked(x2, y, box.size)) return { x: x2, y: y };
        return null;
      }
      return { x: x, y: y };
    }
    var s = rawSpot(wp, box.size);
    if (!s) return null;
    if (!hits(s.x, s.y, box.size, wp.kind === "cash")) return s;
    var sec = wp.el.closest ? (wp.el.closest("section") || wp.el) : wp.el;
    var g = gutters(box.size);
    var hi = Math.min(window.innerHeight - box.size - 16, window.innerHeight * 0.7);
    var rawGap = sec.getBoundingClientRect().top - box.size * 0.7;
    if (rawGap < 132 || rawGap > hi) return null;
    var y2 = rawGap;
    var x2 = wp.side < 0 ? g.left : g.right;
    x2 = clamp(x2, 6, window.innerWidth - box.size - 6);
    if (!hits(x2, y2, box.size, false)) return { x: x2, y: y2 };
    return null;
  }

  function goalIndex() {
    var y = (window.scrollY || 0) + window.innerHeight * 0.4;
    var best = 0;
    var bestD = 1e9;
    for (var i = 0; i < pts.length; i++) {
      var d = Math.abs(pts[i].pageY - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    var freeI = -1;
    for (var f = 0; f < pts.length; f++) {
      if (pts[f].sid === "free" && pts[f].act === "launch") freeI = f;
    }
    if (freeI >= 0 && ((!acted.free && heroGone() && onScreen(pts[freeI])) || (act && act.sid === "free"))) return freeI;
    var win = pts[best];
    if (win && !win.act) {
      var alt = -1;
      var altD = 360;
      for (var k = 0; k < pts.length; k++) {
        if (!pts[k].act || pts[k].sid !== win.sid) continue;
        var dk = Math.abs(pts[k].pageY - y);
        if (dk < altD) {
          altD = dk;
          alt = k;
        }
      }
      if (alt >= 0) return alt;
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

  function facePage(x) {
    var col = document.querySelector("main .wrap");
    var r = col ? col.getBoundingClientRect() : { left: 0, right: window.innerWidth };
    var mid = x + metrics().size * 0.5;
    root.classList.toggle("is-look-left", mid > (r.left + r.right) / 2);
  }

  function paint(x, y, lift, dx, dy, roll) {
    pos.x = x;
    pos.y = y;
    mover.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
    var traveling = Math.abs(dx) > 8 || Math.abs(dy) > 8;
    if (roll != null) {
      facePage(x);
      hopEl.style.transform = "translate3d(0," + (-lift).toFixed(1) + "px,0) rotate(" + roll.toFixed(1) + "deg)";
      if (leapImg) leapImg.style.transform = root.classList.contains("is-look-left") ? "scaleX(-1)" : "none";
      return;
    }
    hopEl.style.transform = "translate3d(0," + (-lift).toFixed(1) + "px,0)";
    if (!leapImg) return;
    if (!traveling) {
      facePage(x);
      leapImg.style.transform = (pose === "leap" && root.classList.contains("is-look-left")) ? "scaleX(-1)" : "none";
      return;
    }
    if (Math.abs(dy) > Math.abs(dx) + 8) {
      leapImg.style.transform = "rotate(" + (dy > 0 ? 90 : -90) + "deg)";
    } else if (dx < -8) {
      leapImg.style.transform = "scaleX(-1)";
    } else {
      leapImg.style.transform = "none";
    }
  }

  function mountCoins() {
    if (!COIN_ROLL_ENABLED || pile) return pile;
    var node = document.createElement("div");
    node.className = "pal-cash";
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = '<svg viewBox="0 0 120 64" width="120" height="64" focusable="false">' +
      '<polygon points="22,40 34,47 34,58 22,64 10,58 10,47" fill="#00e6a6"/>' +
      '<polygon points="46,42 60,50 60,62 46,64 32,62 32,50" fill="#1a7d8d"/>' +
      '<polygon points="74,40 88,48 88,60 74,64 60,60 60,48" fill="#6fe5ee"/>' +
      '<polygon points="96,42 108,49 108,60 96,64 84,60 84,49" fill="#45e5ad"/>' +
      '<polygon points="58,30 72,38 72,52 58,60 44,52 44,38" fill="#f6d983"/>' +
      '<polygon class="flutter f1" points="30,28 40,34 40,46 30,52 20,46 20,34" fill="#f6d983"/>' +
      '<polygon class="flutter f2" points="78,24 88,30 88,42 78,48 68,42 68,30" fill="#6fe5ee"/>' +
      '<polygon class="flutter f3" points="100,30 110,36 110,46 100,52 90,46 90,36" fill="#00e6a6"/>' +
      "</svg>";
    mover.insertBefore(node, hopEl);
    pile = node;
    return pile;
  }

  function showPile(on) {
    if (!COIN_ROLL_ENABLED) return;
    if (!pile) return;
    if (on) {
      pile.classList.remove("is-out");
      pile.classList.remove("is-on");
      void pile.offsetWidth;
      pile.classList.add("is-on");
    } else {
      pile.classList.remove("is-on");
      pile.classList.remove("is-out");
    }
  }

  function cancelCash(mark) {
    if (!cash) return;
    if (mark && cash.u > 0.45) cashPlayed = true;
    cash = null;
    showPile(false);
  }

  function blocksView(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var vh = window.innerHeight || 1;
    var bandTop = vh * 0.36;
    var bandBot = vh * 0.52;
    var overlap = Math.min(r.bottom, bandBot) - Math.max(r.top, bandTop);
    if (overlap < 36) return false;
    return overlap >= Math.min(56, r.height * 0.55);
  }

  function cardHopping() {
    var motion = window.HonestPingMotion;
    if (!motion) return false;
    if (motion.hopIsMoving && motion.hopIsMoving()) return true;
    if (motion.accentMoving && motion.accentMoving()) return true;
    return false;
  }

  function heroGone() {
    if (!hero) return true;
    return hero.getBoundingClientRect().bottom <= 8;
  }

  function away() {
    if (!heroGone()) return true;
    for (var h = 0; h < hides.length; h++) {
      if (blocksView(hides[h])) return true;
    }
    var week = document.getElementById("week-demo");
    if (week && blocksView(week)) return true;
    if (window.innerWidth < 720) {
      var wait = document.getElementById("waitlist");
      if (wait && blocksView(wait)) return true;
      var box = metrics();
      var left = cornerBlocked(8, window.innerHeight - box.size - 14, box.size);
      var right = cornerBlocked(window.innerWidth - box.size - 8, window.innerHeight - box.size - 14, box.size);
      if (left && right) return true;
    }
    return false;
  }

  function beginHop(dest, now, box) {
    var target = spot(pts[dest], box);
    if (!target) {
      if (onScreen(pts[dest])) landI = dest;
      return false;
    }
    var from = { x: pos.x, y: pos.y };
    if (Math.abs(target.x - from.x) < 4 && Math.abs(target.y - from.y) < 4) {
      landI = dest;
      return false;
    }
    var arcs = [];
    if (!box.mobile && Math.abs(target.x - from.x) > 220) {
      var midY = (from.y + target.y) / 2 - box.size * 0.2;
      var mid = {
        x: (from.x + target.x) / 2,
        y: clamp(midY, 150, window.innerHeight * 0.62)
      };
      arcs.push({ from: from, to: mid });
      arcs.push({ from: mid, to: target });
    } else {
      arcs.push({ from: from, to: target });
    }
    hop = { arcs: arcs, i: 0, t0: now, dur: HOP_MS, dest: dest };
    showProp("");
    return true;
  }

  function advance(now, box) {
    var arc = hop.arcs[hop.i];
    var u = Math.min(1, (now - hop.t0) / hop.dur);
    var e = ease(u);
    var x = arc.from.x + (arc.to.x - arc.from.x) * e;
    var y = arc.from.y + (arc.to.y - arc.from.y) * e;
    var dx = arc.to.x - arc.from.x;
    var lift = Math.sin(Math.PI * u) * box.size * (Math.abs(dx) > 220 ? 0.48 : 0.33);
    paint(x, y, lift, dx, arc.to.y - arc.from.y);
    showPose("leap");
    report(true);
    if (u < 1) return false;
    hop.i += 1;
    if (hop.i < hop.arcs.length) {
      hop.t0 = now;
      return false;
    }
    paint(arc.to.x, arc.to.y, 0, 0, 0);
    return true;
  }

  function onScreen(wp) {
    if (!wp) return false;
    if (wp.sid === "footer") {
      var foot = document.getElementById("footer");
      if (!foot) return false;
      var fr = foot.getBoundingClientRect();
      return fr.top < window.innerHeight - 24 && fr.bottom > 48;
    }
    var y = anchorY(wp);
    var hi = Math.min(window.innerHeight - 80, window.innerHeight * 0.7);
    return y >= 132 && y <= hi;
  }

  function stepToward(goal, scrolling) {
    if (landI === goal) return landI;
    var goalOk = onScreen(pts[goal]);
    if (!scrolling) return goalOk ? goal : landI;
    var dir = goal > landI ? 1 : -1;
    var i = landI + dir;
    var side = pts[landI].side;
    while (i !== goal && pts[i] && pts[i].side === side) i += dir;
    if (!pts[i] || !onScreen(pts[i])) return goalOk ? goal : landI;
    return i;
  }

  function cashOk(now) {
    if (window.innerWidth < 720) return false;
    if (!cashPlayed) return true;
    if (!cashLeftAt || (now - cashLeftAt) <= REPLAY_MS) return false;
    cashPlayed = false;
    cashLeftAt = 0;
    return true;
  }

  function noteCashLeave(now) {
    var here = pts[landI];
    if (cashPlayed && (!here || here.kind !== "cash") && !cashLeftAt) cashLeftAt = now;
  }

  function startCash(now) {
    if (!COIN_ROLL_ENABLED) return;
    mountCoins();
    if (cashPlayed && cashLeftAt && (now - cashLeftAt) > REPLAY_MS) cashPlayed = false;
    cash = { t0: now, u: 0, x: pos.x, y: pos.y };
    showPile(true);
    report(true);
  }

  function runCash(now, box) {
    var u = Math.min(1, (now - cash.t0) / CASH_MS);
    cash.u = u;
    var wp = pts[landI];
    if (u < 0.55) {
      var spin = ease(u / 0.55) * 360;
      var bob = Math.sin((u / 0.55) * Math.PI) * box.size * 0.16;
      paint(cash.x, cash.y, bob, 1, 0, spin);
      showPose("leap");
    } else {
      paint(cash.x, cash.y, 0, 0, 0, 0);
      showPose(wp ? wp.pose : "sit");
      if (pile && u > 0.7) pile.classList.add("is-out");
    }
    report(true);
    if (u < 1) return;
    cashPlayed = true;
    cash = null;
    showPile(false);
    nextEx = now + GAP_MS;
    report(false);
  }

  var ACT_NAMES = ["launch", "ready", "listen", "watch", "glance", "turn", "peek", "blink", "nod", "settle"];

  function clearActClass() {
    root.classList.remove("is-act");
    for (var i = 0; i < ACT_NAMES.length; i++) root.classList.remove("is-act-" + ACT_NAMES[i]);
  }

  function showProp(name) {
    root.classList.remove("is-prop-pad", "is-prop-headset", "is-prop-screen");
    if (name === "pad" || name === "headset" || name === "screen") root.classList.add("is-prop-" + name);
  }

  function cancelAct() {
    if (!act) return;
    act = null;
    clearActClass();
    report(false);
  }

  function noteVisit(sid) {
    if (!sid || sid === visitSid) return;
    if (visitSid) delete acted[visitSid];
    visitSid = sid;
  }

  function canAct(here, box) {
    if (!here || box.mobile) return false;
    if (!ACT_MS[here.act] || acted[here.sid]) return false;
    return true;
  }

  function startAct(now, here) {
    act = { name: here.act, pose: here.pose, t0: now, dur: ACT_MS[here.act], sid: here.sid };
    acted[here.sid] = true;
    clearActClass();
    void root.offsetWidth;
    root.classList.add("is-act", "is-act-" + here.act);
    showProp(here.prop);
    showPose(here.pose);
    paint(pos.x, pos.y, 0, 0, 0);
    report(true);
  }

  function runAct(now) {
    var u = Math.min(1, (now - act.t0) / act.dur);
    if (act.name === "turn") showPose(u > 0.28 && u < 0.72 ? "rest" : act.pose);
    else showPose(act.pose);
    paint(pos.x, pos.y, 0, 0, 0);
    report(true);
    if (u < 1) return;
    var done = act.pose;
    act = null;
    clearActClass();
    showPose(done);
    nextEx = now + GAP_MS;
    report(false);
  }

  function nearbyPerch() {
    if (window.innerWidth < 720) return -1;
    var box = metrics();
    var here = pts[landI];
    if (!here || here.kind === "cash") return -1;
    var origin = spot(here, box);
    if (!origin) return -1;
    var best = -1;
    var bestD = 240;
    for (var i = 0; i < pts.length; i++) {
      if (i === landI || pts[i].kind === "cash") continue;
      if (Math.abs(pts[i].pageY - here.pageY) > 520) continue;
      var s = spot(pts[i], box);
      if (!s) continue;
      var d = Math.abs(s.x - origin.x) + Math.abs(s.y - origin.y);
      if (d > 48 && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function frame(now) {
    if (document.hidden || mq.matches) {
      report(false);
      raf = 0;
      running = false;
      return;
    }
    if (!pts.length) build();
    var box = metrics();
    var hidden = away();
    root.classList.toggle("is-away", hidden);
    if (hidden) {
      cancelCash(true);
      cancelAct();
      excursion = null;
      hop = null;
      var goal = goalIndex();
      var snap = spot(pts[goal], box);
      if (snap) {
        showPose(pts[goal] ? pts[goal].pose : "rest");
        showProp("");
        paint(snap.x, snap.y, 0, 0, 0);
      }
      placed = true;
      report(false);
      raf = 0;
      running = false;
      return;
    }

    if (cardHopping()) {
      cancelCash(true);
      cancelAct();
      excursion = null;
      hop = null;
      showPose(pts[landI] ? pts[landI].pose : "rest");
      showProp("");
      paint(pos.x, pos.y, 0, 0, 0);
      report(false);
      raf = requestAnimationFrame(frame);
      return;
    }

    if (cash) {
      runCash(now, box);
      if (cash) {
        raf = requestAnimationFrame(frame);
        return;
      }
    }

    if (act) {
      runAct(now);
      if (act) {
        raf = requestAnimationFrame(frame);
        return;
      }
    }

    if (hop) {
      if (!advance(now, box)) {
        raf = requestAnimationFrame(frame);
        return;
      }
      landI = hop.dest;
      hop = null;
      if (excursion && excursion.phase === "go") {
        excursion.phase = "sit";
        excursion.sitUntil = now + SIT_MS;
      } else if (excursion && excursion.phase === "back") {
        excursion = null;
        nextEx = now + GAP_MS;
      }
    }

    var scrolling = (now - lastAt) < 170;
    var goal = goalIndex();
    noteCashLeave(now);

    if (excursion && excursion.phase === "sit") {
      var seat = pts[landI];
      showPose(seat ? seat.pose : "rest");
      showProp(!box.mobile && seat ? seat.prop : "");
      paint(pos.x, pos.y, 0, 0, 0);
      report(true);
      if (scrolling) excursion = null;
      else if (now >= excursion.sitUntil) {
        excursion.phase = "back";
        beginHop(excursion.home, now, box);
      }
      if (hop || (excursion && excursion.phase === "sit")) {
        raf = requestAnimationFrame(frame);
        return;
      }
    }

    if (!hop && landI !== goal && (armed || !placed)) {
      var dest = (scrolling && placed) ? stepToward(goal, true) : goal;
      if (dest !== landI) beginHop(dest, now, box);
      placed = true;
      if (hop) {
        raf = requestAnimationFrame(frame);
        return;
      }
    }
    if (!scrolling && landI === goal) {
      armed = false;
      baseY = window.scrollY || 0;
    }

    if (!placed) {
      var first = spot(pts[goal], box);
      landI = goal;
      if (first) paint(first.x, first.y, 0, 0, 0);
      placed = true;
    }

    var here = pts[landI];
    if (!excursion) noteVisit(here && here.sid);
    if (COIN_ROLL_ENABLED && !hop && !scrolling && here && here.kind === "cash" && cashOk(now)) {
      showProp("");
      startCash(now);
      raf = requestAnimationFrame(frame);
      return;
    }
    if (!hop && !scrolling && !excursion && canAct(here, box)) {
      startAct(now, here);
      raf = requestAnimationFrame(frame);
      return;
    }

    showPose(here ? here.pose : "rest");
    showProp(!box.mobile && here ? here.prop : "");
    paint(pos.x, pos.y, 0, 0, 0);
    report(false);

    if (!scrolling && !excursion && window.innerWidth >= 720) {
      var due = Math.max(lastAt + REST_MS, nextEx);
      if (now >= due) {
        var n = nearbyPerch();
        if (n >= 0) {
          excursion = { dest: n, home: landI, phase: "go", sitUntil: 0 };
          nextEx = now + GAP_MS;
          beginHop(n, now, box);
          if (hop) {
            raf = requestAnimationFrame(frame);
            return;
          }
          excursion = null;
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
    if (Math.abs(y - baseY) >= 8) {
      lastAt = performance.now();
      armed = true;
      if (cash) cancelCash(false);
      cancelAct();
      if (excursion && excursion.phase === "sit") excursion = null;
    }
    lastY = y;
    kick();
  }, { passive: true });

  window.addEventListener("resize", function () {
    build();
    cancelCash(false);
    cancelAct();
    excursion = null;
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
      if (cash) cash.hold = t;
      if (act) act.hold = t;
      return;
    }
    if (hop && hop.hold) {
      hop.t0 += t - hop.hold;
      hop.hold = 0;
    }
    if (cash && cash.hold) {
      cash.t0 += t - cash.hold;
      cash.hold = 0;
    }
    if (act && act.hold) {
      act.t0 += t - act.hold;
      act.hold = 0;
    }
    kick();
  });

  if (mq.addEventListener) mq.addEventListener("change", function () {
    if (mq.matches) {
      report(false);
      cancelCash(false);
      cancelAct();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    }
  });

  build();
  kick();
})();
