import { parseCidr } from "./ip.js";

const BANNED = /^(mac|mac_address|username|user_name|customer|customer_name|email|e-mail|framed_ip|framed-ip|remote_id|remote-id|ssid|bssid|account|account_id|subscriber|serial|phone|address_line|street)$/i;

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] == null ? "" : values[index].trim();
    });
    return record;
  });
  return { headers, records };
}

export function mapRole(value) {
  const text = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (["access", "olt", "cmts", "bng", "bras", "cpe", "edge-access", "last-mile"].includes(text)) return "access";
  if (["aggregation", "agg", "distribution", "dist"].includes(text)) return "aggregation";
  if (["core", "backbone", "spine"].includes(text)) return "core";
  if (["peering", "border", "ixp", "ix"].includes(text)) return "peering";
  return null;
}

function headerMap(headers) {
  const map = new Map();
  for (const header of headers) map.set(header.toLowerCase().replace(/[\s_]+/g, ""), header);
  return map;
}

function pick(record, map, names) {
  for (const name of names) {
    const header = map.get(name);
    if (header && record[header]) return record[header];
  }
  return "";
}

function sensitive(value) {
  return /(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i.test(value) || value.includes("@");
}

export function parseNodeCsv(text, kind) {
  const { headers, records } = parseCsv(text);
  const warnings = [];
  const dropped = headers.filter((header) => BANNED.test(header.trim()));
  if (dropped.length) warnings.push("Dropped a column that is not node data.");
  const map = headerMap(headers.filter((header) => !BANNED.test(header.trim())));
  const nodes = new Map();
  let skipped = 0;
  for (const record of records) {
    const clean = { ...record };
    for (const header of dropped) delete clean[header];
    const parsed = rowToNode(clean, map, kind);
    if (!parsed) {
      skipped += 1;
      continue;
    }
    const key = `${parsed.name}|${parsed.area}|${parsed.role}`;
    if (!nodes.has(key)) nodes.set(key, { ...parsed, cidrs: [] });
    const node = nodes.get(key);
    if (!node.cidrs.includes(parsed.cidr)) node.cidrs.push(parsed.cidr);
    if (parsed.external_ref) node.external_ref = parsed.external_ref;
  }
  if (skipped) warnings.push(skipped === 1 ? "1 row was skipped." : `${skipped} rows were skipped.`);
  return {
    nodes: [...nodes.values()].map((node) => ({
      name: node.name,
      area: node.area,
      role: node.role,
      cidrs: node.cidrs,
      external_ref: node.external_ref || null,
      source: kind === "plain" ? "manual" : kind,
    })),
    warnings,
  };
}

function rowToNode(record, map, kind) {
  const rawCidr = pick(record, map, ["cidr", "prefix", "address", "ipaddress", "ip"]);
  if (!rawCidr || sensitive(rawCidr)) return null;
  const cidr = normalizeCidr(rawCidr);
  if (!cidr) return null;
  const name = pick(record, map, ["name", "device", "hostname", "dnsname"]).slice(0, 80);
  if (!name || sensitive(name)) return null;
  const area = pick(record, map, ["area", "site", "sitename", "location"]).slice(0, 80);
  let role = mapRole(pick(record, map, ["role", "devicerole"]));
  if (!role && kind === "uisp") role = mapRole(name) || "access";
  if (!role && kind === "netbox") role = mapRole(name);
  if (!role) return null;
  const external = pick(record, map, ["id", "externalref", "deviceid"]).slice(0, 80);
  return {
    name,
    area,
    role,
    cidr,
    external_ref: external || null,
  };
}

function normalizeCidr(value) {
  const text = value.split(/\s+/)[0];
  if (sensitive(text)) return null;
  const withPrefix = text.includes("/") ? text : `${text}/32`;
  const parsed = parseCidr(withPrefix);
  return parsed ? parsed.cidr : null;
}
