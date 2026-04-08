import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

// Single shared connection. better-sqlite3 is synchronous and safe to share
// across requests in a single Node process.
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath =
    process.env.UBLEND_DB_PATH ??
    path.join(process.cwd(), "data", "ublend.db");

  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Apply schema on every boot — all statements are idempotent (CREATE IF NOT EXISTS).
  const schemaPath = path.join(process.cwd(), "src", "lib", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");
  _db.exec(schema);

  return _db;
}
