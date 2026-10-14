/* Page controller for the speed test preview. Results stay in this page. */
(function () {
  var engineApi = window.HonestPingSpeedEngine;
  var counters = window.HonestPingSpeedCounters;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.querySelector("[data-speedtest]");
  if (!root || !engineApi) return;

  var engine = engineApi.create(engineApi.recommended);
  var cancel = null;
  var running = false;
  var scaleDown = 100;
  var scaleUp = 25;
  var planKey = "hp-webtest-plan";
  var CIRC = 2 * Math.PI * 46;

  var startBtn = root.querySelector("[data-start]");
  var phaseEl = root.querySelector("[data-phase]");
  var liveEl = root.querySelector("[data-live]");
  var rabbit = root.querySelector("[data-rabbit]");
  var downInput = root.querySelector("[data-plan-down]");
  var upInput = root.querySelector("[data-plan-up]");
  var remember = root.querySelector("[data-remember]");
  var hook = root.querySelector("[data-hook]");
  var outcomeEl = root.querySelector("[data-outcome]");
  var percents = root.querySelector("[data-percents]");
  var cta = root.querySelector("[data-cta]");

  var LINES = {
    snapshot: "One test is a snapshot. Your evenings may differ.",
    busy: "Ping rose while the line was busy. That often shows up most in the evening.",
    under: "This snapshot came in under the download you entered. One test cannot say why.",
    steady: "This snapshot looked steady. Evenings can still differ.",
    cta: "See your evenings. The HonestPing app tests every evening HonestPing is open and builds a 7 day report."
  };

  function $(sel) { return root.querySelector(sel); }

  function planNumber(input) {
    var n = Number(String(input.value).replace(/,/g, ""));
    if (!isFinite(n) || n <= 0) return null;
    return n;
  }

  function fmtMbps(n) {
    if (n == null || !isFinite(n)) return null;
    if (n >= 100) return String(Math.round(n));
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(1);
  }

  function setArc(name, mbps, scale) {
    var arc = root.querySelector('[data-arc="' + name + '"]');
    var value = root.querySelector('[data-value="' + name + '"]');
    if (!arc || !value) return;
    if (mbps == null) {
      arc.setAttribute("stroke-dasharray", "0 " + CIRC.toFixed(1));
      arc.setAttribute("stroke-opacity", "0");
      value.textContent = "0";
      return;
    }
    var frac = scale > 0 ? Math.max(0, Math.min(1, mbps / scale)) : 0;
    var len = frac * CIRC;
    arc.setAttribute("stroke-dasharray", len.toFixed(1) + " " + CIRC.toFixed(1));
    arc.setAttribute("stroke-opacity", frac > 0 ? "1" : "0");
    value.textContent = fmtMbps(mbps);
  }

  function growScale(current, value, plan) {
    if (plan) return plan * 1.25;
    var steps = [25, 50, 100, 250, 500, 1000, 2000, 5000];
    var scale = current || steps[0];
    var i = 0;
    while (value != null && value > scale * 0.82 && i < steps.length) {
      if (steps[i] > scale) scale = steps[i];
      i += 1;
    }
    if (value != null && value > scale * 0.82) scale = value * 1.25;
    return scale;
  }

  function ratePing(ms) {
    if (ms == null) return "Waiting";
    if (ms < 20) return "Low";
    if (ms < 50) return "Fine for most uses";
    if (ms < 100) return "Noticeable";
    return "High for live calls and games";
  }

  function rateJitter(ms) {
    if (ms == null) return "Waiting";
    if (ms < 5) return "Steady";
    if (ms < 15) return "Some variation";
    return "Uneven";
  }

  function busyMs(sample) {
    var vals = [sample.loadedDownMs, sample.loadedUpMs].filter(function (n) { return n != null; });
    if (!vals.length) return null;
    return Math.max.apply(null, vals);
  }

  function rateBusy(sample) {
    var busy = busyMs(sample);
    if (busy == null) return "Shows up while download or upload is running.";
    if (sample.pingMs != null && busy > sample.pingMs + 30) return "Higher while the line is busy";
    return "Close to the idle ping";
  }

  function setMetric(name, text, sub) {
    var el = root.querySelector('[data-metric="' + name + '"]');
    var note = root.querySelector('[data-note="' + name + '"]');
    if (el) el.textContent = text;
    if (note) note.textContent = sub;
  }

  function setScaleNote(name, scale, plan) {
    var el = root.querySelector('[data-scale="' + name + '"]');
    if (!el) return;
    var top = Math.round(scale);
    el.textContent = plan
      ? "Scale 0 to " + top + " Mbps, about 1.25 times the plan you entered."
      : "Scale 0 to " + top + " Mbps. It follows this reading.";
  }

  function paint(sample) {
    var planDown = planNumber(downInput);
    var planUp = planNumber(upInput);
    if (sample.downloadMbps != null) scaleDown = growScale(scaleDown, sample.downloadMbps, planDown);
    else if (planDown) scaleDown = planDown * 1.25;
    if (sample.uploadMbps != null) scaleUp = growScale(scaleUp, sample.uploadMbps, planUp);
    else if (planUp) scaleUp = planUp * 1.25;
    setArc("down", sample.downloadMbps, scaleDown);
    setArc("up", sample.uploadMbps, scaleUp);
    setScaleNote("down", scaleDown, planDown);
    setScaleNote("up", scaleUp, planUp);
    setMetric("ping", sample.pingMs == null ? "Waiting" : sample.pingMs + " ms", ratePing(sample.pingMs));
    setMetric("jitter", sample.jitterMs == null ? "Waiting" : sample.jitterMs + " ms", rateJitter(sample.jitterMs));
    setMetric("loss", "Not measured", "Not in this preview.");
    var busy = busyMs(sample);
    setMetric("busy", busy == null ? "Waiting" : busy + " ms", rateBusy(sample));
    paintUses(sample);
  }

  function useLine(kind, sample) {
    if (!sample || sample.pingMs == null) return "Waiting for this snapshot.";
    var ping = sample.pingMs;
    var jitter = sample.jitterMs == null ? 0 : sample.jitterMs;
    var down = sample.downloadMbps;
    if (kind === "calls") {
      return ping <= 40 && jitter <= 10
        ? "Looks calm enough for a call in this snapshot."
        : "A call may notice the delay in this snapshot.";
    }
    if (kind === "gaming") {
      return ping <= 35 && jitter <= 8
        ? "Looks playable in this snapshot."
        : "A game may feel the delay in this snapshot.";
    }
    if (down == null) return "Waiting for the download reading.";
    if (down >= 25) return "This snapshot has room for a high quality stream.";
    if (down >= 5) return "A stream may step down in quality on this snapshot.";
    return "A stream may pause on this snapshot.";
  }

  function paintUses(sample) {
    ["calls", "gaming", "streaming"].forEach(function (kind) {
      var el = root.querySelector('[data-use="' + kind + '"]');
      if (el) el.textContent = useLine(kind, sample);
    });
  }

  function phaseText(phase) {
    if (phase === "download") return "Measuring download";
    if (phase === "upload") return "Measuring upload";
    if (phase === "done") return "Snapshot ready";
    if (phase === "latency") return "Checking delay";
    return "Ready when you are";
  }

  function setPhase(phase) {
    var text = phaseText(phase);
    if (phaseEl) phaseEl.textContent = text;
    if (liveEl && liveEl.textContent !== text) liveEl.textContent = text;
  }

  function hop() {
    if (reduce || !rabbit) return;
    rabbit.classList.remove("is-hop");
    void rabbit.offsetWidth;
    rabbit.classList.add("is-hop");
  }

  function resetMeters() {
    scaleDown = planNumber(downInput) ? planNumber(downInput) * 1.25 : 100;
    scaleUp = planNumber(upInput) ? planNumber(upInput) * 1.25 : 25;
    paint({
      downloadMbps: null,
      uploadMbps: null,
      pingMs: null,
      jitterMs: null,
      loadedDownMs: null,
      loadedUpMs: null,
      loss: null
    });
    if (percents) percents.textContent = "Enter a plan to see a percent of that plan.";
    if (outcomeEl) outcomeEl.textContent = "The result line appears here.";
  }

  function percentLine(measured, plan, which) {
    if (!plan || measured == null) return "";
    var n = Math.round((measured / plan) * 100);
    return "About " + n + "% of your plan\u2019s " + which + ".";
  }

  function finish(sample) {
    running = false;
    cancel = null;
    startBtn.disabled = false;
    startBtn.textContent = "Run again";
    setPhase("done");
    paint(sample);
    var planDown = planNumber(downInput);
    var planUp = planNumber(upInput);
    var bits = [];
    var downLine = percentLine(sample.downloadMbps, planDown, "download");
    var upLine = percentLine(sample.uploadMbps, planUp, "upload");
    if (downLine) bits.push(downLine);
    if (upLine) bits.push(upLine);
    if (percents) percents.textContent = bits.length ? bits.join(" ") : "Enter a plan to see a percent of that plan.";
    var busy = busyMs(sample);
    var key = "steady";
    if (sample.pingMs != null && busy != null && busy > sample.pingMs + 30) key = "busy";
    else if (planDown && sample.downloadMbps < planDown * 0.8) key = "under";
    if (outcomeEl) outcomeEl.textContent = LINES[key];
    if (hook) hook.hidden = false;
    hop();
    if (counters) counters.count("test_completed");
  }

  function start() {
    if (running) return;
    if (cancel) cancel();
    running = true;
    resetMeters();
    if (hook) hook.hidden = false;
    startBtn.disabled = true;
    startBtn.textContent = "Running";
    setPhase("latency");
    hop();
    if (counters) counters.count("test_started");
    var active = engineApi.create(engineApi.recommended);
    cancel = active.start(function (sample) {
      setPhase(sample.phase);
      paint(sample);
    }, finish);
  }

  function loadPlan() {
    try {
      var raw = localStorage.getItem(planKey);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return;
      if (saved.down) downInput.value = String(saved.down).slice(0, 8);
      if (saved.up) upInput.value = String(saved.up).slice(0, 8);
      remember.checked = true;
    } catch (e) {}
  }

  function savePlan() {
    try {
      if (!remember.checked) {
        localStorage.removeItem(planKey);
        return;
      }
      localStorage.setItem(planKey, JSON.stringify({
        down: downInput.value,
        up: upInput.value
      }));
    } catch (e) {}
  }

  if (rabbit) {
    rabbit.addEventListener("animationend", function () {
      rabbit.classList.remove("is-hop");
    });
  }
  startBtn.addEventListener("click", start);
  downInput.addEventListener("input", savePlan);
  upInput.addEventListener("input", savePlan);
  remember.addEventListener("change", savePlan);
  if (cta) {
    cta.addEventListener("click", function () {
      if (counters) counters.count("cta_clicked");
    });
  }
  loadPlan();
  resetMeters();
  setPhase("idle");
})();
