import fs from "node:fs";
import path from "node:path";
import { BRANCH_HOOKS_ENABLED, THRESHOLDS, HOOK_THRESHOLDS, ratePing, rateJitter, rateBusy, useLine, isPoorResult } from "../test/speedtest-config.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const page = fs.readFileSync(path.join(root, "test", "speedtest-page.js"), "utf8");
var problems = [];

function check(cond, message) {
  if (!cond) problems.push(message);
}

function fnFrom(src, name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("no fn " + name);
  let d = 0;
  const j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error("unclosed " + name);
}

check(BRANCH_HOOKS_ENABLED === false, "production flag stays off");
check(HOOK_THRESHOLDS === THRESHOLDS, "hook thresholds are the same config");
check(THRESHOLDS.planRatio === 0.5 && THRESHOLDS.loadedLatencyMs === 100 && THRESHOLDS.busyGapMs === 20 && THRESHOLDS.jitterMs === 30, "poor hook cutoffs stay locked");
check(THRESHOLDS.outcomeJitterMs === 15, "mixed headline starts when jitter is uneven");
check(THRESHOLDS.pingFineMs === 40, "fine ping includes 40 and noticeable starts at 41");
check(THRESHOLDS.planScale === 1.25, "plan scale stays 1.25");

check(isPoorResult({ downloadMbps: 50, uploadMbps: 20, pingMs: 20, jitterMs: 3, loadedDownMs: 25 }, { down: 100, up: null }) === false, "exactly half the plan is not poor");
check(isPoorResult({ downloadMbps: 49.99, uploadMbps: 20, pingMs: 20, jitterMs: 3, loadedDownMs: 25 }, { down: 100, up: null }) === true, "just under half the plan is poor");

check(ratePing(null) === "Waiting", "ping waits without a measurement");
check(ratePing(19.9) === "Low", "ping just under low");
check(ratePing(20) === "Fine for most uses", "ping at the low cutoff");
check(ratePing(40) === "Fine for most uses", "ping at 40 stays fine");
check(ratePing(41) === "Noticeable", "ping at 41 is noticeable");
check(ratePing(99.9) === "Noticeable", "ping just under high");
check(ratePing(100) === "High for live calls and games", "ping at the high cutoff");

check(rateJitter(null) === "Waiting", "jitter waits without a measurement");
check(rateJitter(4.9) === "Steady", "jitter just under steady");
check(rateJitter(5) === "Some variation", "jitter at the steady cutoff");
check(rateJitter(14.9) === "Some variation", "jitter just under uneven");
check(rateJitter(15) === "Uneven", "jitter at the uneven cutoff");

check(rateBusy({ pingMs: null, loadedDownMs: 80 }) === "Shows up while download or upload is running.", "busy rating needs an idle ping");
check(rateBusy({ pingMs: 20, loadedDownMs: null, loadedUpMs: null }) === "Shows up while download or upload is running.", "busy rating needs a loaded reading");
check(rateBusy({ pingMs: 20, loadedDownMs: 40, loadedUpMs: 30 }) === "Close to the idle ping", "busy at the gap stays close");
check(rateBusy({ pingMs: 20, loadedUpMs: 40.1 }) === "Higher while the line is busy", "busy just over the gap");

var calm = { pingMs: 40, jitterMs: 10, downloadMbps: 25 };
check(useLine("calls", calm) === "Looks calm enough for a call in this snapshot.", "calls at the cutoff");
check(useLine("calls", { pingMs: 40.1, jitterMs: 10 }) === "A call may notice the delay in this snapshot.", "calls just over ping");
check(useLine("calls", { pingMs: 40, jitterMs: null }) === "Not measured", "calls with no jitter are not measured");
check(useLine("calls", { pingMs: null, jitterMs: 2 }) === "Not measured", "calls with no ping are not measured");
check(useLine("gaming", { pingMs: 35, jitterMs: null }) === "Not measured", "gaming with no jitter is not measured");
check(useLine("streaming", { pingMs: null, jitterMs: null, downloadMbps: 30 }) === "This snapshot has room for a high quality stream.", "a stream hint follows the download reading");
check(useLine("gaming", { pingMs: 35, jitterMs: 8 }) === "Looks playable in this snapshot.", "gaming at the cutoff");
check(useLine("gaming", { pingMs: 35, jitterMs: 8.1 }) === "A game may feel the delay in this snapshot.", "gaming just over jitter");
check(useLine("streaming", calm) === "This snapshot has room for a high quality stream.", "stream at the high cutoff");
check(useLine("streaming", { pingMs: 20, jitterMs: 2, downloadMbps: 4.9 }) === "A stream may pause on this snapshot.", "stream just under the step cutoff");

const growScale = new Function("THRESHOLDS", fnFrom(page, "growScale") + ";return growScale")(THRESHOLDS);
check(growScale(100, 80, 100) === 125, "reading at or below plan x1.25 keeps that scale");
check(growScale(100, 2140, 100) >= 2140, "a 2140 reading on a 100 plan follows the reading");
check(growScale(25, 695, 10) >= 695, "a 695 reading on a 10 plan follows the reading");
check(page.includes("preview-web-speedtest.honestping.pages.dev"), "preview hooks name the preview host");
check(!/return\s*\/\\.pages\\.dev\$\/\.test\(/.test(page), "preview hooks do not match every pages host");

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
