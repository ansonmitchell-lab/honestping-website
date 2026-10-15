/* Plan comparison for one test. Pure: no DOM, no storage, no network.
   A direction counts only when a positive plan speed was entered and that
   measurement came back strictly below it. Meeting the plan adds nothing. */

export var SHORTFALL_COPY = {
  download: "About {n}% of your plan's download speed in this test.",
  upload: "About {n}% of your plan's upload speed in this test.",
  calm: "You may not be getting the speed you pay for.",
  vary: "Speeds vary with Wi-Fi, devices and time of day, and plans usually promise speeds up to a number."
};

function positive(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function measured(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function aboutPercent(value, plan) {
  var raw = Math.round((value / plan) * 100);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  if (raw > 99) return 99;
  return raw;
}

function fill(template, n) {
  return template.replace("{n}", String(n));
}

export function shortfallReport(sample, plans) {
  var empty = { show: false, downloadLine: "", uploadLine: "", calm: "", vary: "" };
  if (!sample || !plans) return empty;
  var downloadLine = "";
  var uploadLine = "";
  if (positive(plans.down) && measured(sample.downloadMbps) && sample.downloadMbps < plans.down) {
    downloadLine = fill(SHORTFALL_COPY.download, aboutPercent(sample.downloadMbps, plans.down));
  }
  if (positive(plans.up) && measured(sample.uploadMbps) && sample.uploadMbps < plans.up) {
    uploadLine = fill(SHORTFALL_COPY.upload, aboutPercent(sample.uploadMbps, plans.up));
  }
  if (!downloadLine && !uploadLine) return empty;
  return {
    show: true,
    downloadLine: downloadLine,
    uploadLine: uploadLine,
    calm: SHORTFALL_COPY.calm,
    vary: SHORTFALL_COPY.vary
  };
}
