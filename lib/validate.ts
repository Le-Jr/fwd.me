import { isPlatformId, isTrustedLink } from "./platforms";
import type { Links, Track } from "./types";

export function cleanString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Tracks come from the browser, so rebuild them field by field. */
export function cleanTrack(input: unknown): Track | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const links: Links = {};
  if (raw.links && typeof raw.links === "object") {
    for (const [id, url] of Object.entries(raw.links as Record<string, unknown>)) {
      if (isPlatformId(id) && typeof url === "string" && isTrustedLink(id, url)) links[id] = url;
    }
  }

  const title = cleanString(raw.title, 200);
  const artist = cleanString(raw.artist, 200);
  if (!title || Object.keys(links).length === 0) return null;

  const duration = Number(raw.duration);
  return {
    title,
    artist: artist || "Artista desconhecido",
    album: cleanString(raw.album, 200) || undefined,
    cover: cleanUrl(raw.cover),
    isrc: /^[A-Z0-9]{12}$/i.test(String(raw.isrc ?? "")) ? String(raw.isrc).toUpperCase() : undefined,
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined,
    links,
  };
}
