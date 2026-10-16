/* Production config for the poor and good branch hooks.
   BRANCH_HOOKS_ENABLED stays false until the app's background checking ships.
   A real measured result opens the matching panel only on an allowlisted
   preview host. honestping.com and other hosts do not.
   ?demo=poor and ?demo=good force one branch on that preview host, or on
   localhost, for review.

   Poor uses measured values only. Thresholds:
   - planRatio 0.5: when a plan speed was entered, that direction is poor only if
     its measured Mbps is below half the entered plan. Exactly half is not poor.
     A missing measurement is not compared. Latency and jitter do not make a
     plan result poor.
   - No plan entered: jitterMs 30, measured jitter at or above 30 ms is poor.
   - No plan entered: loadedLatencyMs 100, and busyGapMs 20. Loaded ping is poor
     only when the higher loaded reading is at or above 100 ms and also more
     than 20 ms above the idle ping, so the outcome line stays the busy line.
   - If download and upload are both missing, the result stays unclear. No hook.

   A result that is not poor and not the approved good outcome stays on the
   current flow. Good means nothing negative is on the page: not under an
   entered plan, loaded ping not more than busyGapMs above idle, jitter under
   outcomeJitterMs, and no negative rating or hint.
*/

export var BRANCH_HOOKS_ENABLED = false;

/* One locked set. A rating word is chosen only from a measured value and
   one of these cutoffs. Hook jitter (30) and the mixed-result jitter (15)
   are different cutoffs, both listed here. */
export var THRESHOLDS = {
  planRatio: 0.5,
  loadedLatencyMs: 100,
  busyGapMs: 20,
  jitterMs: 30,
  outcomeJitterMs: 15,
  planScale: 1.25,
  pingLowMs: 20,
  pingFineMs: 40,
  pingNoticeableMs: 100,
  jitterSteadyMs: 5,
  jitterSomeMs: 15,
  callsPingMs: 40,
  callsJitterMs: 10,
  gamingPingMs: 35,
  gamingJitterMs: 8,
  streamHighMbps: 25,
  streamStepMbps: 5
};

export var HOOK_THRESHOLDS = THRESHOLDS;

export function ratePing(ms) {
  if (ms == null) return "Waiting";
  if (ms < THRESHOLDS.pingLowMs) return "Low";
  if (ms <= THRESHOLDS.pingFineMs) return "Fine for most uses";
  if (ms < THRESHOLDS.pingNoticeableMs) return "Noticeable";
  return "High for live calls and games";
}

export function rateJitter(ms) {
  if (ms == null) return "Waiting";
  if (ms < THRESHOLDS.jitterSteadyMs) return "Steady";
  if (ms < THRESHOLDS.jitterSomeMs) return "Some variation";
  return "Uneven";
}

export function loadedBusyMs(sample) {
  var vals = [sample && sample.loadedDownMs, sample && sample.loadedUpMs].filter(function (n) { return n != null; });
  if (!vals.length) return null;
  return Math.max.apply(null, vals);
}

export function rateBusy(sample) {
  var busy = loadedBusyMs(sample);
  if (busy == null || !sample || sample.pingMs == null) return "Shows up while download or upload is running.";
  if (busy > sample.pingMs + THRESHOLDS.busyGapMs) return "Higher while the line is busy";
  return "Close to the idle ping";
}

export function useLine(kind, sample) {
  if (kind === "calls" || kind === "gaming") {
    if (!sample || sample.pingMs == null || sample.jitterMs == null) return "Not measured";
    if (kind === "calls") {
      return sample.pingMs <= THRESHOLDS.callsPingMs && sample.jitterMs <= THRESHOLDS.callsJitterMs
        ? "Looks calm enough for a call in this snapshot."
        : "A call may notice the delay in this snapshot.";
    }
    return sample.pingMs <= THRESHOLDS.gamingPingMs && sample.jitterMs <= THRESHOLDS.gamingJitterMs
      ? "Looks playable in this snapshot."
      : "A game may feel the delay in this snapshot.";
  }
  if (!sample || sample.downloadMbps == null) return "Waiting for the download reading.";
  if (sample.downloadMbps >= THRESHOLDS.streamHighMbps) return "This snapshot has room for a high quality stream.";
  if (sample.downloadMbps >= THRESHOLDS.streamStepMbps) return "A stream may step down in quality on this snapshot.";
  return "A stream may pause on this snapshot.";
}

export var BRANCH_COPY = {
  poorHead: "Want to know if this keeps happening?",
  poorBody: "One test is a snapshot. The free HonestPing app keeps checking your connection in the background while it's open and saves the results on your PC, so you can see when the rough patches happen, including evenings.",
  poorLink: "Want the whole week in one place? A 7-day Pro report tests mornings, afternoons and evenings while HonestPing is open, and gives you a report you can share with your provider. Pro and the report are paid. The app is free.",
  goodHead: "Your connection did well on this test.",
  goodBody: "One good test is a snapshot. Connections can change, especially in the evening. The free HonestPing app keeps checking in the background while it's open and saves the results on your PC, so you can see how your plan holds up over time."
};

export function isPoorResult(sample, plans) {
  if (!sample || (sample.downloadMbps == null && sample.uploadMbps == null)) return false;
  var planDown = plans && plans.down != null ? plans.down : null;
  var planUp = plans && plans.up != null ? plans.up : null;
  if (planDown != null || planUp != null) {
    if (planDown != null && sample.downloadMbps != null && sample.downloadMbps < planDown * THRESHOLDS.planRatio) return true;
    if (planUp != null && sample.uploadMbps != null && sample.uploadMbps < planUp * THRESHOLDS.planRatio) return true;
    return false;
  }
  var loaded = loadedBusyMs(sample);
  var rose = sample.pingMs != null && loaded != null && loaded > sample.pingMs + THRESHOLDS.busyGapMs;
  if (loaded != null && loaded >= THRESHOLDS.loadedLatencyMs && rose) return true;
  if (sample.jitterMs != null && sample.jitterMs >= THRESHOLDS.jitterMs) return true;
  return false;
}
