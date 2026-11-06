-- Owner dashboard tables. They share the waitlist D1 database.
-- A missing isp_pipeline row means that inquiry is still new.
-- owner_access_log records each dashboard view, CSV export, and status change.

CREATE TABLE IF NOT EXISTS isp_pipeline (
  inquiry_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('new', 'talking', 'pilot', 'partner')),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('view', 'export', 'status')),
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS owner_access_log_created_at ON owner_access_log (created_at);
