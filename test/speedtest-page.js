/* Page controller. Results stay in this page. Counters never read the plan. */
import { createEngine } from "./speedtest-engine.js";
import { count } from "./speedtest-counters.js";

(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.querySelector("[data-speedtest]");
  if (!root) return;

  var engine = createEngine();
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
  var forget = root.querySelector("[data-forget]");
  var outcomeEl = root.querySelector("[data-outcome]");
  var headlineEl = root.querySelector("[data-headline]");
  var percents = root.querySelector("[data-percents]");
  var varyEl = root.querySelector("[data-variability]");
  var ctaLead = root.querySelector("[data-cta-lead]");
  var waitLead = root.querySelector("[data-waitlist-lead]");
  var unclearRuns = 0;

  var LINES = {
    snapshot: "One test is a snapshot. Your evenings may differ.",
    vary: "Speeds vary with Wi-Fi, devices and time of day, and plans usually promise speeds 'up to' a number.",
    busy: "Ping rose while the line was busy. That can show up more in the evening.",
    jitter: "Ping moved around a lot during this test. A week of tests shows whether that's a one off or a pattern.",
    belowHead: "This test came in under your plan.",
    below: "Lots of things can shape one test, at home and along the way. A week of tests, checked against your plan, gives a clearer picture.",
    mixedHead: "Mostly healthy, with one thing to watch.",
    goodHead: "This test looks healthy.",
    good: "Good news is worth knowing. A week of tests shows whether evenings hold up too.",
    unclearHead: "We couldn't get a clear reading this time.",
    unclear: "The test may have been interrupted, or the numbers didn't line up.",
    unclearAgain: "Some connections are hard to read in one go. The app can test over a week and show what's typical.",
    appLead: "See your evenings. Get the HonestPing app for Windows, then add a 7-day Pro report when you want the full week.",
    appPaid: "Free to download for Windows. Pro and the 7-day report are paid.",
    phone: "HonestPing is coming to Android and iOS.",
    waitLead: "See your evenings. Join the waitlist for the HonestPing app for Windows, then add a 7-day Pro report when you want the full week.",
    waitPrivacy: "Details in our privacy policy.",
    waitPaid: "Free to download for Windows when it launches. Pro and the 7-day report are paid.",
    waitConfirm: "Thanks, you're on the waitlist. We'll email you when the HonestPing app for Windows is ready to download. Every email has an unsubscribe link.",
    waitError: "That email doesn't look right. Please check it and try again."
  };

  function planNumber(input) {
    var n = Number(String(input.value).replace(/,/g, ""));
    if (!isFinite(n) || n <= 0) return null;
    return n;
  }

  function fmtMbps(n) {
    if (n == null || !isFinite(n)) return null;
    if (n >= 100) return String(Math.round(n));
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
    if (sample.pingMs != null && busy > sample.pingMs + 20) return "Higher while the line is busy";
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
    setMetric("loss", "Not measured", "Not measured on this test.");
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
    if (phase === "latency" || phase === "latencyUnderLoad") return "Checking delay";
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
    if (percents) {
      percents.textContent = "";
      percents.hidden = true;
    }
    if (varyEl) {
      varyEl.textContent = LINES.vary;
      varyEl.hidden = true;
    }
    if (headlineEl) {
      headlineEl.textContent = "";
      headlineEl.hidden = true;
    }
    if (outcomeEl) {
      outcomeEl.textContent = "";
      outcomeEl.hidden = true;
    }
  }

  function percentText(sample) {
    var planDown = planNumber(downInput);
    var planUp = planNumber(upInput);
    var down = sample.downloadMbps;
    var up = sample.uploadMbps;
    if (planDown && down != null && planUp && up != null) {
      return "About " + Math.round(down / planDown * 100) + "% of your plan's download and " + Math.round(up / planUp * 100) + "% of its upload on this test.";
    }
    if (planDown && down != null) {
      return "About " + Math.round(down / planDown * 100) + "% of your plan's download on this test.";
    }
    if (planUp && up != null) {
      return "About " + Math.round(up / planUp * 100) + "% of your plan's upload on this test.";
    }
    return "";
  }

  function chooseOutcome(sample) {
    var planDown = planNumber(downInput);
    var planUp = planNumber(upInput);
    if (sample.downloadMbps == null && sample.uploadMbps == null) {
      unclearRuns += 1;
      return {
        head: LINES.unclearHead,
        line: unclearRuns >= 2 ? LINES.unclearAgain : LINES.unclear
      };
    }
    unclearRuns = 0;
    var under = (planDown && sample.downloadMbps != null && sample.downloadMbps < planDown)
      || (planUp && sample.uploadMbps != null && sample.uploadMbps < planUp);
    if (under) return { head: LINES.belowHead, line: LINES.below };
    var busy = busyMs(sample);
    if (sample.pingMs != null && busy != null && busy > sample.pingMs + 20) {
      return { head: LINES.mixedHead, line: LINES.busy };
    }
    if (sample.jitterMs != null && sample.jitterMs >= 20) {
      return { head: LINES.mixedHead, line: LINES.jitter };
    }
    return { head: LINES.goodHead, line: LINES.good };
  }

  function finish(sample) {
    running = false;
    cancel = null;
    startBtn.disabled = false;
    startBtn.textContent = "Run it again";
    setPhase("done");
    paint(sample);
    var line = percentText(sample);
    if (percents) {
      percents.textContent = line;
      percents.hidden = !line;
    }
    if (varyEl) {
      varyEl.textContent = LINES.vary;
      varyEl.hidden = !line;
    }
    var chosen = chooseOutcome(sample);
    if (headlineEl) {
      headlineEl.textContent = chosen.head;
      headlineEl.hidden = !chosen.head;
    }
    if (outcomeEl) {
      outcomeEl.textContent = chosen.line;
      outcomeEl.hidden = !chosen.line;
    }
    hop();
    count("test_completed");
  }

  function start() {
    if (running) return;
    if (cancel) cancel();
    running = true;
    resetMeters();
    startBtn.disabled = true;
    startBtn.textContent = "Running";
    setPhase("latency");
    hop();
    count("test_started");
    var active = createEngine();
    cancel = active.start(function (sample) {
      setPhase(sample.phase);
      paint(sample);
    }, finish);
  }

  function loadPlan() {
    remember.checked = false;
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

  function forgetPlan() {
    downInput.value = "";
    upInput.value = "";
    remember.checked = false;
    try { localStorage.removeItem(planKey); } catch (e) {}
    resetMeters();
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
  if (forget) forget.addEventListener("click", forgetPlan);
  if (ctaLead) ctaLead.textContent = LINES.appLead;
  if (waitLead) waitLead.textContent = LINES.waitLead;
  var paid = root.querySelector(".st-app-paid");
  var phoneNote = root.querySelector(".st-phone-note");
  var privacyLink = root.querySelector(".st-waitlist a");
  if (paid) paid.textContent = LINES.appPaid;
  if (phoneNote) phoneNote.textContent = LINES.phone;
  if (privacyLink) privacyLink.textContent = LINES.waitPrivacy;
  var waitPaid = root.querySelector("[data-wait-paid]");
  var waitError = root.querySelector("[data-wait-error]");
  var waitConfirm = root.querySelector("[data-wait-confirm]");
  if (waitPaid) waitPaid.textContent = LINES.waitPaid;
  if (waitError) waitError.textContent = LINES.waitError;
  if (waitConfirm) waitConfirm.textContent = LINES.waitConfirm;
  root.querySelectorAll("[data-cta]").forEach(function (el) {
    el.addEventListener("click", function () { count("cta_clicked"); });
  });
  var waitForm = root.querySelector("#waitlist-form");
  if (waitForm) {
    waitForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailInput = waitForm.querySelector("input[type='email']");
      var email = ((emailInput && emailInput.value) || "").trim();
      var ok = emailInput && email.indexOf("@") > 0 && email.indexOf(".", email.indexOf("@")) > email.indexOf("@") + 1 && email.indexOf(" ") === -1;
      if (!ok) {
        if (waitConfirm) waitConfirm.hidden = true;
        if (waitError) waitError.hidden = false;
        if (emailInput) emailInput.focus();
        return;
      }
      if (waitError) waitError.hidden = true;
      if (waitConfirm) waitConfirm.hidden = false;
      var subject = encodeURIComponent("HonestPing waitlist");
      var body = encodeURIComponent(
        "Please add me to the HonestPing waitlist.\n\nEmail: " + email + "\n"
      );
      window.location.href = "mailto:hello@honestping.com?subject=" + subject + "&body=" + body;
    });
  }
  loadPlan();
  resetMeters();
  setPhase("idle");
})();
