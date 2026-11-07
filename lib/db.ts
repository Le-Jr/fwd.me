import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = path.join(process.cwd(), "data");

// Reuse one connection across dev hot reloads.
const globalForDb = globalThis as unknown as { fwdDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (globalForDb.fwdDb) return globalForDb.fwdDb;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "fwd.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS mixes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      note       TEXT,
      author     TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracks (
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
    );
    CREATE INDEX IF NOT EXISTS tracks_by_mix ON tracks(mix_id, position);

    CREATE TABLE IF NOT EXISTS cache (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  globalForDb.fwdDb = db;
  return db;
}
