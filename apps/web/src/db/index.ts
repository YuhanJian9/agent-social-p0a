import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./sql";
import { seedIfEmpty } from "./seed";

export type AppDb = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as {
  p0aSqlite?: Database.Database;
  p0aDb?: AppDb;
};

function openDatabase() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path.join(dir, "p0a.sqlite"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 3000");
  sqlite.exec(SCHEMA_SQL);
  return sqlite;
}

export function getSqlite() {
  if (!globalForDb.p0aSqlite) {
    globalForDb.p0aSqlite = openDatabase();
  }
  return globalForDb.p0aSqlite;
}

export function getDb() {
  if (!globalForDb.p0aDb) {
    const sqlite = getSqlite();
    globalForDb.p0aDb = drizzle(sqlite, { schema });
    seedIfEmpty(globalForDb.p0aDb);
  }
  return globalForDb.p0aDb;
}
