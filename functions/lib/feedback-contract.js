export const SOURCES = ["app", "isp"];
export const KINDS = ["feature", "bug", "crash"];
export const FEEDBACK_STATUSES = ["new", "reviewing", "planned", "declined", "done"];

export const APP_ISSUE_TYPES = [
  "speed_test",
  "trace",
  "network_scan",
  "report_7day",
  "monitor_alerts",
  "startup_freeze",
  "display_layout",
  "other",
];

export const ISP_ISSUE_TYPES = [
  "node_health",
  "claim_queue",
  "claim_detail",
  "trace_path",
  "settings_access",
  "data_looks_wrong",
  "display_layout",
  "other",
];

export const ISSUE_LABELS = {
  speed_test: "Speed test",
  trace: "Trace",
  network_scan: "Network scan",
  report_7day: "7-day report",
  monitor_alerts: "Monitor alerts",
  startup_freeze: "Startup or freeze",
  display_layout: "Display layout",
  other: "Other",
  node_health: "Node health",
  claim_queue: "Claim queue",
  claim_detail: "Claim detail",
  trace_path: "Trace path",
  settings_access: "Settings access",
  data_looks_wrong: "Data looks wrong",
};

export const LIMITS = {
  title: 80,
  description: 2000,
  expectedBehavior: 2000,
  pageContext: 200,
  appVersion: 80,
  os: 120,
  screen: 200,
  logExcerpt: 60000,
  diagnosticsBytes: 64 * 1024,
  screenshotBytes: Math.floor(1.5 * 1024 * 1024),
  bodyChars: Math.ceil(2.6 * 1024 * 1024),
  crashPerDay: 5,
  reportsPerDay: 20,
};

export function issueTypesFor(source) {
  if (source === "app") return APP_ISSUE_TYPES;
  if (source === "isp") return ISP_ISSUE_TYPES;
  return [];
}

export function issueLabel(value) {
  if (!value) return "No issue type";
  return ISSUE_LABELS[value] || value;
}
