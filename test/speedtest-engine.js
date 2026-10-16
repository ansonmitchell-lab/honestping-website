/* Swappable speed test engine.
   The active engine is the MIT module in ./vendor/speedtest.js.
   Result logging is off: logMeasurementApiUrl and logAimApiUrl are null,
   and the library returns before any results post when those are empty.
   Packet loss is not in the measurement list, so no relay is used.
   A different engine can replace createEngine() if it keeps start(onUpdate, onDone). */
import SpeedTest from "./vendor/speedtest.js";

/* Loaded ping only counts a transfer that lasts at least 250 ms.
   Later rounds run only while the shortest request in a round is still under one second. */
var MEASUREMENTS = [
  { type: "latency", numPackets: 10 },
  { type: "download", bytes: 1e5, count: 8, bypassMinDuration: true },
  { type: "download", bytes: 1e6, count: 4 },
  { type: "download", bytes: 1e7, count: 6 },
  { type: "download", bytes: 25e6, count: 4 },
  { type: "download", bytes: 1e8, count: 3 },
  { type: "upload", bytes: 1e5, count: 6 },
  { type: "upload", bytes: 1e6, count: 3 },
  { type: "upload", bytes: 1e7, count: 4 },
  { type: "upload", bytes: 25e6, count: 3 }
];

function mbps(bps) {
  if (bps == null || !isFinite(bps)) return null;
  return bps / 1e6;
}

function whole(ms) {
  if (ms == null || !isFinite(ms)) return null;
  if (ms > 0 && ms < 10) return Math.round(ms * 10) / 10;
  return Math.round(ms);
}

function loadedReading(engine, pointsName, valueName) {
  var points = engine.results[pointsName]();
  if (!points || !points.length) return null;
  return whole(engine.results[valueName]());
}

var PLAN = { latency: 0, download: 0, upload: 0 };
for (var mi = 0; mi < MEASUREMENTS.length; mi++) {
  var planned = MEASUREMENTS[mi];
  if (planned.type === "latency" || planned.type === "latencyUnderLoad") PLAN.latency += planned.numPackets || 1;
  else if (planned.type === "download") PLAN.download += planned.count || 1;
  else if (planned.type === "upload") PLAN.upload += planned.count || 1;
}
/* The last slice is the snapshot built from the finished measurements. */
var BUILD_UNITS = 4;

function unitsDone(engine, type) {
  var raw = engine.results && engine.results.raw;
  var entry = raw && raw[type];
  var planned = PLAN[type] || 0;
  if (!entry || !entry.started) return 0;
  if (entry.finished) return planned;
  var results = entry.results || {};
  var n = 0;
  if (type === "latency") {
    n = results.timings && results.timings.length ? results.timings.length : 0;
  } else {
    for (var key in results) {
      if (Object.prototype.hasOwnProperty.call(results, key) && results[key] && results[key].timings) {
        n += results[key].timings.length;
      }
    }
  }
  if (n > planned) n = planned;
  return n;
}

function progressOf(engine, includeBuild) {
  var done = unitsDone(engine, "latency") + unitsDone(engine, "download") + unitsDone(engine, "upload");
  var total = PLAN.latency + PLAN.download + PLAN.upload + BUILD_UNITS;
  if (includeBuild) done += BUILD_UNITS;
  if (total <= 0) return 0;
  var pct = Math.round((100 * done) / total);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

function read(engine, phase) {
  var results = engine.results;
  var jitter = results.getUnloadedJitter();
  return {
    phase: phase,
    progress: progressOf(engine, phase === "done"),
    downloadMbps: mbps(results.getDownloadBandwidth()),
    uploadMbps: mbps(results.getUploadBandwidth()),
    pingMs: whole(results.getUnloadedLatency()),
    jitterMs: whole(jitter),
    loadedDownMs: loadedReading(engine, "getDownLoadedLatencyPoints", "getDownLoadedLatency"),
    loadedUpMs: loadedReading(engine, "getUpLoadedLatencyPoints", "getUpLoadedLatency"),
    loss: null
  };
}

export function createEngine() {
  return {
    name: "cloudflare-speedtest",
    measuresLoss: false,
    logging: { logMeasurementApiUrl: null, logAimApiUrl: null },
    start: function (onUpdate, onDone) {
      var engine = new SpeedTest({
        autoStart: false,
        logMeasurementApiUrl: null,
        logAimApiUrl: null,
        measurements: MEASUREMENTS,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true
      });
      var phase = "latency";
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        var sample = read(engine, "done");
        onUpdate(sample);
        onDone(sample);
      }
      engine.onResultsChange = function (info) {
        if (info && info.type) phase = info.type;
        onUpdate(read(engine, phase));
      };
      function paintFrame(fn) {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(fn);
        else fn();
      }
      engine.onFinish = function () {
        if (settled) return;
        settled = true;
        var building = read(engine, "building");
        onUpdate(building);
        paintFrame(function () {
          var sample = read(engine, "done");
          onUpdate(sample);
          onDone(sample);
        });
      };
      engine.onError = function () {
        finish();
      };
      try {
        engine.play();
      } catch (e) {
        finish();
      }
      return function cancel() {
        try { engine.pause(); } catch (e) {}
      };
    }
  };
}
