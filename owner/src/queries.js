export const STATUSES = ["new", "talking", "pilot", "partner"];
export const LIST_LIMIT = 500;
export const CSV_LIMIT = 20000;
export const LOG_LIMIT = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

function statement(db, sql, args = []) {
  const prepared = db.prepare(sql);
  return args.length ? prepared.bind(...args) : prepared;
}

async function all(db, sql, args) {
  const result = await statement(db, sql, args).all();
  return result && Array.isArray(result.results) ? result.results : [];
}

async function first(db, sql, args) {
  return statement(db, sql, args).first();
}

function countOf(row) {
  return Number(row && row.count) || 0;
}

function groupsOf(rows) {
  return rows.map((row) => ({
    label: row && row.label != null ? String(row.label) : "",
    count: countOf(row),
  }));
}

export function missingTable(error, table) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes(`no such table: ${table.toLowerCase()}`);
}

export function isoDaysAgo(now, days) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today + DAY_MS - days * DAY_MS).toISOString();
}

export async function waitlistTotal(db) {
  return countOf(await first(db, "SELECT COUNT(*) AS count FROM waitlist"));
}

export async function waitlistDays(db, since) {
  return groupsOf(await all(db, `
    SELECT substr(created_at, 1, 10) AS label, COUNT(*) AS count
    FROM waitlist
    WHERE created_at >= ?
    GROUP BY label
    ORDER BY label DESC
  `, [since]));
}

export async function waitlistWeeks(db, since) {
  return groupsOf(await all(db, `
    SELECT strftime('%Y-%W', created_at) AS label, COUNT(*) AS count
    FROM waitlist
    WHERE created_at >= ?
    GROUP BY label
    ORDER BY label DESC
  `, [since]));
}

export async function waitlistSources(db) {
  return groupsOf(await all(db, `
    SELECT COALESCE(NULLIF(TRIM(source_page), ''), 'Unknown page') AS label, COUNT(*) AS count
    FROM waitlist
    GROUP BY label
    ORDER BY count DESC
  `));
}

const WAITLIST_COLUMNS = `
  SELECT email, created_at, source_page
  FROM waitlist
  ORDER BY created_at DESC
`;

function sqlLimit(limit) {
  const n = Number(limit);
  if (!Number.isInteger(n) || n < 1 || n > CSV_LIMIT) return LIST_LIMIT;
  return n;
}

export async function waitlistRows(db, limit = LIST_LIMIT) {
  return all(db, `${WAITLIST_COLUMNS} LIMIT ${sqlLimit(limit)}`);
}

export async function ispTotal(db) {
  return countOf(await first(db, "SELECT COUNT(*) AS count FROM isp_inquiries"));
}

const ISP_STATUS_SQL = `
  SELECT COALESCE(p.status, 'new') AS label, COUNT(*) AS count
  FROM isp_inquiries i
  LEFT JOIN isp_pipeline p ON p.inquiry_id = i.id
  GROUP BY label
  ORDER BY count DESC
`;

const ISP_LIST_SQL = `
  SELECT i.id, i.created_at, i.name, i.company, i.email, i.subscribers, i.message, i.source_page,
         COALESCE(p.status, 'new') AS status
  FROM isp_inquiries i
  LEFT JOIN isp_pipeline p ON p.inquiry_id = i.id
  ORDER BY i.created_at DESC
`;

const ISP_LIST_PLAIN = `
  SELECT id, created_at, name, company, email, subscribers, message, source_page, 'new' AS status
  FROM isp_inquiries
  ORDER BY created_at DESC
`;

export async function ispStatuses(db) {
  try {
    return { ready: true, rows: groupsOf(await all(db, ISP_STATUS_SQL)) };
  } catch (error) {
    if (missingTable(error, "isp_pipeline")) return { ready: false, rows: [] };
    throw error;
  }
}

export async function ispRows(db, limit = LIST_LIMIT) {
  const capped = sqlLimit(limit);
  try {
    return { ready: true, rows: await all(db, `${ISP_LIST_SQL} LIMIT ${capped}`) };
  } catch (error) {
    if (!missingTable(error, "isp_pipeline")) throw error;
    return { ready: false, rows: await all(db, `${ISP_LIST_PLAIN} LIMIT ${capped}`) };
  }
}

export function parseInquiryId(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,14}$/.test(value)) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id)) return null;
  return id;
}

export function parseStatus(value) {
  return STATUSES.includes(value) ? value : null;
}

export async function saveStatus(db, inquiryId, status, actor, iso) {
  const existing = await first(db, "SELECT id FROM isp_inquiries WHERE id = ?", [inquiryId]);
  if (!existing) return { ok: false, reason: "missing" };
  const current = await first(db, "SELECT status FROM isp_pipeline WHERE inquiry_id = ?", [inquiryId]);
  const previous = current && STATUSES.includes(current.status) ? current.status : "new";
  if (previous === status) return { ok: true, changed: false };
  await statement(db, `
    INSERT INTO isp_pipeline (inquiry_id, status, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(inquiry_id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `, [inquiryId, status, iso, actor]).run();
  return { ok: true, changed: true };
}

export async function logAccess(db, actor, action, detail, iso) {
  if (action !== "view" && action !== "export" && action !== "status") {
    throw new Error("bad action");
  }
  await statement(db, `
    INSERT INTO owner_access_log (actor_email, action, detail, created_at)
    VALUES (?, ?, ?, ?)
  `, [actor, action, detail, iso]).run();
}

export async function accessRows(db) {
  try {
    const rows = await all(db, `
      SELECT actor_email, action, detail, created_at
      FROM owner_access_log
      ORDER BY id DESC
      LIMIT ${LOG_LIMIT}
    `);
    return { ready: true, rows };
  } catch (error) {
    if (missingTable(error, "owner_access_log")) return { ready: false, rows: [] };
    throw error;
  }
}
