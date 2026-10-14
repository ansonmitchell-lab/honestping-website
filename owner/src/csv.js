function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers, rows) {
  const lines = [headers.map((header) => csvCell(header)).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => csvCell(cell)).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export const WAITLIST_CSV_HEADERS = ["email", "created_at", "source_page"];
export const ISP_CSV_HEADERS = [
  "name",
  "company",
  "email",
  "subscribers",
  "message",
  "created_at",
  "source_page",
  "status",
];

export function waitlistCsv(rows) {
  return toCsv(WAITLIST_CSV_HEADERS, rows.map((row) => [
    row.email,
    row.created_at,
    row.source_page,
  ]));
}

export function ispCsv(rows) {
  return toCsv(ISP_CSV_HEADERS, rows.map((row) => [
    row.name,
    row.company,
    row.email,
    row.subscribers,
    row.message,
    row.created_at,
    row.source_page,
    row.status,
  ]));
}
