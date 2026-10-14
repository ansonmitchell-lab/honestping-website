/* Dark example-week player. Same story as the light timelapse:
   a 7-day report fills in, then the results card.
   Pro's price is not set. Do not show a price or a bracket placeholder. */
(function () {
  var root = document.getElementById("week-play");
  if (!root) return;

  var SPEED = [90, 72, 52, 92, 74, 54, 94, 76, 55, 88, 77, 57, 91, 80, 58, 86, 82, 60, 93, 84, 62];
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var SLOTS = ["morning", "afternoon", "evening"];
  var WHEN = ["8 AM", "1 PM", "6 PM"];
  var DUR = 20000;
  var RING = 2 * Math.PI * 50;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ring = document.getElementById("week-ring");
  var ringNum = document.getElementById("week-ring-num");
  var dayEl = document.getElementById("week-day");
  var countEl = document.getElementById("week-count");
  var nowEl = document.getElementById("week-now");
  var heat = document.getElementById("week-heat");
  var soFar = document.getElementById("week-sofar");
  var slow = document.getElementById("week-slow");
  var money = document.getElementById("week-money");
  var modal = document.getElementById("week-modal");
  var playBtn = document.getElementById("week-play-btn");
  var rateBtn = document.getElementById("week-rate");
  var replayBtn = document.getElementById("week-replay");
  var timeEl = document.getElementById("week-time");
  var fill = document.getElementById("week-fill");
  var track = document.getElementById("week-track");
  if (!ring || !heat || !playBtn || !modal) return;

  var t = 0;
  var rate = 1;
  var playing = false;
  var raf = 0;
  var last = 0;
  var mode = "speed";

  function median(values) {
    if (!values.length) return 0;
    var a = values.slice().sort(function (x, y) { return x - y; });
    return a[(a.length - 1) >> 1];
  }

  function tone(pct) {
    if (pct >= 80) return "is-g";
    if (pct >= 60) return "is-a";
    return "is-r";
  }

  function countAt(ms) {
    var u = Math.min(1, ms / DUR);
    if (u >= 0.86) return 21;
    return Math.min(21, Math.floor((u / 0.86) * 21));
  }

  var opener = null;
  function modalItems() {
    return Array.prototype.slice.call(modal.querySelectorAll("a[href], button, input, select, textarea")).filter(function (el) {
      return !el.disabled && !el.hidden;
    });
  }
  function showModal(on) {
    var was = !modal.hidden;
    modal.hidden = !on;
    root.classList.toggle("is-results", on);
    if (on) modal.setAttribute("aria-modal", "true");
    else modal.removeAttribute("aria-modal");
    if (on && !was) {
      var active = document.activeElement;
      if (root.contains(active)) {
        opener = active;
        if (closeBtn) closeBtn.focus();
      } else opener = null;
    }
    if (!on && was && opener && opener.focus && document.contains(opener)) {
      opener.focus();
      opener = null;
    }
  }

  function clock(ms) {
    var s = Math.min(20, Math.round(ms / 1000));
    return "0:" + (s < 10 ? "0" : "") + s;
  }

  function render() {
    var n = countAt(t);
    var u = Math.min(1, t / DUR);
    var seen = SPEED.slice(0, n);
    var pct = seen.length ? median(seen) : 0;
    var day = n === 0 ? 1 : Math.min(7, Math.ceil(n / 3));
    ring.style.strokeDasharray = (RING * n / 21) + " " + RING;
    ringNum.textContent = String(n);
    dayEl.textContent = "Day " + day + " of 7";
    if (n === 0) countEl.textContent = "Starting, about 7 days to go";
    else countEl.textContent = n + " of 21 tests done, about " + (7 - day) + " days to go";
    if (n === 0) nowEl.textContent = "Waiting. Next test Mon at 8 AM.";
    else {
      var i = n - 1;
      nowEl.textContent = "Saved: " + DAYS[Math.floor(i / 3)] + " " + SLOTS[i % 3] + ", " + SPEED[i] + "% of plan.";
    }
    heat.textContent = "";
    var d;
    var s;
    var idx;
    var col;
    var cell;
    var label;
    for (d = 0; d < 7; d++) {
      col = document.createElement("div");
      col.className = "week-d";
      for (s = 0; s < 3; s++) {
        idx = d * 3 + s;
        cell = document.createElement("div");
        if (idx < n) {
          cell.className = "week-cl " + tone(SPEED[idx]);
          cell.textContent = SPEED[idx] + "%";
        } else {
          cell.className = "week-cl is-empty";
        }
        col.appendChild(cell);
      }
      label = document.createElement("div");
      label.className = "week-h" + (d === day - 1 && n < 21 ? " is-today" : "");
      label.textContent = DAYS[d];
      col.appendChild(label);
      heat.appendChild(col);
    }
    soFar.textContent = n ? pct + "% of your plan" : "Waiting for the first test";
    soFar.className = "week-val" + (n && pct < 80 ? " is-mid" : "");
    if (!n) {
      slow.textContent = "Waiting for the first test";
      money.textContent = "Waiting for the first test";
    } else {
      var names = { morning: "Mornings", afternoon: "Afternoons", evening: "Evenings" };
      var best = null;
      SLOTS.forEach(function (slot, si) {
        var nums = [];
        var k;
        for (k = si; k < n; k += 3) nums.push(SPEED[k]);
        if (!nums.length) return;
        var med = median(nums);
        if (!best || med < best.med) best = { slot: slot, med: med };
      });
      slow.textContent = best ? names[best.slot] + ", " + best.med + "%" : "Waiting for the first test";
      money.textContent = pct < 90 && n >= 9 ? "You may be paying about $20/month for speed you don't get" : "Too early to say";
    }
    showModal(u >= 0.9);
    if (timeEl) timeEl.textContent = clock(t);
    if (fill) fill.style.width = (u * 100) + "%";
    root.setAttribute("data-mode", mode);
  }

  function setLabel() {
    playBtn.textContent = playing ? "Pause" : "Play";
    playBtn.setAttribute("aria-pressed", playing ? "true" : "false");
  }

  function tick(now) {
    if (!playing) return;
    if (document.hidden) {
      last = now;
      raf = requestAnimationFrame(tick);
      return;
    }
    var dt = Math.min(80, now - last);
    last = now;
    t = Math.min(DUR, t + dt * rate);
    render();
    if (t >= DUR) {
      playing = false;
      setLabel();
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (reduce) {
      t = DUR;
      render();
      playing = false;
      setLabel();
      return;
    }
    if (t >= DUR) t = 0;
    playing = true;
    setLabel();
    last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    setLabel();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  playBtn.addEventListener("click", function () {
    if (playing) pause();
    else play();
  });

  if (rateBtn) rateBtn.addEventListener("click", function () {
    rate = rate === 1 ? 2 : 1;
    rateBtn.textContent = rate + "x";
  });

  if (replayBtn) replayBtn.addEventListener("click", function () {
    t = 0;
    render();
    play();
  });

  var again = document.getElementById("week-again");
  var closeBtn = document.getElementById("week-close");
  if (again) again.addEventListener("click", function () {
    t = 0;
    render();
    play();
  });
  if (closeBtn) closeBtn.addEventListener("click", function () {
    pause();
    if (t >= DUR * 0.9) t = DUR * 0.82;
    render();
  });

  root.querySelectorAll(".week-seg button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      mode = btn.getAttribute("data-mode") || "speed";
      root.querySelectorAll("[data-mode]").forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
      });
      render();
    });
  });

  if (track) {
    track.addEventListener("click", function (event) {
      var r = track.getBoundingClientRect();
      var u = Math.max(0, Math.min(1, (event.clientX - r.left) / r.width));
      t = u * DUR;
      render();
      if (!modal.hidden && closeBtn) {
        opener = playBtn;
        closeBtn.focus();
      }
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && playing) last = performance.now();
  });

  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    var active = document.activeElement;
    var inModal = modal.contains(active);
    if (e.key === "Escape") {
      var typing = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && !inModal;
      if (typing) return;
      e.preventDefault();
      if (closeBtn) closeBtn.click();
      return;
    }
    if (e.key !== "Tab" || !inModal) return;
    var items = modalItems();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  });

  function arm() {
    render();
    setLabel();
    if (reduce || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!playing && t < DUR) play();
        } else if (playing) {
          pause();
        }
      });
    }, { threshold: 0.4 });
    io.observe(root);
  }
  arm();
})();
