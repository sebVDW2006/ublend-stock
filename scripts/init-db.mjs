// Initialise (or upgrade) the SQLite database file by running schema.sql.
// Usage:  npm run db:init
// Honours UBLEND_DB_PATH if set; otherwise writes to ./data/ublend.db.

import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const dbPath =
  process.env.UBLEND_DB_PATH ?? path.join(process.cwd(), "data", "ublend.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = readFileSync(
  path.join(process.cwd(), "src", "lib", "schema.sql"),
  "utf8",
);
db.exec(schema);

console.log(`✓ schema applied to ${dbPath}`);
db.close();
