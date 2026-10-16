/* Plan comparison for one test. Pure: no DOM, no storage, no network.
   A direction counts only when a positive plan speed was entered and that
   measurement came back strictly below it. Meeting the plan adds nothing. */

export var SHORTFALL_COPY = {
  both: "About {n}% of your plan's download and {m}% of its upload on this test.",
  download: "About {n}% of your plan's download on this test.",
  upload: "About {n}% of your plan's upload on this test.",
  vary: "Speeds vary with Wi-Fi, devices and time of day, and plans usually promise speeds 'up to' a number."
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
  var empty = { show: false, planLine: "", vary: "" };
  if (!sample || !plans) return empty;
  var downShort = positive(plans.down) && measured(sample.downloadMbps) && sample.downloadMbps < plans.down;
  var upShort = positive(plans.up) && measured(sample.uploadMbps) && sample.uploadMbps < plans.up;
  if (!downShort && !upShort) return empty;
  var planLine = "";
  if (downShort && upShort) {
    planLine = SHORTFALL_COPY.both
      .replace("{n}", String(aboutPercent(sample.downloadMbps, plans.down)))
      .replace("{m}", String(aboutPercent(sample.uploadMbps, plans.up)));
  } else if (downShort) {
    planLine = fill(SHORTFALL_COPY.download, aboutPercent(sample.downloadMbps, plans.down));
  } else {
    planLine = fill(SHORTFALL_COPY.upload, aboutPercent(sample.uploadMbps, plans.up));
  }
  return {
    show: true,
    planLine: planLine,
    vary: SHORTFALL_COPY.vary
  };
}
