/* Swappable speed test engine.
   Recommended default: the MIT module @cloudflare/speedtest.
   That module is not loaded here. The engine choice is still open, and
   packet loss is not built. create() returns the stand-in so this page
   contacts no test servers and spends nothing.
   A later adapter should keep start(onUpdate, onDone) and the sample shape:
   downloadMbps, uploadMbps, pingMs, jitterMs, loadedDownMs, loadedUpMs, loss.
   Download and upload are separate fields. Loss stays null until it exists. */
(function (root) {
  var RECOMMENDED = "cloudflare-speedtest";

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function createMock() {
    var timer = 0;
    var stopped = false;
    return {
      name: "mock",
      measuresLoss: false,
      start: function (onUpdate, onDone) {
        stopped = false;
        clearTimeout(timer);
        var downFinal = 90 + Math.random() * 380;
        var upFinal = 6 + Math.random() * 48;
        if (Math.abs(upFinal - downFinal) < 5) upFinal += 17;
        var ping = Math.round(8 + Math.random() * 36);
        var jitter = Math.round(1 + Math.random() * 14);
        var loadedDown = ping + Math.round(4 + Math.random() * 70);
        var loadedUp = ping + Math.round(2 + Math.random() * 40);
        var t0 = Date.now();
        var duration = 8000;

        function sampleAt(t) {
          var downPhase = clamp((t - 0.08) / 0.44, 0, 1);
          var upPhase = clamp((t - 0.54) / 0.40, 0, 1);
          var downEase = 1 - Math.pow(1 - downPhase, 2);
          var upEase = 1 - Math.pow(1 - upPhase, 2);
          var downNoise = downPhase > 0 && downPhase < 1 ? 0.94 + Math.random() * 0.08 : 1;
          var upNoise = upPhase > 0 && upPhase < 1 ? 0.92 + Math.random() * 0.1 : 1;
          var phase = "latency";
          if (t >= 1) phase = "done";
          else if (upPhase > 0) phase = "upload";
          else if (downPhase > 0) phase = "download";
          return {
            phase: phase,
            downloadMbps: downPhase > 0 ? downFinal * downEase * downNoise : null,
            uploadMbps: upPhase > 0 ? upFinal * upEase * upNoise : null,
            pingMs: t > 0.04 ? ping : null,
            jitterMs: t > 0.04 ? jitter : null,
            loadedDownMs: downPhase > 0.25 ? loadedDown : null,
            loadedUpMs: upPhase > 0.25 ? loadedUp : null,
            loss: null
          };
        }

        function frame() {
          if (stopped) return;
          var t = (Date.now() - t0) / duration;
          var sample = sampleAt(Math.min(t, 1));
          if (t >= 1) {
            sample.phase = "done";
            sample.downloadMbps = downFinal;
            sample.uploadMbps = upFinal;
            onUpdate(sample);
            onDone(sample);
            return;
          }
          onUpdate(sample);
          timer = setTimeout(frame, 140);
        }

        timer = setTimeout(frame, 60);
        return function cancel() {
          stopped = true;
          clearTimeout(timer);
        };
      }
    };
  }

  function create(kind) {
    if (kind && kind !== "mock" && kind !== RECOMMENDED) {
      throw new Error("Unknown speed test engine");
    }
    var engine = createMock();
    engine.requested = kind || RECOMMENDED;
    engine.active = "mock";
    return engine;
  }

  root.HonestPingSpeedEngine = {
    recommended: RECOMMENDED,
    create: create
  };
})(window);
