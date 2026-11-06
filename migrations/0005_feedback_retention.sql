-- Nothing derived from the client IP stays in D1. Rate limits live in KV.
-- ISP names are not stored. Crash bodies older than 90 days reduce to a signature.

DROP INDEX IF EXISTS feedback_ip_created;

ALTER TABLE feedback DROP COLUMN ip_hash;

ALTER TABLE feedback DROP COLUMN isp_org;

ALTER TABLE feedback ADD COLUMN exception_type TEXT CHECK (exception_type IS NULL OR length(exception_type) <= 120);

ALTER TABLE feedback ADD COLUMN frames_hash TEXT CHECK (frames_hash IS NULL OR length(frames_hash) = 64);

CREATE TABLE IF NOT EXISTS crash_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_type TEXT NOT NULL CHECK (length(exception_type) BETWEEN 1 AND 120),
  frames_hash TEXT NOT NULL CHECK (length(frames_hash) = 64),
  source TEXT NOT NULL CHECK (source IN ('app', 'isp')),
  issue_type TEXT NOT NULL DEFAULT '' CHECK (
    issue_type = '' OR issue_type IN (
      'speed_test',
      'trace',
      'network_scan',
      'report_7day',
      'monitor_alerts',
      'startup_freeze',
      'display_layout',
      'other',
      'node_health',
      'claim_queue',
      'claim_detail',
      'trace_path',
      'settings_access',
      'data_looks_wrong'
    )
  ),
  count INTEGER NOT NULL CHECK (count >= 1),
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS crash_signatures_key
  ON crash_signatures (exception_type, frames_hash, source, issue_type);
