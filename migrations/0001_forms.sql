CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source_page TEXT,
  user_agent_hash TEXT
);

CREATE TABLE IF NOT EXISTS isp_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  subscribers TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_page TEXT,
  user_agent_hash TEXT
);
