/* Page controller. Results stay on this page, inside the gauges.
   Plan speeds stay in this browser. BRANCH_HOOKS_ENABLED stays false for
   production. A real result opens the matching panel only on an allowlisted
   preview host. ?demo=poor and ?demo=good still force one panel for review
   on that host, and on localhost. ?demo=short and ?demo=meet fill plan
   speeds the same way. */
import { createEngine } from "./speedtest-engine.js";
import { count } from "./speedtest-counters.js";
import { BRANCH_HOOKS_ENABLED, BRANCH_COPY, THRESHOLDS, isPoorResult, ratePing, rateJitter, rateBusy, useLine, loadedBusyMs } from "./speedtest-config.js?v=20261015k";
import { shortfallReport, SHORTFALL_COPY } from "./speedtest-shortfall.js";
import { mountRabbit } from "./speedtest-rabbit.js?v=20261015f";

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
  var signal = mountRabbit(root);
  var resultCard = root.querySelector("[data-result]");
  var downInput = root.querySelector("[data-plan-down]");
  var upInput = root.querySelector("[data-plan-up]");
  var remember = root.querySelector("[data-remember]");
  var forget = root.querySelector("[data-forget]");
  var outcomeEl = root.querySelector("[data-outcome]");
  var headlineEl = root.querySelector("[data-headline]");
  var shortfallEl = root.querySelector("[data-shortfall]");
  var shortPlanEl = root.querySelector("[data-short-plan]");
  var varyEl = root.querySelector("[data-variability]");
  var snapshotEl = root.querySelector("[data-snapshot]");
  var ctaLead = root.querySelector("[data-cta-lead]");
  var waitLead = root.querySelector("[data-waitlist-lead]");
  var branchEl = root.querySelector("[data-branch]");
  var branchHead = root.querySelector("[data-branch-head]");
  var branchBody = root.querySelector("[data-branch-body]");
  var branchMore = root.querySelector("[data-branch-more]");
  var branchLink = root.querySelector("[data-branch-link]");
  var appAnchor = root.querySelector("[data-app-anchor]");
  var appBlock = root.querySelector("[data-variant-app]");
  var unclearRuns = 0;
  var revealed = false;

  var LINES = {
    snapshot: "One test is a snapshot. Your evenings may differ.",
    busy: "Ping rose while the line was busy. That can show up more in the evening.",
    jitter: "Ping moved around a lot during this test. A week of tests shows whether that's a one off or a pattern.",
    mixedHead: "Mostly healthy, with one thing to watch.",
    belowHead: "This test came in under your plan.",
    below: "Lots of things can shape one test, at home and along the way. A week of tests, checked against your plan, gives a clearer picture.",
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
    var cap = THRESHOLDS.planScale;
    if (plan && !(value > plan * cap)) return plan * cap;
    var steps = [25, 50, 100, 250, 500, 1000, 2000, 5000];
    var scale = current || steps[0];
    var i = 0;
    while (value != null && value > scale * 0.82 && i < steps.length) {
      if (steps[i] > scale) scale = steps[i];
      i += 1;
    }
    if (value != null && value > scale * 0.82) scale = value * cap;
    return scale;
  }

  function busyMs(sample) {
    return loadedBusyMs(sample);
  }

  function setMsArc(name, ms, scale, noteText) {
    var arc = root.querySelector('[data-arc="' + name + '"]');
    var value = root.querySelector('[data-value="' + name + '"]');
    var note = root.querySelector('[data-note="' + name + '"]');
    var unit = value && value.parentElement ? value.parentElement.querySelector(".st-unit") : null;
    if (arc) {
      if (ms == null) {
        arc.setAttribute("stroke-dasharray", "0 " + CIRC.toFixed(1));
        arc.setAttribute("stroke-opacity", "0");
      } else {
        var frac = scale > 0 ? Math.max(0, Math.min(1, ms / scale)) : 0;
        var len = frac * CIRC;
        arc.setAttribute("stroke-dasharray", len.toFixed(1) + " " + CIRC.toFixed(1));
        arc.setAttribute("stroke-opacity", frac > 0 ? "1" : "0");
      }
    }
    if (value) {
      value.textContent = ms == null ? "Waiting" : String(ms);
      value.classList.toggle("is-word", ms == null);
    }
    if (unit) unit.hidden = ms == null;
    if (note && noteText) note.textContent = noteText;
  }

  function setScaleNote(name, scale, plan) {
    var el = root.querySelector('[data-scale="' + name + '"]');
    if (!el) return;
    var top = Math.round(scale);
    var onPlan = plan && scale <= plan * THRESHOLDS.planScale + 0.001;
    el.textContent = onPlan
      ? "Scale 0 to " + top + " Mbps, about 1.25 times the plan you entered."
      : "Scale 0 to " + top + " Mbps. It follows this reading.";
  }

  function paint(sample) {
    var planDown = planNumber(downInput);
    var planUp = planNumber(upInput);
    scaleDown = growScale(scaleDown, sample.downloadMbps, planDown);
    scaleUp = growScale(scaleUp, sample.uploadMbps, planUp);
    setArc("down", sample.downloadMbps, scaleDown);
    setArc("up", sample.uploadMbps, scaleUp);
    setScaleNote("down", scaleDown, planDown);
    setScaleNote("up", scaleUp, planUp);
    setMsArc("ping", sample.pingMs, 100, ratePing(sample.pingMs));
    setMsArc("jitter", sample.jitterMs, 30, rateJitter(sample.jitterMs));
    setMsArc("busy", busyMs(sample), 150, rateBusy(sample));
    var lossValue = root.querySelector('[data-value="loss"]');
    var lossNote = root.querySelector('[data-note="loss"]');
    if (lossValue) {
      lossValue.textContent = "Not measured";
      lossValue.classList.add("is-word");
    }
    if (lossNote) lossNote.textContent = "Not measured on this test.";
    paintUses(sample);
    if (signal) signal.sample(sample);
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
    if (signal) signal.phase(phase);
  }

  function bringResult() {
    if (!resultCard) return;
    var rect = resultCard.getBoundingClientRect();
    var off = rect.top < 8 || rect.top > window.innerHeight - 80;
    if (!off) return;
    resultCard.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    resultCard.focus({ preventScroll: true });
  }

  function revealResult() {
    if (!resultCard) return;
    var first = !resultCard.classList.contains("is-ready");
    resultCard.classList.add("is-ready");
    var grow = resultCard.querySelector("[data-result-grow]");
    if (grow) {
      grow.removeAttribute("aria-hidden");
      grow.inert = false;
    }
    if (reduce || !first) bringResult();
    else window.setTimeout(bringResult, 220);
  }

  function resetMeters(opts) {
    var keep = opts && opts.keepResult && resultCard && resultCard.classList.contains("is-ready");
    scaleDown = growScale(100, null, planNumber(downInput));
    scaleUp = growScale(25, null, planNumber(upInput));
    paint({
      downloadMbps: null,
      uploadMbps: null,
      pingMs: null,
      jitterMs: null,
      loadedDownMs: null,
      loadedUpMs: null,
      loss: null
    });
    if (keep) return;
    revealed = false;
    paintShortfall(null);
    if (headlineEl) {
      headlineEl.textContent = "";
      headlineEl.hidden = true;
    }
    if (outcomeEl) {
      outcomeEl.textContent = "";
      outcomeEl.hidden = true;
    }
    showBranch("none");
  }

  function paintShortfall(sample) {
    var report = sample
      ? shortfallReport(sample, plansEntered())
      : { show: false, planLine: "", vary: "" };
    if (shortPlanEl) {
      shortPlanEl.textContent = report.planLine;
      shortPlanEl.hidden = !report.planLine;
    }
    if (varyEl) {
      varyEl.textContent = report.show ? SHORTFALL_COPY.vary : "";
      varyEl.hidden = !report.show;
    }
    if (shortfallEl) shortfallEl.hidden = !report.show;
    return report;
  }

  function chooseOutcome(sample, report) {
    if (sample.downloadMbps == null && sample.uploadMbps == null) {
      unclearRuns += 1;
      return {
        kind: "unclear",
        head: LINES.unclearHead,
        line: unclearRuns >= 2 ? LINES.unclearAgain : LINES.unclear
      };
    }
    unclearRuns = 0;
    if (report && report.show) return { kind: "below", head: LINES.belowHead, line: LINES.below };
    var busy = busyMs(sample);
    if (sample.pingMs != null && busy != null && busy > sample.pingMs + THRESHOLDS.busyGapMs) {
      return { kind: "mixed", head: LINES.mixedHead, line: LINES.busy };
    }
    if (sample.jitterMs != null && sample.jitterMs >= THRESHOLDS.outcomeJitterMs) {
      return { kind: "mixed", head: LINES.mixedHead, line: LINES.jitter };
    }
    if (sample.pingMs != null && sample.pingMs > THRESHOLDS.pingFineMs) {
      return { kind: "mixed", head: LINES.mixedHead, line: "A call may notice the delay in this snapshot." };
    }
    if (sample.pingMs != null && sample.jitterMs != null && !(sample.pingMs <= THRESHOLDS.callsPingMs && sample.jitterMs <= THRESHOLDS.callsJitterMs)) {
      return { kind: "mixed", head: LINES.mixedHead, line: "A call may notice the delay in this snapshot." };
    }
    if (sample.pingMs != null && sample.jitterMs != null && !(sample.pingMs <= THRESHOLDS.gamingPingMs && sample.jitterMs <= THRESHOLDS.gamingJitterMs)) {
      return { kind: "mixed", head: LINES.mixedHead, line: "A game may feel the delay in this snapshot." };
    }
    if (sample.downloadMbps != null && sample.downloadMbps < THRESHOLDS.streamStepMbps) {
      return { kind: "mixed", head: LINES.mixedHead, line: "A stream may pause on this snapshot." };
    }
    if (sample.downloadMbps != null && sample.downloadMbps < THRESHOLDS.streamHighMbps) {
      return { kind: "mixed", head: LINES.mixedHead, line: "A stream may step down in quality on this snapshot." };
    }
    return { kind: "good", head: LINES.goodHead, line: LINES.good };
  }

  function appVariant() {
    return document.documentElement.getAttribute("data-st-variant") === "app";
  }

  function plansEntered() {
    return { down: planNumber(downInput), up: planNumber(upInput) };
  }

  function hookKind(sample, outcomeKind) {
    if (!appVariant()) return "none";
    if (isPoorResult(sample, plansEntered())) return "poor";
    if (outcomeKind === "good") return "good";
    return "none";
  }

  function showBranch(kind) {
    var show = appVariant() && (kind === "poor" || kind === "good");
    if (appBlock && appAnchor && appBlock.parentNode !== appAnchor) appAnchor.appendChild(appBlock);
    if (branchEl) {
      if (!show) {
        branchEl.hidden = true;
        branchEl.removeAttribute("data-branch-kind");
        if (branchMore) branchMore.hidden = true;
      } else {
        branchEl.hidden = false;
        branchEl.setAttribute("data-branch-kind", kind);
        if (branchHead) branchHead.textContent = kind === "poor" ? BRANCH_COPY.poorHead : BRANCH_COPY.goodHead;
        if (branchBody) branchBody.textContent = kind === "poor" ? BRANCH_COPY.poorBody : BRANCH_COPY.goodBody;
        if (branchLink) branchLink.textContent = BRANCH_COPY.poorLink;
        if (branchMore) branchMore.hidden = true;
      }
    }
    syncNudge();
    syncDownload();
  }

  function branchOpen() {
    return appVariant() && branchEl && !branchEl.hidden;
  }

  function syncNudge() {
    if (!snapshotEl) return;
    snapshotEl.textContent = LINES.snapshot;
    snapshotEl.hidden = !revealed || branchOpen();
  }

  function syncDownload() {
    if (appBlock && appAnchor && appBlock.parentNode !== appAnchor) appAnchor.appendChild(appBlock);
    if (appAnchor) appAnchor.hidden = !revealed;
    if (appBlock) appBlock.hidden = false;
  }

  function paintReading(sample) {
    paint(sample);
    var report = paintShortfall(sample);
    var chosen = chooseOutcome(sample, report);
    if (headlineEl) {
      headlineEl.textContent = chosen.head;
      headlineEl.hidden = !chosen.head;
    }
    if (outcomeEl) {
      outcomeEl.textContent = chosen.line;
      outcomeEl.hidden = !chosen.line;
    }
    return chosen;
  }

  function previewAlias() {
    var host = String(location.hostname || "").toLowerCase();
    var previewHosts = ["preview-web-speedtest.honestping.pages.dev"];
    return previewHosts.indexOf(host) !== -1;
  }

  function hooksForRealResults() {
    return BRANCH_HOOKS_ENABLED === true || previewAlias();
  }

  function previewQuery() {
    var host = String(location.hostname || "").toLowerCase();
    var preview = host === "localhost" || host === "127.0.0.1" || previewAlias();
    if (!preview) return null;
    try { return new URLSearchParams(location.search); } catch (e) { return null; }
  }

  function previewDemo() {
    var q = previewQuery();
    if (!q) return "";
    var demo = q.get("demo") || "";
    if (demo === "poor" || demo === "good" || demo === "short" || demo === "meet") return demo;
    return "";
  }

  function cleanPlan(value) {
    return String(value == null ? "" : value).replace(/[^0-9.]/g, "").slice(0, 8);
  }

  function applyPreviewPlan() {
    var q = previewQuery();
    if (!q) return;
    var demo = q.get("demo") || "";
    var down = q.get("planDown");
    var up = q.get("planUp");
    if ((demo === "short" || demo === "meet") && !down) down = "300";
    if ((demo === "short" || demo === "meet") && !up) up = "30";
    down = cleanPlan(down);
    up = cleanPlan(up);
    if (!down && !up) return;
    if (down) downInput.value = down;
    if (up) upInput.value = up;
    remember.checked = false;
  }

  function poorSample() {
    var plans = plansEntered();
    if (plans.down != null || plans.up != null) {
      return {
        downloadMbps: plans.down != null ? plans.down * 0.4 : 80,
        uploadMbps: plans.up != null ? plans.up * 0.4 : 20,
        pingMs: 22,
        jitterMs: 3,
        loadedDownMs: 28,
        loadedUpMs: 24
      };
    }
    return {
      downloadMbps: 80,
      uploadMbps: 20,
      pingMs: 24,
      jitterMs: 4,
      loadedDownMs: 120,
      loadedUpMs: 30
    };
  }

  function goodSample() {
    var plans = plansEntered();
    return {
      downloadMbps: plans.down != null ? plans.down : 150,
      uploadMbps: plans.up != null ? plans.up : 30,
      pingMs: 18,
      jitterMs: 3,
      loadedDownMs: 24,
      loadedUpMs: 22
    };
  }

  function ratioSample(ratio) {
    var plans = plansEntered();
    var down = plans.down != null ? plans.down : 300;
    var up = plans.up != null ? plans.up : 30;
    return {
      downloadMbps: down * ratio,
      uploadMbps: up * ratio,
      pingMs: 18,
      jitterMs: 3,
      loadedDownMs: 22,
      loadedUpMs: 20
    };
  }

  function runDemo(which) {
    if ((which === "poor" || which === "good") && !appVariant()) return;
    var sample = which === "poor" ? poorSample() : which === "short" ? ratioSample(0.7) : which === "meet" ? ratioSample(1) : goodSample();
    startBtn.disabled = false;
    startBtn.textContent = "Run it again";
    setPhase("done");
    revealed = true;
    paintReading(sample);
    if (which === "poor" || which === "good") showBranch(which);
    else showBranch("none");
    revealResult();
  }

  function finish(sample) {
    running = false;
    cancel = null;
    startBtn.disabled = false;
    startBtn.textContent = "Run it again";
    setPhase("done");
    revealed = true;
    var chosen = paintReading(sample);
    var kind = hooksForRealResults() ? hookKind(sample, chosen.kind) : "none";
    showBranch(kind);
    revealResult();
    count("test_completed");
  }

  function start() {
    if (running) return;
    if (cancel) cancel();
    running = true;
    resetMeters({ keepResult: true });
    startBtn.disabled = true;
    startBtn.textContent = "Running";
    setPhase("latency");
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
    el.addEventListener("click", function () {
      if (branchOpen()) count("cta_clicked", { hook: true });
      else count("cta_clicked");
    });
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
  if (snapshotEl) snapshotEl.textContent = LINES.snapshot;
  if (varyEl) varyEl.textContent = SHORTFALL_COPY.vary;
  loadPlan();
  applyPreviewPlan();
  resetMeters();
  setPhase("idle");
  var demo = previewDemo();
  if (demo) runDemo(demo);
})();
