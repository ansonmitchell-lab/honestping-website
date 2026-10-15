import { shortfallReport, SHORTFALL_COPY } from "../test/speedtest-shortfall.js";

var problems = [];

function check(cond, message) {
  if (!cond) problems.push(message);
}

function joined(report) {
  return [report.planLine, report.vary].filter(Boolean).join(" ");
}

function banned(report) {
  var text = joined(report).toLowerCase();
  var words = ["verified", "certified", "official", "ripped off", "overpaying", "$", "cheaper", "switch"];
  return words.filter(function (word) { return text.includes(word); });
}

var both = shortfallReport(
  { downloadMbps: 210, uploadMbps: 12 },
  { down: 300, up: 30 }
);
check(both.show, "both directions short should show");
check(both.planLine === "About 70% of your plan's download and 40% of its upload on this test.", "plan line: " + both.planLine);
check(joined(both).indexOf("You may not be getting the speed you pay for.") === -1, "calm line is gone");
check(both.vary === SHORTFALL_COPY.vary, "variability line");
check(both.vary.indexOf("speeds 'up to' a number.") !== -1, "variability keeps the quoted up to");
check(!banned(both).length, "shortfall copy hit " + banned(both).join(", "));

var meet = shortfallReport({ downloadMbps: 300, uploadMbps: 30 }, { down: 300, up: 30 });
check(!meet.show && !meet.planLine && !meet.vary, "meeting the plan shows nothing");

var above = shortfallReport({ downloadMbps: 450, uploadMbps: 40 }, { down: 300, up: 30 });
check(!above.show && !above.planLine, "above the plan shows nothing");

var downOnly = shortfallReport({ downloadMbps: 100, uploadMbps: 30 }, { down: 300, up: 30 });
check(downOnly.show && downOnly.planLine === "About 33% of your plan's download on this test.", "upload that meets the plan stays quiet: " + downOnly.planLine);

var upOnly = shortfallReport({ downloadMbps: 300, uploadMbps: 9 }, { down: 300, up: 30 });
check(upOnly.show && upOnly.planLine === "About 30% of your plan's upload on this test.", "download that meets the plan stays quiet");

var upPlanOnly = shortfallReport({ downloadMbps: 10, uploadMbps: 5 }, { down: null, up: 20 });
check(upPlanOnly.planLine === "About 25% of your plan's upload on this test.", "missing download plan is not compared: " + upPlanOnly.planLine);

var missingMeasure = shortfallReport({ downloadMbps: null, uploadMbps: 5 }, { down: 100, up: 20 });
check(missingMeasure.planLine === "About 25% of your plan's upload on this test.", "missing measurement is not a shortfall: " + missingMeasure.planLine);

var noPlan = shortfallReport({ downloadMbps: 1, uploadMbps: 1 }, { down: null, up: null });
check(!noPlan.show, "no plan shows nothing");

var zeroPlan = shortfallReport({ downloadMbps: 10, uploadMbps: 10 }, { down: 0, up: -5 });
check(!zeroPlan.show, "non positive plan speeds are ignored");

var almost = shortfallReport({ downloadMbps: 99.6, uploadMbps: 30 }, { down: 100, up: 30 });
check(almost.show && almost.planLine === "About 99% of your plan's download on this test.", "a short reading does not round up to 100%: " + almost.planLine);

var third = shortfallReport({ downloadMbps: 100 / 3, uploadMbps: 30 }, { down: 100, up: 30 });
check(third.planLine === "About 33% of your plan's download on this test.", "percent rounds to the nearest whole number: " + third.planLine);

var none = shortfallReport(null, null);
check(!none.show, "empty input shows nothing");

var blob = both.planLine + both.vary;
check(blob.indexOf("\u2014") === -1 && blob.indexOf("\u2013") === -1, "shortfall copy has a dash");
check(blob.indexOf("provider") === -1 && blob.indexOf("ISP") === -1, "shortfall copy names a provider");

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("speed test shortfall check ok");
