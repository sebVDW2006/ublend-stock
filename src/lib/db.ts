import { createClient, type Client } from "@libsql/client";

// Single shared libSQL client. Safe to reuse across requests in serverless
// environments — the underlying HTTP connection is pooled.
//
// Why this changed: better-sqlite3 needs a writable file on disk, which
// Vercel serverless functions do not have. libSQL talks to a remote
// Turso database over HTTP, so it works in any serverless environment.
//
// The schema in src/lib/schema.sql must be applied to the Turso database
// ONCE manually via the Turso web shell — see HAIKU-IMPLEMENT.md Phase 1.

let _db: Client | null = null;

export function getDb(): Client {
  if (_db) return _db;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. See HAIKU-IMPLEMENT.md Phase 6."
    );
  }

  _db = createClient({ url, authToken });
  return _db;
}
