/* Production config for the poor and good branch hooks.
   BRANCH_HOOKS_ENABLED stays false until the app's background checking ships.
   On a *.pages.dev preview alias, a real measured result still opens the
   matching panel. honestping.com and the production pages host do not.
   ?demo=poor and ?demo=good force one branch on a preview host for review.

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
   current flow. Good means the existing outcome: not under an entered plan,
   loaded ping not more than 20 ms above idle, and jitter under 20 ms.
*/

export var BRANCH_HOOKS_ENABLED = false;

export var HOOK_THRESHOLDS = {
  planRatio: 0.5,
  loadedLatencyMs: 100,
  busyGapMs: 20,
  jitterMs: 30
};

export var BRANCH_COPY = {
  poorHead: "Want to know if this keeps happening?",
  poorBody: "One test is a snapshot. The free HonestPing app keeps checking your connection in the background while it's open and saves the results on your PC, so you can see when the rough patches happen, including evenings.",
  poorLink: "Want the whole week in one place? A 7-day Pro report tests mornings, afternoons and evenings while HonestPing is open, and gives you a report you can share with your provider. Pro and the report are paid. The app is free.",
  goodHead: "Your connection did well on this test.",
  goodBody: "One good test is a snapshot. Connections can change, especially in the evening. The free HonestPing app keeps checking in the background while it's open and saves the results on your PC, so you can see how your plan holds up over time."
};

function loadedMs(sample) {
  var vals = [sample.loadedDownMs, sample.loadedUpMs].filter(function (n) { return n != null; });
  if (!vals.length) return null;
  return Math.max.apply(null, vals);
}

export function isPoorResult(sample, plans) {
  if (!sample || (sample.downloadMbps == null && sample.uploadMbps == null)) return false;
  var planDown = plans && plans.down != null ? plans.down : null;
  var planUp = plans && plans.up != null ? plans.up : null;
  if (planDown != null || planUp != null) {
    if (planDown != null && sample.downloadMbps != null && sample.downloadMbps < planDown * HOOK_THRESHOLDS.planRatio) return true;
    if (planUp != null && sample.uploadMbps != null && sample.uploadMbps < planUp * HOOK_THRESHOLDS.planRatio) return true;
    return false;
  }
  var loaded = loadedMs(sample);
  var rose = sample.pingMs != null && loaded != null && loaded > sample.pingMs + HOOK_THRESHOLDS.busyGapMs;
  if (loaded != null && loaded >= HOOK_THRESHOLDS.loadedLatencyMs && rose) return true;
  if (sample.jitterMs != null && sample.jitterMs >= HOOK_THRESHOLDS.jitterMs) return true;
  return false;
}
