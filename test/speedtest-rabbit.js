/* Hex-perch scout for the speed test.
   The other rabbits each keep their own act: a dash at a dial, gutter hops,
   a calendar flip, a phone at the ear, a screen watch, a card flip, a tape,
   a climb through a window, hats, a goodbye wave, a clipboard, a block house,
   a search for a missing page, hops across price cards, or laps around a card.
   This one lives on a hex perch beside the gauge header. It steps off to listen,
   paces the download at the speed of the line, turns into a heavier upload push,
   then hops home and rests. Transform and opacity only. One mascot moves. */
export function mountRabbit(root) {
  var lane = root.querySelector("[data-lane]");
  var rabbit = root.querySelector("[data-rabbit]");
  var mover = root.querySelector("[data-mover]");
  var squash = root.querySelector("[data-squash]");
  var earL = root.querySelector("[data-ear='l']");
  var earR = root.querySelector("[data-ear='r']");
  var lids = root.querySelectorAll("[data-lid]");
  if (!lane || !rabbit || !mover || !squash) {
    return { phase: function () {}, sample: function () {} };
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phase = "home";
  var mbps = 40;
  var raf = 0;
  var last = 0;
  var modeT = 0;
  var laneW = 0;
  var rabbitW = 48;
  var homeX = 0;
  var x = 0;
  var runDir = -1;
  var face = -1;
  var flipT = 0;
  var flipFrom = -1;
  var flipTo = -1;
  var earLX = 0;
  var earLY = 0;
  var earRX = 0;
  var earRY = 0;
  var blink = 0;
  var hidden = false;

  function spring(pos, vel, target, dt) {
    var v = vel + ((target - pos) * 240 - vel * 18) * dt;
    if (v > 520) v = 520;
    if (v < -520) v = -520;
    return { x: pos + v * dt, v: v };
  }

  function measure() {
    var w = lane.clientWidth;
    if (w < 8) return;
    laneW = w;
    rabbitW = mover.offsetWidth || rabbitW;
    homeX = Math.max(0, laneW - rabbitW - 8);
    if (phase === "home" || phase === "back") x = homeX;
  }

  function holdCompanion(on) {
    document.documentElement.classList.toggle("st-mascot-busy", on);
    var pal = document.getElementById("scroll-pal");
    if (!pal) return;
    if (on) pal.setAttribute("hidden", "");
    else pal.removeAttribute("hidden");
  }

  function lidsOpacity(value) {
    for (var i = 0; i < lids.length; i++) lids[i].style.opacity = value;
  }

  function draw(px, py, sx, sy, rot, lead, followEar, dt) {
    var left = spring(earLX, earLY, lead, dt);
    var right = spring(earRX, earRY, followEar, dt);
    earLX = left.x;
    earLY = left.v;
    earRX = right.x;
    earRY = right.v;
    mover.style.transform = "translate3d(" + px.toFixed(2) + "px," + py.toFixed(2) + "px,0)";
    squash.style.transform = "translate3d(0,0,0) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ") rotate(" + rot.toFixed(2) + "deg)";
    if (earL) earL.style.transform = "rotate(" + earLX.toFixed(2) + "deg)";
    if (earR) earR.style.transform = "rotate(" + earRX.toFixed(2) + "deg)";
  }

  function still(which) {
    measure();
    var px = which === "testing" ? Math.max(8, homeX * 0.34) : homeX;
    var lead = which === "testing" ? -18 : which === "back" ? 7 : 1;
    var followEar = which === "testing" ? 18 : which === "back" ? -7 : -1;
    var sy = which === "back" ? 0.96 : which === "testing" ? 0.94 : 1;
    var sx = which === "testing" ? -1 : -1;
    x = px;
    face = -1;
    earLX = lead;
    earRX = followEar;
    earLY = 0;
    earRY = 0;
    mover.style.transform = "translate3d(" + px.toFixed(2) + "px,0,0)";
    squash.style.transform = "scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
    if (earL) earL.style.transform = "rotate(" + lead.toFixed(2) + "deg)";
    if (earR) earR.style.transform = "rotate(" + followEar.toFixed(2) + "deg)";
    lidsOpacity("0");
    rabbit.setAttribute("data-pose", which);
    var label = which === "testing"
      ? "HonestPing rabbit listening and pacing the test"
      : which === "back"
        ? "HonestPing rabbit back on its hex perch"
        : "HonestPing rabbit on its hex perch";
    rabbit.setAttribute("aria-label", label);
    holdCompanion(which === "testing");
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function hopShape(u, heavy) {
    var ground = heavy ? 0.28 : 0.16;
    var lift = heavy ? 9 : 17;
    if (u < ground) {
      var k = u / ground;
      return { y: 4 * k, sx: 1 + (heavy ? 0.16 : 0.1) * k, sy: 1 - (heavy ? 0.2 : 0.14) * k, ear: 8 * k };
    }
    var airEnd = heavy ? 0.74 : 0.8;
    if (u < airEnd) {
      var a = (u - ground) / (airEnd - ground);
      var s = Math.sin(a * Math.PI);
      return { y: -s * lift, sx: heavy ? 0.94 : 0.9, sy: 1 + s * (heavy ? 0.08 : 0.16), ear: -16 * (1 - a) };
    }
    var L = (u - airEnd) / (1 - airEnd);
    var hit = Math.sin(Math.min(1, L) * Math.PI);
    return { y: 2 * (1 - L), sx: 1 + (heavy ? 0.18 : 0.12) * hit, sy: 1 - (heavy ? 0.2 : 0.14) * hit, ear: 12 * (1 - L) };
  }

  function frame(now) {
    if (hidden || reduce) {
      raf = 0;
      return;
    }
    if (!last) last = now;
    var dt = (now - last) / 1000;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    last = now;
    modeT += dt;
    if (!laneW) measure();

    var py = 0;
    var sx = 1;
    var sy = 1;
    var rot = 0;
    var lead = 1;
    var followEar = -1;
    var pose = phase;

    if (phase === "listen") {
      var leave = Math.min(1, modeT / 0.62);
      if (leave < 0.22) {
        var c = leave / 0.22;
        py = 4 * c;
        sx = 1.1;
        sy = 0.86;
        x = homeX;
      } else {
        var k = ease(Math.min(1, (leave - 0.22) / 0.78));
        var dest = Math.max(8, homeX - Math.min(84, laneW * 0.38));
        x = homeX + (dest - homeX) * k;
        var arc = Math.sin(Math.min(1, (leave - 0.22) / 0.78) * Math.PI);
        py = -arc * 14;
        sx = 0.92;
        sy = 1 + arc * 0.1;
      }
      var perk = Math.min(1, modeT / 0.5);
      lead = -20 * perk;
      followEar = 20 * perk;
      rot = -4 * Math.min(1, modeT / 0.4);
      blink = modeT > 0.46 && modeT < 0.56 ? "1" : "0";
      face = -1;
    } else if (phase === "download" || phase === "upload") {
      var heavy = phase === "upload";
      var speed = mbps > 8 ? mbps : 8;
      var rate = (heavy ? 90 : 120) + Math.min(speed, 2200) / 2200 * (heavy ? 220 : 460);
      var period = (heavy ? 0.5 : 0.42) - Math.min(speed, 2000) / 2000 * (heavy ? 0.16 : 0.2);
      if (period < 0.2) period = 0.2;
      if (flipT > 0) {
        flipT -= dt;
        var f = 1 - Math.max(0, flipT) / 0.16;
        if (f > 1) f = 1;
        var shown = flipFrom + (flipTo - flipFrom) * f;
        var width = Math.abs(shown);
        if (width < 0.45) width = 0.45;
        face = f > 0.5 ? flipTo : flipFrom;
        sx = (face < 0 ? -1 : 1) * width;
        sy = 1.16 - width * 0.12;
        py = 5 * Math.sin(f * Math.PI);
        rot = face * 7 * (1 - f);
        lead = 12 * (1 - f);
        followEar = -5 * (1 - f);
      } else {
        runDir = face;
        x += runDir * rate * dt;
        if (x > homeX) {
          x = homeX;
          if (face !== -1) {
            flipFrom = face;
            flipTo = -1;
            flipT = 0.12;
          }
          face = -1;
          runDir = -1;
        } else if (x < 4) {
          x = 4;
          if (face !== 1) {
            flipFrom = face;
            flipTo = 1;
            flipT = 0.12;
          }
          face = 1;
          runDir = 1;
        }
        var u = (modeT % period) / period;
        var hop = hopShape(u, heavy);
        py = hop.y;
        sx = hop.sx * face;
        sy = hop.sy;
        rot = face * (heavy ? 8 : 6);
        lead = hop.ear * (face < 0 ? 1 : -1);
        followEar = lead * 0.45;
      }
      blink = "0";
    } else if (phase === "return") {
      var dur = 0.9;
      var u = Math.min(1, modeT / dur);
      var from = phaseFrom;
      if (u < 0.16) {
        var a = u / 0.16;
        x = from;
        py = 5 * a;
        sx = face * (1 + 0.12 * a);
        sy = 1 - 0.18 * a;
        lead = 10 * a;
        followEar = 4 * a;
      } else if (u < 0.74) {
        var b = (u - 0.16) / 0.58;
        var e = ease(b);
        x = from + (homeX - from) * e;
        var arc = Math.sin(b * Math.PI);
        py = -arc * 24;
        sx = face * (0.9 + (1 - arc) * 0.06);
        sy = 1 + arc * 0.14;
        lead = -18 * (1 - b);
        followEar = -8 * (1 - b);
        rot = face * 5 * (1 - b);
      } else {
        var c = (u - 0.74) / 0.26;
        x = homeX;
        var settle = Math.sin(c * Math.PI * 2) * (1 - c);
        py = 0;
        sx = face * (1 + settle * 0.08);
        sy = 1 - settle * 0.14;
        lead = 16 * (1 - c);
        followEar = 8 * (1 - c);
      }
      blink = u > 0.8 && u < 0.9 ? "1" : "0";
      if (u >= 1) {
        phase = "back";
        pose = "back";
        still("back");
        raf = 0;
        last = 0;
        return;
      }
    } else {
      still(phase === "back" ? "back" : "home");
      raf = 0;
      last = 0;
      return;
    }

    rabbit.setAttribute("data-pose", pose);
    lidsOpacity(blink);
    var scaleX = Math.abs(sx) < 0.08 ? (sx < 0 ? -0.08 : 0.08) : sx;
    draw(x, py, scaleX, sy, rot, lead, followEar, dt);
    raf = window.requestAnimationFrame(frame);
  }

  var phaseFrom = 0;

  function kick() {
    if (reduce || hidden) return;
    if (raf) return;
    last = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function go(next) {
    if (next === phase) return;
    if (next === "upload" && (phase === "download" || phase === "listen")) {
      flipFrom = face < 0 ? -1 : 1;
      flipTo = flipFrom * -1;
      flipT = 0.16;
      face = flipTo;
    }
    if (next === "download") {
      face = x > homeX * 0.5 ? -1 : 1;
      runDir = face;
    }
    if (next === "return") {
      phaseFrom = x;
      face = homeX >= x ? 1 : -1;
    }
    phase = next;
    modeT = 0;
    var busy = next === "listen" || next === "download" || next === "upload" || next === "return";
    holdCompanion(busy);
    if (reduce) {
      var stillPose = next === "listen" || next === "download" || next === "upload" ? "testing" : next === "return" ? "back" : "home";
      still(stillPose);
      return;
    }
    if (next === "home") {
      still("home");
      return;
    }
    rabbit.setAttribute("data-pose", next);
    kick();
  }

  function mapPhase(name) {
    if (name === "latency" || name === "latencyUnderLoad") return "listen";
    if (name === "download") return "download";
    if (name === "upload") return "upload";
    if (name === "done") return "return";
    return "home";
  }

  measure();
  still(reduce ? "home" : "home");
  if (window.ResizeObserver) {
    var observer = new ResizeObserver(function () { measure(); });
    observer.observe(lane);
  } else {
    window.addEventListener("resize", measure);
  }
  document.addEventListener("visibilitychange", function () {
    hidden = document.visibilityState === "hidden";
    if (hidden) {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      return;
    }
    if (phase !== "home" && phase !== "back") kick();
  });

  return {
    phase: function (name) { go(mapPhase(name)); },
    sample: function (sample) {
      if (!sample) return;
      if (phase === "download" && sample.downloadMbps != null) mbps = sample.downloadMbps;
      else if (phase === "upload" && sample.uploadMbps != null) mbps = sample.uploadMbps;
    }
  };
}
