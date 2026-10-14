/* Swappable speed test engine.
   The active engine is the MIT module in ./vendor/speedtest.js.
   Result logging is off: logMeasurementApiUrl and logAimApiUrl are null,
   and the library returns before any results post when those are empty.
   Packet loss is not in the measurement list, so no relay is used.
   A different engine can replace createEngine() if it keeps start(onUpdate, onDone). */
import SpeedTest from "./vendor/speedtest.js";

var MEASUREMENTS = [
  { type: "latency", numPackets: 10 },
  { type: "download", bytes: 1e5, count: 8, bypassMinDuration: true },
  { type: "download", bytes: 1e6, count: 4 },
  { type: "upload", bytes: 1e5, count: 6 },
  { type: "upload", bytes: 1e6, count: 3 }
];

function mbps(bps) {
  if (bps == null || !isFinite(bps)) return null;
  return bps / 1e6;
}

function whole(ms) {
  if (ms == null || !isFinite(ms)) return null;
  return Math.round(ms);
}

function read(engine, phase) {
  var results = engine.results;
  var jitter = results.getUnloadedJitter();
  return {
    phase: phase,
    downloadMbps: mbps(results.getDownloadBandwidth()),
    uploadMbps: mbps(results.getUploadBandwidth()),
    pingMs: whole(results.getUnloadedLatency()),
    jitterMs: whole(jitter),
    loadedDownMs: whole(results.getDownLoadedLatency()),
    loadedUpMs: whole(results.getUpLoadedLatency()),
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
      engine.onFinish = function () {
        finish();
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
