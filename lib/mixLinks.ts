import { lookupLinks, youtubeId } from "./resolve";
import { getMix, saveTrackLinks } from "./store";
import type { Links, StoredTrack } from "./types";

const WORKERS = 3;

/** When lookupLinks started finding YouTube videos; older lookups get one more pass. */
const YOUTUBE_LOOKUP_SINCE = Date.UTC(2026, 10, 8);

/** A track still worth looking up: never resolved, or resolved before YouTube lookup existed. */
export function needsLinks(t: StoredTrack): boolean {
  if (!t.resolvedAt) return true;
  return !t.links.youtube && !t.links.ytmusic && t.resolvedAt < YOUTUBE_LOOKUP_SINCE;
}

// one run per mix at a time, so the create hook and the first viewer share work
const running = new Map<string, Promise<StoredTrack[] | null>>();

/**
 * Fills in every platform link for a mix up front, a few tracks at a time
 * (Deezer allows ~50 requests / 5s). Returns the updated tracks.
 */
export function resolveMixLinks(mixId: string): Promise<StoredTrack[] | null> {
  const existing = running.get(mixId);
  if (existing) return existing;
  const run = doResolve(mixId).finally(() => running.delete(mixId));
  running.set(mixId, run);
  return run;
}

async function doResolve(mixId: string): Promise<StoredTrack[] | null> {
  const mix = getMix(mixId);
  if (!mix) return null;

  const queue = mix.tracks.filter(needsLinks);
  async function worker() {
    for (let t = queue.shift(); t; t = queue.shift()) {
      try {
        const found = await lookupLinks(t);
        t.links = { ...found, ...t.links };
        t.resolvedAt = Date.now();
        saveTrackLinks(t.id, t.links);
      } catch {
        // rate limited or a source hiccup: leave it for the next viewer
      }
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  return mix.tracks;
}

/** YouTube and YouTube Music share video ids, so either link gives the other. */
export function withYoutubePair(links: Links): Links {
  const id = youtubeId(links.youtube ?? links.ytmusic ?? "");
  if (!id) return links;
  return {
    ...links,
    youtube: links.youtube ?? `https://www.youtube.com/watch?v=${id}`,
    ytmusic: links.ytmusic ?? `https://music.youtube.com/watch?v=${id}`,
  };
}

/**
 * Turns the mix into one anonymous YouTube playlist. watch_videos builds a
 * temporary list and redirects to `watch?v=…&list=TLGG…`; handing out that final
 * URL lets the YouTube apps claim it directly. YouTube Music accepts the same list.
 */
export async function youtubePlaylist(tracks: StoredTrack[]): Promise<{ youtube: string; ytmusic: string; count: number } | null> {
  const ids = tracks
    .map((t) => youtubeId(t.links.youtube ?? t.links.ytmusic ?? ""))
    .filter((id): id is string => !!id)
    .slice(0, 50);
  if (!ids.length) return null;

  const builder = `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;
  let youtube = builder;
  try {
    const res = await fetch(builder, {
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      },
      cache: "no-store",
    });
    const location = res.headers.get("location");
    if (location) youtube = new URL(location, builder).href;
  } catch {
    // the builder URL still works, it just opens the browser first
  }

  const list = new URL(youtube).searchParams.get("list");
  const ytmusic = list
    ? `https://music.youtube.com/watch?v=${ids[0]}&list=${list}`
    : `https://music.youtube.com/watch?v=${ids[0]}`;
  return { youtube, ytmusic, count: ids.length };
}
