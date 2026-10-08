-- One shared trace per run_id. Hops are stored on that run only.
-- There is no sender address column. Home LAN addresses are not a column either.

CREATE TABLE IF NOT EXISTS shared_reports (
  report_id TEXT NOT NULL,
  isp_org TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (isp_org, report_id)
);

CREATE TABLE IF NOT EXISTS shared_traces (
  run_id TEXT PRIMARY KEY,
  isp_org TEXT NOT NULL,
  report_id TEXT NOT NULL,
  report_fingerprint TEXT NOT NULL,
  received_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  target_class TEXT NOT NULL CHECK (target_class IN ('default', 'service')),
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  outcome_status TEXT NOT NULL,
  reached INTEGER NOT NULL,
  app_summary_code TEXT,
  home_summary TEXT NOT NULL,
  household_hash TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  example INTEGER NOT NULL DEFAULT 0,
  onset_ttl INTEGER,
  onset_kind TEXT,
  onset_segment TEXT,
  suspect_node_id TEXT,
  verdict TEXT
);

CREATE INDEX IF NOT EXISTS shared_traces_org_time ON shared_traces (isp_org, received_at);
CREATE INDEX IF NOT EXISTS shared_traces_suspect ON shared_traces (isp_org, suspect_node_id);

CREATE TABLE IF NOT EXISTS trace_hops (
  run_id TEXT NOT NULL,
  isp_org TEXT NOT NULL,
  ttl INTEGER NOT NULL,
  role TEXT NOT NULL,
  scope TEXT NOT NULL,
  ip TEXT,
  redacted INTEGER NOT NULL DEFAULT 0,
  isp_private INTEGER NOT NULL DEFAULT 0,
  rtt_ms TEXT NOT NULL,
  sent INTEGER NOT NULL,
  received INTEGER NOT NULL,
  app_ms INTEGER,
  matched_node_id TEXT,
  matched_suggestion_id TEXT,
  segment TEXT NOT NULL CHECK (segment IN ('home', 'access', 'aggregation', 'core', 'peering', 'beyond_isp', 'unknown')),
  PRIMARY KEY (run_id, ttl)
);

CREATE INDEX IF NOT EXISTS trace_hops_org_run ON trace_hops (isp_org, run_id);
CREATE INDEX IF NOT EXISTS trace_hops_org_node ON trace_hops (isp_org, matched_node_id);

CREATE TABLE IF NOT EXISTS trace_ingest_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isp_org TEXT NOT NULL,
  run_id TEXT NOT NULL,
  code TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS trace_ingest_warnings_org ON trace_ingest_warnings (isp_org, run_id);
