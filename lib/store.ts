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
    position: Number(row.position),
    title: row.title,
    artist: row.artist,
    album: row.album ?? undefined,
    cover: row.cover ?? undefined,
    isrc: row.isrc ?? undefined,
    duration: row.duration == null ? undefined : Number(row.duration),
    links: JSON.parse(row.links) as Links,
    resolvedAt: row.resolved_at == null ? null : Number(row.resolved_at),
  };
}

export async function createMix(input: {
  title: string;
  note?: string;
  author?: string;
  tracks: Track[];
}): Promise<string> {
  const db = await getDb();
  const id = shortId(7);

  // one round trip, applied atomically
  await db.batch(
    [
      {
        sql: "INSERT INTO mixes (id, title, note, author, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, input.title, input.note || null, input.author || null, Date.now()],
      },
      ...input.tracks.map((t, i) => ({
        sql: `INSERT INTO tracks (id, mix_id, position, title, artist, album, cover, isrc, duration, links)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
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
        ],
      })),
    ],
    "write",
  );
  return id;
}

export async function getMix(id: string): Promise<Mix | null> {
  const db = await getDb();
  const [mixes, tracks] = await db.batch(
    [
      { sql: "SELECT * FROM mixes WHERE id = ?", args: [id] },
      { sql: "SELECT * FROM tracks WHERE mix_id = ? ORDER BY position", args: [id] },
    ],
    "read",
  );
  const mix = mixes.rows[0] as unknown as MixRow | undefined;
  if (!mix) return null;
  return {
    id: mix.id,
    title: mix.title,
    note: mix.note,
    author: mix.author,
    createdAt: Number(mix.created_at),
    tracks: (tracks.rows as unknown as TrackRow[]).map(toTrack),
  };
}

export async function getTrack(id: string): Promise<StoredTrack | null> {
  const db = await getDb();
  const { rows } = await db.execute({ sql: "SELECT * FROM tracks WHERE id = ?", args: [id] });
  return rows[0] ? toTrack(rows[0] as unknown as TrackRow) : null;
}

export async function saveTrackLinks(id: string, links: Links): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE tracks SET links = ?, resolved_at = ? WHERE id = ?",
    args: [JSON.stringify(links), Date.now(), id],
  });
}

export async function cacheGet<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const db = await getDb();
  const { rows } = await db.execute({ sql: "SELECT value, created_at FROM cache WHERE key = ?", args: [key] });
  const row = rows[0] as unknown as { value: string; created_at: number } | undefined;
  if (!row || Date.now() - Number(row.created_at) > maxAgeMs) return null;
  return JSON.parse(row.value) as T;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)",
    args: [key, JSON.stringify(value), Date.now()],
  });
}
