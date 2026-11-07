import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

/*
 * One libSQL client for the whole app:
 *   - production (Vercel): Turso, via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 *   - local dev: a plain SQLite file in data/fwd.db (same schema, same queries)
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mixes (
     id         TEXT PRIMARY KEY,
     title      TEXT NOT NULL,
     note       TEXT,
     author     TEXT,
     created_at INTEGER NOT NULL,
     secret     TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS tracks (
     id          TEXT PRIMARY KEY,
     mix_id      TEXT NOT NULL REFERENCES mixes(id),
     position    INTEGER NOT NULL,
     title       TEXT NOT NULL,
     artist      TEXT NOT NULL,
     album       TEXT,
     cover       TEXT,
     isrc        TEXT,
     duration    INTEGER,
     links       TEXT NOT NULL DEFAULT '{}',
     resolved_at INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS tracks_by_mix ON tracks(mix_id, position)`,
  `CREATE TABLE IF NOT EXISTS cache (
     key        TEXT PRIMARY KEY,
     value      TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
];

// Reuse one client (and one schema check) across dev hot reloads and warm invocations.
const globalForDb = globalThis as unknown as { fwdDb?: Promise<Client> };

function connect(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  if (process.env.VERCEL) {
    // the Vercel filesystem is read-only and ephemeral: a file DB would lose every mix
    throw new Error("TURSO_DATABASE_URL não configurada na Vercel");
  }
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return createClient({ url: `file:${path.join(dir, "fwd.db")}` });
}

async function init(): Promise<Client> {
  const client = connect();
  await client.batch(SCHEMA, "write");
  await migrate(client);
  return client;
}

/** Additive migrations for databases created before a column existed. */
async function migrate(client: Client): Promise<void> {
  const { rows } = await client.execute("SELECT name FROM pragma_table_info('mixes')");
  const columns = new Set(rows.map((r) => String(r.name)));
  // E2E-encrypted subject/note/sender (see lib/crypto.ts); NULL on legacy plaintext mixes
  if (!columns.has("secret")) await client.execute("ALTER TABLE mixes ADD COLUMN secret TEXT");
}

export function getDb(): Promise<Client> {
  globalForDb.fwdDb ??= init().catch((err) => {
    globalForDb.fwdDb = undefined; // let the next request retry
    throw err;
  });
  return globalForDb.fwdDb;
}
