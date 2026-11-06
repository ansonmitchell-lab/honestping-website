-- ISP nodes and the ranges that map a shared hop to a node.
-- source tells a manual node from a trace, NetBox, or UISP import.

CREATE TABLE IF NOT EXISTS isp_nodes (
  id TEXT PRIMARY KEY,
  isp_org TEXT NOT NULL,
  name TEXT NOT NULL,
  area TEXT,
  role TEXT NOT NULL CHECK (role IN ('access', 'aggregation', 'core', 'peering')),
  source TEXT NOT NULL CHECK (source IN ('manual', 'trace', 'netbox', 'uisp')),
  external_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'unseen')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS isp_nodes_org ON isp_nodes (isp_org, status);

CREATE TABLE IF NOT EXISTS isp_node_ranges (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  isp_org TEXT NOT NULL,
  cidr TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'trace', 'netbox', 'uisp')),
  external_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS isp_node_ranges_org ON isp_node_ranges (isp_org, node_id);
