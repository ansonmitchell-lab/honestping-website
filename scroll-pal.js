/* Scroll companion. No rail. Scroll progress walks a path of perches
   down the page, and the rabbit hops between the left and right gutters.
   It stays on screen at full opacity, including beside the hero, the
   sample week, money tiles, legal notes, and the hops card.
   It does not perch on those, and it stays off the gamer tier row.
   While another rabbit moves, it holds still. While it idles, the others hold.
   After it settles, it plays a short idle, then another every few seconds.
   The coin-roll tumble stays in this file and stays off.
   Reduced motion leaves one still pose in the gutter. */
(function () {
  var COIN_ROLL_ENABLED = false;
  var root = document.getElementById("scroll-pal");
  if (!root) return;
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq.matches || document.documentElement.classList.contains("hp-reduce")) {
    var stillMover = root.querySelector(".scroll-pal-mover");
    var leapPose = root.querySelector("[data-pose='leap']");
    var sitPose = root.querySelector("[data-pose='sit']");
    root.classList.remove("is-away");
    root.classList.add("is-still");
    if (leapPose) leapPose.classList.remove("is-on");
    if (sitPose) sitPose.classList.add("is-on");
    if (stillMover) stillMover.style.transform = "translate3d(16px,140px,0)";
    return;
  }

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
    talk: 1600,
    settle: 900
  };

  var pts = [];
  var landI = 0;
  var pos = { x: 24, y: 120 };
  var hop = null;
  var yieldSpot = null;
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
  var IDLES = [
    { name: "groom", dur: 2000 },
    { name: "look", dur: 1800 },
    { name: "sit", dur: 1600 },
    { name: "stretch", dur: 2200 },
    { name: "yawn", dur: 2400 },
    { name: "scratch", dur: 1800 },
    { name: "screen", dur: 2000 }
  ];
  var idle = null;
  var idleWait = 0;
  var lastIdle = "";
  var quiet = 0;
  var scrollV = 0;
  var velT = 0;
  var velY = window.scrollY || 0;
  var lag = 0;
  var dustUntil = 0;
  var pointer = { x: 0, y: 0, on: false };
  var PROPS = ["pad", "headset", "screen", "days", "zzz", "pop", "cards", "tape", "bub", "knob", "hats", "wave"];

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
    if (hero) add(list, hero, "gap", -1, "sit", "", "", "hero", pageTop(hero) + 168);
    var sections = document.querySelectorAll("main > section[id]");
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      if (sec.classList.contains("pal-hide")) continue;
      var sid = sec.id;
      var head = sec.querySelector("h2") || sec;
      if (sid === "free") {
        add(list, sec, "theme", -1, "leap", "", "", sid, pageTop(sec) + 20);
        add(list, sec, "gap", 1, "leap", "", "", sid, pageTop(sec) - 28);
      } else if (sid === "gamers") {
        add(list, head, "theme", -1, "sit", "", "pad", sid, pageTop(head) + 24);
        add(list, sec, "gap", 1, "sit", "", "pad", sid, pageTop(sec) - 28);
      } else if (sid === "isp") {
        var mark = sec.querySelector(".isp-mark") || head;
        add(list, sec, "gap", -1, "rest", "", "days", sid, pageTop(sec) - 28);
        if (COIN_ROLL_ENABLED) {
          add(list, mark, "cash", 1, "rest", "cash", "", sid, pageTop(mark) + 16);
        }
        var extras = [".isp-flow", ".isp-proof", ".uses-card"];
        for (var e = 0; e < extras.length; e++) {
          var node = sec.querySelector(extras[e]);
          if (!node) continue;
          add(list, node, "head", e % 2 ? 1 : -1, "rest", "", "days", sid, pageTop(node) + 12);
        }
      } else if (sid === "wfh") {
        add(list, sec, "theme", -1, "rest", "", "zzz", sid, pageTop(sec) + 160);
      } else if (sid === "streaming") {
        var screen = sec.querySelector(".streaming-screen") || head;
        add(list, screen, "theme", -1, "sit", "", "pop", sid, pageTop(screen) - 6);
        add(list, sec, "gap", 1, "sit", "", "pop", sid, pageTop(sec) - 28);
      } else if (sid === "value") {
        var hist = sec.querySelector(".value-card-history") || head;
        add(list, hist, "theme", -1, "look", "", "cards", sid, pageTop(hist) + 8);
        add(list, sec, "gap", 1, "look", "", "cards", sid, pageTop(sec) - 28);
      } else if (sid === "gap") {
        add(list, head, "theme", 1, "rest", "", "tape", sid, pageTop(head) + 8);
        add(list, sec, "gap", -1, "rest", "", "tape", sid, pageTop(sec) - 28);
      } else if (sid === "benefits") {
        add(list, head, "theme", -1, "ears", "", "bub", sid, pageTop(head) + 8);
        add(list, sec, "gap", 1, "ears", "", "bub", sid, pageTop(sec) - 28);
      } else if (sid === "preview") {
        var frame = sec.querySelector(".window") || head;
        add(list, frame, "peek", 1, "look", "", "knob", sid, pageTop(frame) + 6);
        add(list, sec, "gap", -1, "look", "", "knob", sid, pageTop(sec) - 20);
      } else if (sid === "user-types") {
        add(list, head, "theme", 1, "quarter", "", "hats", sid, pageTop(head) + 8);
        add(list, sec, "gap", -1, "quarter", "", "hats", sid, pageTop(sec) - 28);
      }
    }
    var foot = document.getElementById("footer");
    if (foot) {
      add(list, foot, "theme", -1, "rest", "", "wave", "footer", pageTop(foot) - 24);
      add(list, foot, "gap", 1, "rest", "", "wave", "footer", pageTop(foot) + 6);
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
      if (el.closest(".mascot-accent, .crest-mark, .hero-mascot, .mascot-sleep, .hop-explain, .free-bar, .mascot-play, .pal-hide, .waitlist-form, button, a, input, textarea, h1, h2, h3, h4, p, li, figcaption, label, .section-label, .card, .tier-card, .tier-row")) return true;
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

  function clearGutter(box, side, preferY) {
    var g = gutters(box.size);
    var primary = side < 0 ? g.left : g.right;
    var secondary = side < 0 ? g.right : g.left;
    var xs = [primary, secondary];
    var lo = box.mobile ? 96 : 132;
    var hi = Math.min(window.innerHeight - box.size - 12, window.innerHeight * 0.72);
    if (hi < lo) hi = lo;
    var ys = [];
    if (preferY != null) ys.push(clamp(preferY, lo, hi));
    var steps = 7;
    var i;
    for (i = 0; i <= steps; i++) ys.push(lo + (hi - lo) * (i / steps));
    var s;
    var k;
    var x;
    var y;
    for (s = 0; s < xs.length; s++) {
      x = clamp(xs[s], 6, window.innerWidth - box.size - 6);
      for (k = 0; k < ys.length; k++) {
        y = ys[k];
        if (hits(x, y, box.size, false)) continue;
        if (box.mobile && cornerBlocked(x, y, box.size)) continue;
        return { x: x, y: y };
      }
    }
    return { x: clamp(primary, 6, window.innerWidth - box.size - 6), y: lo };
  }

  function spot(wp, box) {
    if (!wp) return clearGutter(box, -1, null);
    if (box.mobile) return clearGutter(box, wp.side, window.innerHeight - box.size - 18);
    if (wp.sid === "footer") {
      var fs = footerSpot(wp, box);
      if (fs) return fs;
    }
    if (wp.kind === "peek") {
      var pk = peekSpot(box);
      if (pk && !hits(pk.x, pk.y, box.size, false, true)) return pk;
    }
    var s = rawSpot(wp, box.size);
    if (s && !hits(s.x, s.y, box.size, wp.kind === "cash")) return s;
    if (s) {
      var g = gutters(box.size);
      var x2 = clamp(wp.side < 0 ? g.right : g.left, 6, window.innerWidth - box.size - 6);
      if (!hits(x2, s.y, box.size, false)) return { x: x2, y: s.y };
    }
    var sec = wp.el.closest ? (wp.el.closest("section") || wp.el) : wp.el;
    var hi = Math.min(window.innerHeight - box.size - 16, window.innerHeight * 0.7);
    var rawGap = sec.getBoundingClientRect().top - box.size * 0.7;
    if (rawGap >= 132 && rawGap <= hi) {
      var g2 = gutters(box.size);
      var x3 = clamp(wp.side < 0 ? g2.left : g2.right, 6, window.innerWidth - box.size - 6);
      if (!hits(x3, rawGap, box.size, false)) return { x: x3, y: rawGap };
    }
    return clearGutter(box, wp.side, s ? s.y : null);
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

  function paint(x, y, lift, dx, dy, roll, body) {
    pos.x = x;
    pos.y = y;
    mover.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
    var sx = body && body.sx ? body.sx : 1;
    var sy = body && body.sy ? body.sy : 1;
    var extra = body && body.rot ? body.rot : 0;
    var traveling = Math.abs(dx) > 8 || Math.abs(dy) > 8;
    if (roll != null) {
      facePage(x);
      hopEl.style.transform = "translate3d(0," + (-lift).toFixed(1) + "px,0) rotate(" + roll.toFixed(1) + "deg)";
      if (leapImg) leapImg.style.transform = root.classList.contains("is-look-left") ? "scaleX(-1)" : "none";
      return;
    }
    hopEl.style.transform = "translate3d(0," + (-lift).toFixed(1) + "px,0) rotate(" + extra.toFixed(1) + "deg) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
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
    var dx = target.x - from.x;
    var dy = target.y - from.y;
    var speed = Math.min(2.2, Math.abs(scrollV));
    var cross = Math.abs(dx) > 160;
    var dur = cross ? 780 : Math.max(260, Math.min(560, 480 - speed * 120));
    var height = box.size * (cross ? 1.15 : Math.min(0.92, 0.26 + speed * 0.42));
    var down = scrollV > 0.04 ? true : scrollV < -0.04 ? false : dy >= 0;
    hop = {
      arcs: [{ from: from, to: target }],
      i: 0,
      t0: now,
      dur: dur,
      dest: dest,
      height: height,
      cross: cross,
      down: down,
      turnUntil: 0,
      puffed: false,
      skid: false
    };
    showProp("");
    clearIdle();
    root.classList.remove("is-dust");
    return true;
  }

  function beginSlide(x, y, now) {
    var from = { x: pos.x, y: pos.y };
    if (Math.abs(x - from.x) < 4 && Math.abs(y - from.y) < 4) {
      root.classList.remove("is-away");
      return false;
    }
    var dx = x - from.x;
    var dy = y - from.y;
    hop = {
      arcs: [{ from: from, to: { x: x, y: y } }],
      i: 0,
      t0: now,
      dur: Math.abs(dx) > 160 || Math.abs(dy) > 160 ? 780 : 420,
      dest: landI,
      height: metrics().size * 0.35,
      cross: Math.abs(dx) > 160,
      down: dy >= 0,
      turnUntil: 0,
      puffed: false,
      skid: false,
      slide: true
    };
    showProp("");
    clearIdle();
    return true;
  }

  function advance(now, box) {
    var arc = hop.arcs[hop.i];
    var u = Math.min(1, (now - hop.t0) / hop.dur);
    var dx = arc.to.x - arc.from.x;
    var dy = arc.to.y - arc.from.y;
    var wind = 0.16;
    var x = arc.from.x;
    var y = arc.from.y;
    var lift = 0;
    var sx = 1;
    var sy = 1;
    var rot = 0;
    if (u < wind) {
      var s = u / wind;
      sy = 1 - 0.16 * s;
      sx = 1 + 0.1 * s;
      showPose("sit");
    } else {
      var p = (u - wind) / (1 - wind);
      var e = ease(p);
      x = arc.from.x + dx * e;
      y = arc.from.y + dy * e;
      lift = Math.sin(Math.PI * p) * hop.height;
      var take = p < 0.2 ? Math.sin((p / 0.2) * Math.PI) : 0;
      var landWave = p > 0.78 ? Math.sin(((p - 0.78) / 0.22) * Math.PI) : 0;
      if (take) {
        sy = 1 + 0.12 * take;
        sx = 1 - 0.08 * take;
      } else if (landWave) {
        sy = 1 - 0.16 * landWave;
        sx = 1 + 0.1 * landWave;
        if (!hop.puffed && p > 0.86) {
          hop.puffed = true;
          puff(now);
        }
      }
      if (hop.cross && p > 0.28 && p < 0.74) {
        rot = Math.sin(((p - 0.28) / 0.46) * Math.PI) * (dx >= 0 ? 170 : -170);
      }
      if (!hop.turnUntil && Math.abs(dx) > 8) hop.turnUntil = now + 90;
      if (hop.turnUntil && now < hop.turnUntil) showPose("quarter");
      else showPose(hop.down ? "leap" : "ears");
      var want = dx >= 0 ? 7 : -7;
      lag += (want - lag) * 0.18;
      rot += lag * (1 - Math.min(1, p));
    }
    if (hop.skid && u > 0.7) {
      var sk = Math.sin(((u - 0.7) / 0.3) * Math.PI);
      x += (dx >= 0 ? 1 : -1) * sk * 12;
    }
    paint(x, y, lift, dx, dy, null, { sx: sx, sy: sy, rot: rot });
    report(true);
    if (u < 1) return false;
    hop.i += 1;
    if (hop.i < hop.arcs.length) {
      hop.t0 = now;
      return false;
    }
    paint(arc.to.x, arc.to.y, 0, 0, 0, null, { sx: 1.04, sy: 0.92, rot: 0 });
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
    var i;
    for (i = 0; i < PROPS.length; i++) root.classList.remove("is-prop-" + PROPS[i]);
    if (PROPS.indexOf(name) >= 0) root.classList.add("is-prop-" + name);
  }

  function puff(now) {
    dustUntil = now + 340;
    root.classList.remove("is-dust");
    void root.offsetWidth;
    root.classList.add("is-dust");
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

  function clearIdle() {
    root.classList.remove("is-idle");
    actEl.style.transform = "";
    if (!idle) return;
    root.classList.remove("is-idle-" + idle.name);
    idle = null;
  }

  function startIdle(now) {
    var spec;
    var i;
    if (quiet >= 3) {
      spec = { name: "nap", dur: 3200 };
      quiet = 0;
    } else {
      var pool = [];
      for (i = 0; i < IDLES.length; i++) {
        if (IDLES[i].name !== lastIdle) pool.push(IDLES[i]);
      }
      spec = pool[Math.floor(Math.random() * pool.length)];
    }
    lastIdle = spec.name;
    idle = { name: spec.name, t0: now, dur: spec.dur };
    root.classList.remove("is-idle", "is-idle-nap", "is-breathe");
    for (i = 0; i < IDLES.length; i++) root.classList.remove("is-idle-" + IDLES[i].name);
    void root.offsetWidth;
    root.classList.add("is-idle", "is-idle-" + spec.name);
    report(true);
  }

  function motionBusy() {
    return !!(hop || act || excursion || cash || cardHopping());
  }

  function startAct(now, here) {
    clearIdle();
    idleWait = 0;
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
      if (document.hidden) clearIdle();
      report(false);
      raf = 0;
      running = false;
      return;
    }
    if (!pts.length) build();
    var box = metrics();
    var scrolling = (now - lastAt) < 170;
    if (dustUntil && now > dustUntil) {
      root.classList.remove("is-dust");
      dustUntil = 0;
    }

    if (cardHopping()) {
      cancelCash(true);
      cancelAct();
      clearIdle();
      idleWait = 0;
      excursion = null;
      hop = null;
      root.classList.remove("is-breathe", "is-dust");
      var hold = pts[landI];
      showPose(hold ? hold.pose : "sit");
      showProp("");
      if (hits(pos.x, pos.y, box.size, false)) {
        root.classList.add("is-away");
        yieldSpot = clearGutter(box, hold ? hold.side : -1, pos.y);
        paint(pos.x, pos.y, 0, 0, 0);
      } else {
        paint(pos.x, pos.y, 0, 0, 0);
      }
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
      if (!scrolling) hop.skid = true;
      if (!advance(now, box)) {
        raf = requestAnimationFrame(frame);
        return;
      }
      landI = hop.dest;
      var slid = hop.slide;
      hop = null;
      if (slid) root.classList.remove("is-away");
      if (excursion && excursion.phase === "go") {
        excursion.phase = "sit";
        excursion.sitUntil = now + SIT_MS;
      } else if (excursion && excursion.phase === "back") {
        excursion = null;
        nextEx = now + GAP_MS;
      }
    }

    if (yieldSpot && !hop) {
      var parked = yieldSpot;
      yieldSpot = null;
      if (hits(pos.x, pos.y, box.size, false)) beginSlide(parked.x, parked.y, now);
      else root.classList.remove("is-away");
    } else if (!hop && !hits(pos.x, pos.y, box.size, false)) {
      root.classList.remove("is-away");
    }

    var goal = goalIndex();
    if (idle) {
      if (scrolling || motionBusy() || goal !== landI) {
        clearIdle();
        idleWait = 0;
        report(false);
      } else if (now >= idle.t0 + idle.dur) {
        clearIdle();
        quiet += 1;
        idleWait = now + 5000 + Math.random() * 4000;
        report(false);
      } else {
        if (idle.name === "look" && pointer.on) {
          var ang = Math.atan2(pointer.y - (pos.y + 32), pointer.x - (pos.x + 32));
          actEl.style.transform = "rotate(" + clamp(ang * 10, -14, 14).toFixed(1) + "deg)";
        }
        report(true);
        raf = requestAnimationFrame(frame);
        return;
      }
    }
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
    if (Math.abs(lag) > 0.15) lag *= 0.8;
    paint(pos.x, pos.y, 0, 0, 0, null, { sx: 1, sy: 1, rot: lag });
    root.classList.toggle("is-breathe", !cardHopping());
    if (dustUntil && now > dustUntil) {
      root.classList.remove("is-dust");
      dustUntil = 0;
    }
    report(false);

    if (!scrolling && landI === goal && !motionBusy()) {
      if (!idleWait) idleWait = now + 2000 + Math.random() * 2000;
      if (now >= idleWait) {
        startIdle(now);
        idleWait = 0;
        raf = requestAnimationFrame(frame);
        return;
      }
      armRest(idleWait - now);
    } else if (scrolling) {
      idleWait = 0;
    } else {
      idleWait = 0;
      armRest(480);
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
    var now = performance.now();
    var dt = now - velT;
    if (velT && dt > 0 && dt < 90) scrollV = (y - velY) / dt;
    else if (dt >= 90) scrollV *= 0.4;
    velT = now;
    velY = y;
    if (Math.abs(y - baseY) >= 8) {
      lastAt = now;
      quiet = 0;
      root.classList.remove("is-breathe");
      armed = true;
      if (cash) cancelCash(false);
      cancelAct();
      clearIdle();
      idleWait = 0;
      if (excursion && excursion.phase === "sit") excursion = null;
    }
    lastY = y;
    kick();
  }, { passive: true });

  window.addEventListener("resize", function () {
    build();
    cancelCash(false);
    cancelAct();
    clearIdle();
    idleWait = 0;
    excursion = null;
    hop = null;
    placed = false;
    kick();
  });

  document.addEventListener("visibilitychange", function () {
    var t = performance.now();
    if (document.hidden) {
      clearIdle();
      idleWait = 0;
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

  window.addEventListener("pointermove", function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.on = true;
  }, { passive: true });

  build();
  root.classList.remove("is-away");
  var openBox = metrics();
  var openGoal = goalIndex();
  var openSpot = spot(pts[openGoal], openBox);
  landI = openGoal;
  showPose(pts[openGoal] ? pts[openGoal].pose : "sit");
  if (openSpot) paint(openSpot.x, openSpot.y, 0, 0, 0);
  placed = true;
  kick();
})();
