import { readdirSync, readFileSync } from "node:fs";

export function migrationSql() {
  const dir = new URL("../migrations/", import.meta.url);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(new URL(name, dir), "utf8") }));
}

export function statementsOf(sql) {
  return sql.split(";").map((part) => part.trim()).filter(Boolean);
}

export async function applyIspMigrations(db) {
  const applied = [];
  for (const file of migrationSql()) {
    for (const statement of statementsOf(file.sql)) {
      await db.prepare(statement).run();
    }
    applied.push(file.name);
  }
  return applied;
}
