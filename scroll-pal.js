/* Scroll companion. Hops only while the page is scrolling, then holds
   the still pose for the section in view. Hidden near money, the sample
   week, and legal lines. Reduced motion never builds it. */
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
  var hopY = 0;
  var phase = 0;
  var lastY = window.scrollY || 0;
  var lastAt = 0;
  var lastNow = 0;
  var raf = 0;
  var running = false;
  var reported = false;
  var activeDot = "";

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

  function frame(now) {
    if (document.hidden || mq.matches) {
      report(false);
      raf = 0;
      running = false;
      return;
    }
    var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    var box = metrics();
    var p = Math.max(0, Math.min(1, (window.scrollY || 0) / maxScroll()));
    var y = p * Math.max(0, box.railH - box.size);
    mover.style.transform = "translate3d(0," + y.toFixed(2) + "px,0)";

    var hidden = away();
    root.classList.toggle("is-away", hidden);
    var scrolling = !hidden && (now - lastAt) < 140;
    var target = 0;
    if (scrolling) {
      phase += dt / 0.52;
      var cycle = phase % 1;
      target = -Math.sin(Math.PI * cycle) * box.size * 0.33;
    }
    hopY += (target - hopY) * (scrolling ? 0.45 : 0.35);
    if (Math.abs(hopY) < 0.4) hopY = 0;
    hopEl.style.transform = "translate3d(0," + hopY.toFixed(2) + "px,0) scaleX(" + face + ")";

    if (scrolling) {
      showPose("leap");
      report(true);
    } else if (Math.abs(hopY) < 1) {
      var mark = focusMark();
      showPose(mark ? mark.pose : "rest");
      var nextDot = mark ? mark.dot : "";
      if (nextDot !== activeDot) {
        activeDot = nextDot;
        for (var k = 0; k < dots.length; k++) {
          dots[k].classList.toggle("is-here", dots[k].getAttribute("data-for") === activeDot);
        }
      }
      report(false);
    }

    if (scrolling || Math.abs(hopY) > 0.4) {
      raf = requestAnimationFrame(frame);
      return;
    }
    raf = 0;
    running = false;
  }

  function kick() {
    if (running || document.hidden || mq.matches) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", function () {
    var y = window.scrollY || 0;
    var delta = y - lastY;
    if (delta > 0.5) face = 1;
    else if (delta < -0.5) face = -1;
    lastY = y;
    lastAt = performance.now();
    kick();
  }, { passive: true });

  window.addEventListener("resize", function () {
    placeDots();
    kick();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      report(false);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      hopY = 0;
      if (hopEl) hopEl.style.transform = "translate3d(0,0,0) scaleX(" + face + ")";
    }
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
