/* How hops work: one rabbit hops You, Router, ISP, Server, then back,
   and keeps looping while the card is in view. It faces the way it is
   going and pauses at each end. Off screen or a hidden tab pauses it
   without ending the loop. Reduced motion rests on Server. */
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
  var HOP = 520;
  var END_HOLD = 600;
  var reduce = mq.matches;
  var playing = false;
  var raf = 0;
  var index = 0;
  var dir = 1;
  var t0 = 0;
  var phase = "hop";
  var held = false;
  var pausedFor = 0;
  var last = stops.length - 1;

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

  function faceFor(direction) {
    return direction < 0 ? -1 : 1;
  }

  function lightAt(i) {
    var n;
    for (n = 0; n < stops.length; n++) stops[n].classList.toggle("is-on", n === i);
  }

  function lightAll() {
    var n;
    for (n = 0; n < stops.length; n++) stops[n].classList.add("is-on");
  }

  function poseAt(i, direction, sitting) {
    put(dotCenter(i), faceFor(direction));
    showSit(sitting);
    lightAt(i);
  }

  function park() {
    put(dotCenter(last), -1);
    showSit(true);
    lightAll();
  }

  function paintHop(u) {
    var next = index + dir;
    var a = dotCenter(index);
    var b = dotCenter(next);
    var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    var arc = Math.min(14, runner.offsetHeight / 5);
    put({
      x: a.x + (b.x - a.x) * e,
      y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * u) * arc
    }, faceFor(dir));
    showSit(false);
    lightAt(u > 0.9 ? next : index);
  }

  function stop(rest) {
    playing = false;
    held = false;
    pausedFor = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    motion(false);
    if (rest) park();
  }

  function freeze() {
    if (!playing || held) return;
    held = true;
    pausedFor = Math.max(0, performance.now() - t0);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    motion(false);
  }

  function frame(now) {
    if (!playing) return;
    if (document.hidden || !onScreen()) {
      freeze();
      return;
    }
    var dur = phase === "hop" ? HOP : END_HOLD;
    var u = Math.min(1, (now - t0) / dur);
    if (phase === "hop") paintHop(u);
    if (u < 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    if (phase === "hop") {
      index += dir;
      if (index <= 0 || index >= last) {
        index = index <= 0 ? 0 : last;
        phase = "hold";
        poseAt(index, dir, true);
      } else {
        phase = "hop";
      }
      t0 = now;
      raf = requestAnimationFrame(frame);
      return;
    }
    dir = -dir;
    phase = "hop";
    t0 = now;
    raf = requestAnimationFrame(frame);
  }

  function onScreen() {
    var r = card.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (vis < Math.min(r.height, vh) * 0.6) return false;
    var mid = r.top + r.height / 2;
    return Math.abs(mid - vh / 2) < vh * 0.22;
  }

  function begin() {
    if (reduce) {
      stop(true);
      return;
    }
    dir = 1;
    index = 0;
    phase = "hop";
    playing = true;
    held = false;
    pausedFor = 0;
    poseAt(0, 1, false);
    motion(true);
    t0 = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function resume() {
    if (reduce || !playing || !held || document.hidden || !onScreen()) return;
    held = false;
    motion(true);
    t0 = performance.now() - pausedFor;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  if (reduce) park();
  else poseAt(0, 1, true);

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (reduce) return;
      if (entries[0] && entries[0].isIntersecting && !playing) begin();
    }, { threshold: 0.4 });
    io.observe(card);
  } else if (!reduce) {
    begin();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      freeze();
      return;
    }
    resume();
  });

  window.addEventListener("scroll", function () {
    if (playing && held) resume();
    else if (!playing && !reduce && onScreen()) begin();
  }, { passive: true });

  window.addEventListener("resize", function () {
    if (reduce) park();
    else if (!playing) poseAt(index, dir, true);
  });

  if (mq.addEventListener) mq.addEventListener("change", function () {
    reduce = mq.matches;
    if (reduce) stop(true);
    else if (onScreen()) begin();
  });
})();
