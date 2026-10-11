/* HonestPing: "Try a 7-day example" (preview).
   Simulated in the browser. No network, no cookies, no storage. */
(function () {
  var SLOTS = ["morning", "afternoon", "evening"];
  var SLOT_LABELS = { morning: "Mornings", afternoon: "Afternoons", evening: "Evenings" };
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var STEP_MS = 820;
  var RING_C = 2 * Math.PI * 50;

  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function median(values) {
    var a = values.slice().sort(function (x, y) { return x - y; });
    return a[(a.length - 1) >> 1];
  }

  function pctOf(mbps, plan) {
    return Math.round((mbps / plan) * 100);
  }

  function gap(bill, plan, typical) {
    if (!(plan > 0) || typical >= plan) return 0;
    return bill * (1 - typical / plan);
  }

  function money(v) {
    if (v > 0 && v < 10) return "$" + v.toFixed(2);
    return "$" + Math.round(v).toLocaleString("en-US");
  }

  /* Ranges match the #user-types guide. Tiers are the usual advertised steps, used only to see whether the next step down still covers that range. */
  var USES = {
    light: { min: 100, max: 100, about: 100 },
    stream: { min: 100, max: 300, about: 300 },
    gamer: { min: 100, max: 300, about: 300 },
    remote: { min: 100, max: 300, about: 300 },
    heavy: { min: 500, max: 1000, about: 1000 },
    home: { min: 300, max: 500, about: 500 }
  };
  var TIERS = [100, 200, 300, 500, 1000, 2000];

  function nextTierDown(planMbps) {
    var below = null;
    var i;
    for (i = 0; i < TIERS.length; i++) {
      if (TIERS[i] < planMbps) below = TIERS[i];
    }
    return below;
  }

  function planFit(planMbps, use) {
    var next;
    if (planMbps < use.min) {
      return { kind: "small", text: "Your plan may be on the small side for how you use it." };
    }
    next = nextTierDown(planMbps);
    if (planMbps > use.max * 2 && next !== null && next >= use.max) {
      return {
        kind: "big",
        text: "Your plan may be bigger than your home needs. Homes like yours usually do fine with about " + use.about + " Mbps. A smaller plan may save about $20/month."
      };
    }
    return { kind: "fit", text: "Your plan looks like a fit for how you use it." };
  }

  function speedCopy(summary) {
    if (summary.good) return "You got the speed you pay for.";
    return "You may be overpaying by about " + money(summary.monthly) + "/month for speed you don\u2019t get.";
  }

  function pick(total, count) {
    var bag = [];
    var i;
    var j;
    var tmp;
    for (i = 0; i < total; i++) bag.push(i);
    for (i = bag.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    return bag.slice(0, count);
  }

  function has(list, value) {
    return list.indexOf(value) !== -1;
  }

  function buildWeek(plan) {
    var good = Math.random() < 1 / 3;
    var eveningDips = good ? pick(7, 4 + Math.floor(Math.random() * 3)) : [];
    var afternoonDips = good ? [] : pick(7, 4 + Math.floor(Math.random() * 3));
    var tests = [];
    var index = 0;
    var day;
    var slotIndex;
    var slot;
    var ratio;

    for (day = 0; day < 7; day++) {
      for (slotIndex = 0; slotIndex < 3; slotIndex++) {
        slot = SLOTS[slotIndex];
        if (slot === "morning") {
          ratio = good ? rand(0.96, 1.06) : rand(0.94, 1.05);
        } else if (slot === "afternoon") {
          if (!good && has(afternoonDips, day)) ratio = rand(0.55, 0.86);
          else ratio = good ? rand(0.93, 1.03) : rand(0.93, 1.02);
        } else if (good && !has(eveningDips, day)) {
          ratio = rand(0.92, 1.0);
        } else if (good) {
          ratio = rand(0.74, 0.88);
        } else {
          ratio = rand(0.42, 0.75);
        }
        tests.push({
          i: index,
          day: day,
          slot: slot,
          mbps: Math.max(1, Math.round(plan * ratio))
        });
        index++;
      }
    }
    enforce(tests, plan, good);
    return tests;
  }

  function enforce(tests, plan, good) {
    var guard = 0;
    var values;
    var med;
    var isGood;
    var low;
    var high;
    while (guard < 40) {
      guard++;
      values = tests.map(function (t) { return t.mbps; });
      med = median(values);
      isGood = pctOf(med, plan) >= 90;
      if (good === isGood) return;
      if (good) {
        low = null;
        tests.forEach(function (t) {
          if (t.slot === "evening") return;
          if (!low || t.mbps < low.mbps) low = t;
        });
        if (!low) return;
        low.mbps = Math.max(1, Math.round(plan * rand(0.94, 1.03)));
      } else {
        high = null;
        tests.forEach(function (t) {
          if (t.slot === "morning") return;
          if (!high || t.mbps > high.mbps) high = t;
        });
        if (!high) return;
        high.mbps = Math.max(1, Math.round(plan * rand(0.58, 0.82)));
      }
    }
  }

  function slowest(tests) {
    var best = null;
    SLOTS.forEach(function (slot) {
      var nums = tests.filter(function (t) { return t.slot === slot; }).map(function (t) { return t.mbps; });
      var med = median(nums);
      if (!best || med < best.mbps) best = { slot: slot, label: SLOT_LABELS[slot], mbps: med };
    });
    return best;
  }

  function summarize(tests, plan, bill) {
    var values = tests.map(function (t) { return t.mbps; });
    var typical = median(values);
    var pct = pctOf(typical, plan);
    var slow = slowest(tests);
    var monthly = gap(bill, plan, typical);
    return {
      typical: typical,
      pct: pct,
      good: pct >= 90,
      slowLabel: slow.label,
      slowMbps: slow.mbps,
      monthly: monthly,
      yearly: monthly * 12
    };
  }

  function outcomeCopy(summary, fit) {
    var both = summary.good && fit && fit.kind === "fit";
    if (both) {
      return {
        title: "You got what you pay for!",
        detail: "Run it again every few months, or whenever something feels off. These are estimates. Your provider decides."
      };
    }
    if (!summary.good) {
      return {
        title: speedCopy(summary),
        detail: "About " + money(summary.yearly) + " a year for speed you don\u2019t get. These are estimates. Your provider decides."
      };
    }
    return {
      title: speedCopy(summary),
      detail: "These are estimates. Your provider decides."
    };
  }

  function resultAnnouncement(summary, fit) {
    var copy = outcomeCopy(summary, fit);
    return "Typical speed " + summary.typical + " Mbps, " + summary.pct +
      "% of plan. Slowest time of day: " + summary.slowLabel + ". Speed: " +
      speedCopy(summary) + " Plan fit: " + fit.text +
      " Based on how you said your home uses the internet. " + copy.detail;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      buildWeek: buildWeek,
      summarize: summarize,
      outcomeCopy: outcomeCopy,
      gap: gap,
      money: money,
      median: median,
      planFit: planFit,
      speedCopy: speedCopy,
      USES: USES
    };
  }
  if (typeof document === "undefined") return;

  var form = document.getElementById("try-week-form");
  var planEl = document.getElementById("try-plan");
  var billEl = document.getElementById("try-bill");
  var useEl = document.getElementById("try-use");
  var errorEl = document.getElementById("try-error");
  var runBtn = document.getElementById("try-run");
  var skipBtn = document.getElementById("try-skip");
  var live = document.getElementById("try-live");
  var stage = document.getElementById("try-stage");
  var ringNum = document.getElementById("try-ring-num");
  var countEl = document.getElementById("try-count");
  var dayEl = document.getElementById("try-day");
  var ring = document.getElementById("try-ring");
  var barEl = document.getElementById("try-bar");
  var nowEl = document.getElementById("try-now");
  var soFarEl = document.getElementById("try-so-far");
  var slowEl = document.getElementById("try-slow");
  var speedEl = document.getElementById("try-speed");
  var fitEl = document.getElementById("try-fit");
  var detailEl = document.getElementById("try-detail");
  var strip = document.getElementById("try-strip");
  var againBtn = document.getElementById("try-again");
  var quietEl = document.getElementById("try-quiet");
  if (!form || !planEl || !billEl || !useEl || !errorEl || !runBtn || !skipBtn || !live || !stage || !ringNum || !countEl || !dayEl || !ring || !barEl || !nowEl || !soFarEl || !slowEl || !speedEl || !fitEl || !detailEl || !strip || !againBtn || !quietEl) return;

  ring.style.strokeDasharray = "0 " + RING_C;

  var tests = [];
  var plan = 300;
  var bill = 70;
  var use = USES.stream;
  var revealed = 0;
  var running = false;
  var timer = 0;

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function readNumber(el) {
    var raw = String(el.value).trim().replace(/,/g, "");
    var value;
    if (raw === "") return null;
    value = Number(raw);
    if (!isFinite(value)) return null;
    return value;
  }

  function clearInvalid() {
    errorEl.textContent = "";
    errorEl.hidden = true;
    [planEl, billEl, useEl].forEach(function (el) {
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    });
  }

  function setInvalid(el, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    [planEl, billEl, useEl].forEach(function (field) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    });
    el.setAttribute("aria-invalid", "true");
    el.setAttribute("aria-describedby", "try-error");
    el.focus();
  }

  function readInputs() {
    var nextPlan = readNumber(planEl);
    var nextBill = readNumber(billEl);
    if (nextPlan === null || nextPlan < 1 || nextPlan > 10000) {
      setInvalid(planEl, "Enter a plan speed from 1 to 10000 Mbps.");
      return false;
    }
    if (nextBill === null || nextBill < 0 || nextBill > 1000) {
      setInvalid(billEl, "Enter a monthly bill from 0 to 1000.");
      return false;
    }
    if (!USES[useEl.value]) {
      setInvalid(useEl, "Choose how your home uses the internet.");
      return false;
    }
    clearInvalid();
    plan = nextPlan;
    bill = nextBill;
    use = USES[useEl.value];
    return true;
  }

  function setBusy(busy) {
    running = busy;
    runBtn.disabled = busy;
    planEl.disabled = busy;
    billEl.disabled = busy;
    useEl.disabled = busy;
    stage.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function dayShown(count) {
    if (count <= 0) return 1;
    return Math.min(7, Math.floor(Math.min(count, 20) / 3) + 1);
  }

  function tone(pct) {
    if (pct >= 80) return "is-good";
    if (pct >= 60) return "is-mid";
    return "is-low";
  }

  function cellTone(pct) {
    if (pct >= 80) return "is-g";
    if (pct >= 60) return "is-a";
    return "is-r";
  }

  function countLine(count) {
    var day;
    var left;
    if (count >= 21) return "21 of 21 tests done";
    day = dayShown(count);
    left = 8 - day;
    return count + " of 21 tests done · about " + left + " " + (left === 1 ? "day" : "days") + " to go";
  }

  function nowText(count) {
    var last;
    var next;
    if (count <= 0) return "Starting. First test Mon morning.";
    if (count >= 21) return "All 21 tests done.";
    last = tests[count - 1];
    next = tests[count];
    return "Saved: " + DAYS[last.day] + " " + last.slot + ", " + pctOf(last.mbps, plan) + "% of plan. Next is " + DAYS[next.day] + " " + next.slot + ".";
  }

  function paintFit() {
    var fit = planFit(plan, use);
    fitEl.textContent = fit.text;
    fitEl.className = "app7-val " + (fit.kind === "fit" ? "is-good" : fit.kind === "small" ? "is-mid" : "is-short");
    return fit;
  }

  function paintTiles(count) {
    var summary;
    var slowPct;
    var fit = paintFit();
    if (count <= 0) {
      soFarEl.textContent = "Waiting for the first test";
      soFarEl.className = "app7-val";
      slowEl.textContent = "·";
      slowEl.className = "app7-val";
      speedEl.textContent = "Waiting for the first test";
      speedEl.className = "app7-val";
      detailEl.hidden = true;
      detailEl.textContent = "";
      return null;
    }
    summary = summarize(tests.slice(0, count), plan, bill);
    slowPct = pctOf(summary.slowMbps, plan);
    soFarEl.textContent = summary.pct + "% of your plan";
    soFarEl.className = "app7-val " + tone(summary.pct);
    slowEl.textContent = summary.slowLabel + " · " + slowPct + "%";
    slowEl.className = "app7-val " + tone(slowPct);
    speedEl.textContent = speedCopy(summary);
    speedEl.className = "app7-val " + (summary.good ? "is-good" : "is-short");
    detailEl.textContent = outcomeCopy(summary, fit).detail;
    detailEl.hidden = false;
    summary.fit = fit;
    return summary;
  }

  function render(count) {
    var day;
    var slot;
    var index;
    var col;
    var cell;
    var label;
    var pct;
    var activeDay;
    ringNum.textContent = String(count);
    dayEl.textContent = "Day " + dayShown(count) + " of 7";
    countEl.textContent = countLine(count);
    barEl.style.width = (count / 21 * 100) + "%";
    ring.style.strokeDasharray = (RING_C * count / 21) + " " + RING_C;
    nowEl.textContent = nowText(count);
    strip.textContent = "";
    activeDay = count >= 21 ? -1 : Math.min(6, Math.floor(count / 3));
    for (day = 0; day < 7; day++) {
      col = document.createElement("div");
      col.className = "app7-d";
      for (slot = 0; slot < 3; slot++) {
        index = day * 3 + slot;
        cell = document.createElement("div");
        if (index < count) {
          pct = pctOf(tests[index].mbps, plan);
          cell.className = "app7-cl " + cellTone(pct);
          cell.textContent = pct + "%";
        } else if (index === count && running) {
          cell.className = "app7-cl is-next";
          cell.textContent = "next";
        } else {
          cell.className = "app7-cl is-empty";
        }
        col.appendChild(cell);
      }
      label = document.createElement("div");
      label.className = day === activeDay ? "app7-h is-today" : "app7-h";
      label.textContent = DAYS[day];
      col.appendChild(label);
      strip.appendChild(col);
    }
    return paintTiles(count);
  }

  function showStage() {
    stage.hidden = false;
    skipBtn.hidden = false;
    againBtn.hidden = true;
    quietEl.hidden = true;
  }

  function finish(announce) {
    var summary;
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    setBusy(false);
    revealed = 21;
    stage.hidden = false;
    skipBtn.hidden = true;
    againBtn.hidden = false;
    quietEl.hidden = false;
    summary = render(21);
    if (announce && summary) live.textContent = resultAnnouncement(summary, summary.fit);
    stage.focus();
  }

  function tick() {
    timer = 0;
    if (!running) return;
    revealed += 1;
    render(revealed);
    if (revealed >= 21) {
      finish(true);
      return;
    }
    if (revealed % 3 === 0) {
      live.textContent = "Day " + (revealed / 3) + " of 7. " + revealed + " of 21 tests.";
    }
    timer = window.setTimeout(tick, STEP_MS);
  }

  function start() {
    if (running) return;
    if (!readInputs()) return;
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    tests = buildWeek(plan);
    revealed = 0;
    live.textContent = "";
    if (reduceMotion()) {
      setBusy(false);
      finish(true);
      return;
    }
    setBusy(true);
    render(0);
    showStage("run");
    live.textContent = "Running a sample week. Day 1 of 7.";
    skipBtn.focus();
    timer = window.setTimeout(tick, STEP_MS);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    start();
  });
  skipBtn.addEventListener("click", function () {
    if (!running) return;
    finish(true);
  });
  againBtn.addEventListener("click", function () {
    start();
  });
})();
