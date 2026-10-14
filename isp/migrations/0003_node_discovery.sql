-- Phase 1 node suggestions, cached public enrichment, and integration rows.
-- Reads of suggestions and enrichment are scoped by isp_org.

CREATE TABLE IF NOT EXISTS node_suggestions (
  id TEXT PRIMARY KEY,
  isp_org TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  suggested_name TEXT,
  suggested_layer TEXT CHECK (suggested_layer IN ('access', 'aggregation', 'core', 'peering', 'unknown')),
  ip_ranges TEXT NOT NULL,
  neighbors TEXT,
  confidence REAL NOT NULL,
  evidence TEXT NOT NULL,
  households INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('trace', 'integration', 'collector')),
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
  node_id TEXT,
  first_seen INTEGER,
  last_seen INTEGER,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  UNIQUE (isp_org, fingerprint)
);

CREATE INDEX IF NOT EXISTS node_suggestions_org ON node_suggestions (isp_org, status, households);

CREATE TABLE IF NOT EXISTS hop_enrichment (
  isp_org TEXT NOT NULL,
  ip TEXT NOT NULL,
  ptr TEXT,
  asn INTEGER,
  prefix TEXT,
  ixp_id INTEGER,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (isp_org, ip)
);

CREATE TABLE IF NOT EXISTS isp_integrations (
  id TEXT PRIMARY KEY,
  isp_org TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('netbox', 'uisp', 'sonar', 'splynx', 'librenms', 'webhook', 'collector')),
  base_url TEXT,
  secret_ciphertext TEXT,
  field_allowlist TEXT NOT NULL,
  sync_interval_min INTEGER DEFAULT 360,
  enabled INTEGER DEFAULT 0,
  last_sync_at INTEGER,
  last_status TEXT,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS isp_integrations_org ON isp_integrations (isp_org, kind);
