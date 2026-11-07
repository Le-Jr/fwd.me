import { randomBytes } from "node:crypto";
import { getDb } from "./db";
import type { Links, Mix, StoredTrack, Track } from "./types";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function shortId(length: number): string {
  let id = "";
  for (const byte of randomBytes(length)) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

interface MixRow {
  id: string;
  title: string;
  note: string | null;
  author: string | null;
  created_at: number;
}

interface TrackRow {
  id: string;
  position: number;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  isrc: string | null;
  duration: number | null;
  links: string;
  resolved_at: number | null;
}

function toTrack(row: TrackRow): StoredTrack {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    artist: row.artist,
    album: row.album ?? undefined,
    cover: row.cover ?? undefined,
    isrc: row.isrc ?? undefined,
    duration: row.duration ?? undefined,
    links: JSON.parse(row.links) as Links,
    resolvedAt: row.resolved_at,
  };
}

export function createMix(input: { title: string; note?: string; author?: string; tracks: Track[] }): string {
  const db = getDb();
  const id = shortId(7);

  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO mixes (id, title, note, author, created_at) VALUES (?, ?, ?, ?, ?)").run(
      id,
      input.title,
      input.note || null,
      input.author || null,
      Date.now(),
    );
    const insertTrack = db.prepare(
      `INSERT INTO tracks (id, mix_id, position, title, artist, album, cover, isrc, duration, links)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    input.tracks.forEach((t, i) => {
      insertTrack.run(
        shortId(10),
        id,
        i,
        t.title,
        t.artist,
        t.album ?? null,
        t.cover ?? null,
        t.isrc ?? null,
        t.duration ?? null,
        JSON.stringify(t.links),
      );
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return id;
}

export function getMix(id: string): Mix | null {
  const db = getDb();
  const mix = db.prepare("SELECT * FROM mixes WHERE id = ?").get(id) as MixRow | undefined;
  if (!mix) return null;
  const rows = db.prepare("SELECT * FROM tracks WHERE mix_id = ? ORDER BY position").all(id) as unknown as TrackRow[];
  return {
    id: mix.id,
    title: mix.title,
    note: mix.note,
    author: mix.author,
    createdAt: mix.created_at,
    tracks: rows.map(toTrack),
  };
}

export function getTrack(id: string): StoredTrack | null {
  const row = getDb().prepare("SELECT * FROM tracks WHERE id = ?").get(id) as TrackRow | undefined;
  return row ? toTrack(row) : null;
}

export function saveTrackLinks(id: string, links: Links): void {
  getDb()
    .prepare("UPDATE tracks SET links = ?, resolved_at = ? WHERE id = ?")
    .run(JSON.stringify(links), Date.now(), id);
}

export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  const row = getDb().prepare("SELECT value, created_at FROM cache WHERE key = ?").get(key) as
    | { value: string; created_at: number }
    | undefined;
  if (!row || Date.now() - row.created_at > maxAgeMs) return null;
  return JSON.parse(row.value) as T;
}

export function cacheSet(key: string, value: unknown): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)")
    .run(key, JSON.stringify(value), Date.now());
}
