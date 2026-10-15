import { THRESHOLDS, HOOK_THRESHOLDS, ratePing, rateJitter, rateBusy, useLine } from "../test/speedtest-config.js";

var problems = [];

function check(cond, message) {
  if (!cond) problems.push(message);
}

check(HOOK_THRESHOLDS === THRESHOLDS, "hook thresholds are the same config");
check(THRESHOLDS.planScale === 1.25, "plan scale stays 1.25");

check(ratePing(null) === "Waiting", "ping waits without a measurement");
check(ratePing(19.9) === "Low", "ping just under low");
check(ratePing(20) === "Fine for most uses", "ping at the low cutoff");
check(ratePing(49.9) === "Fine for most uses", "ping just under fine");
check(ratePing(50) === "Noticeable", "ping at the fine cutoff");
check(ratePing(99.9) === "Noticeable", "ping just under noticeable");
check(ratePing(100) === "High for live calls and games", "ping at the noticeable cutoff");

check(rateJitter(null) === "Waiting", "jitter waits without a measurement");
check(rateJitter(4.9) === "Steady", "jitter just under steady");
check(rateJitter(5) === "Some variation", "jitter at the steady cutoff");
check(rateJitter(14.9) === "Some variation", "jitter just under some");
check(rateJitter(15) === "Uneven", "jitter at the some cutoff");

check(rateBusy({ pingMs: null, loadedDownMs: 80 }) === "Shows up while download or upload is running.", "busy rating needs an idle ping");
check(rateBusy({ pingMs: 20, loadedDownMs: null, loadedUpMs: null }) === "Shows up while download or upload is running.", "busy rating needs a loaded reading");
check(rateBusy({ pingMs: 20, loadedDownMs: 40, loadedUpMs: 30 }) === "Close to the idle ping", "busy at the gap stays close");
check(rateBusy({ pingMs: 20, loadedUpMs: 40.1 }) === "Higher while the line is busy", "busy just over the gap");

var calm = { pingMs: 40, jitterMs: 10, downloadMbps: 25 };
check(useLine("calls", calm) === "Looks calm enough for a call in this snapshot.", "calls at the cutoff");
check(useLine("calls", { pingMs: 40.1, jitterMs: 10 }) === "A call may notice the delay in this snapshot.", "calls just over ping");
check(useLine("calls", { pingMs: 40, jitterMs: null }) === "Waiting for this snapshot.", "calls wait without jitter");
check(useLine("gaming", { pingMs: 35, jitterMs: 8 }) === "Looks playable in this snapshot.", "gaming at the cutoff");
check(useLine("gaming", { pingMs: 35, jitterMs: 8.1 }) === "A game may feel the delay in this snapshot.", "gaming just over jitter");
check(useLine("streaming", calm) === "This snapshot has room for a high quality stream.", "stream at the high cutoff");
check(useLine("streaming", { pingMs: 20, jitterMs: 2, downloadMbps: 24.9 }) === "A stream may step down in quality on this snapshot.", "stream just under high");
check(useLine("streaming", { pingMs: 20, jitterMs: 2, downloadMbps: 5 }) === "A stream may step down in quality on this snapshot.", "stream at the step cutoff");
check(useLine("streaming", { pingMs: 20, jitterMs: 2, downloadMbps: 4.9 }) === "A stream may pause on this snapshot.", "stream just under the step cutoff");
check(useLine("streaming", { pingMs: 20, jitterMs: 2, downloadMbps: null }) === "Waiting for the download reading.", "stream waits without download");

var named = ["netflix", "youtube", "zoom", "discord", "fortnite", "spotify"];
var blob = [
  useLine("calls", calm),
  useLine("calls", { pingMs: 80, jitterMs: 20 }),
  useLine("gaming", { pingMs: 80, jitterMs: 20 }),
  useLine("streaming", { pingMs: 20, jitterMs: 2, downloadMbps: 1 }),
  ratePing(200),
  rateJitter(30),
  rateBusy({ pingMs: 10, loadedDownMs: 80 })
].join(" ").toLowerCase();
named.forEach(function (name) {
  check(blob.indexOf(name) === -1, "rating names " + name);
});

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("speed test thresholds check ok");
