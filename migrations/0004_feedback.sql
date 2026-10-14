-- Feedback intake. Feature requests, bug reports, and crash reports share this table.
-- screenshot_key is an object key in the private R2 bucket bound as SCREENSHOTS.
-- ip_hash is a salted SHA-256 of the client IP, used only for rate limiting.
-- The raw IP, emails, device lists, and MAC addresses are not stored.

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('app', 'isp')),
  kind TEXT NOT NULL CHECK (kind IN ('feature', 'bug', 'crash')),
  issue_type TEXT CHECK (
    issue_type IS NULL OR issue_type IN (
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
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  expected_behavior TEXT CHECK (expected_behavior IS NULL OR length(expected_behavior) <= 2000),
  page_context TEXT CHECK (page_context IS NULL OR length(page_context) <= 200),
  app_version TEXT CHECK (app_version IS NULL OR length(app_version) <= 80),
  os TEXT CHECK (os IS NULL OR length(os) <= 120),
  isp_org TEXT CHECK (isp_org IS NULL OR length(isp_org) <= 120),
  screenshot_key TEXT,
  diagnostics TEXT CHECK (diagnostics IS NULL OR length(diagnostics) <= 65536),
  auto_sent INTEGER NOT NULL DEFAULT 0 CHECK (auto_sent IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'declined', 'done')),
  ip_hash TEXT NOT NULL CHECK (length(ip_hash) = 64),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_ip_created ON feedback (ip_hash, created_at);

CREATE INDEX IF NOT EXISTS feedback_created_at ON feedback (created_at);

CREATE INDEX IF NOT EXISTS feedback_issue_created ON feedback (issue_type, created_at);

CREATE INDEX IF NOT EXISTS feedback_filters ON feedback (source, kind, status);
