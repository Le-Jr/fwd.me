import { isTrustedLink } from "./platforms";
import { cacheGet, cacheSet } from "./store";
import type { Links, PlatformId, Track } from "./types";

const DAY = 86_400_000;
export const MAX_TRACKS = 500;

export class ResolveError extends Error {}

export class RateLimited extends ResolveError {
  constructor() {
    super("muitas buscas seguidas, tenta de novo em 1 minuto");
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Odesli (song.link): turns one streaming link into links for every platform.
// Without an API key it allows ~10 requests/minute, so results are cached.
// ---------------------------------------------------------------------------

const ODESLI_API = "https://api.song.link/v1-alpha.1/links";

interface OdesliEntity {
  id: string;
  type: "song" | "album";
  title?: string;
  artistName?: string;
  thumbnailUrl?: string;
}

interface OdesliResponse {
  entityUniqueId: string;
  entitiesByUniqueId: Record<string, OdesliEntity>;
  linksByPlatform: Record<string, { url: string; entityUniqueId: string } | undefined>;
}

const ODESLI_PLATFORMS: [string, PlatformId][] = [
  ["deezer", "deezer"],
  ["spotify", "spotify"],
  ["amazonMusic", "amazon"],
  ["youtubeMusic", "ytmusic"],
  ["youtube", "youtube"],
];

export async function odesli(url: string, { retries = 2 } = {}): Promise<OdesliResponse> {
  const cacheKey = `odesli:${url}`;
  const hit = cacheGet<OdesliResponse>(cacheKey, 7 * DAY);
  if (hit) return hit;

  const params = new URLSearchParams({ url, userCountry: process.env.ODESLI_COUNTRY ?? "BR" });
  if (process.env.ODESLI_API_KEY) params.set("key", process.env.ODESLI_API_KEY);

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${ODESLI_API}?${params}`, { cache: "no-store" });
    if (res.status === 429) {
      if (attempt >= retries) throw new RateLimited();
      const wait = Number(res.headers.get("retry-after")) * 1000 || 6000;
      await sleep(Math.min(wait, 10_000));
      continue;
    }
    if (!res.ok) throw new ResolveError("não achei essa música nos streamings");
    const data = (await res.json()) as OdesliResponse;
    cacheSet(cacheKey, data);
    return data;
  }
}

function linksFromOdesli(data: OdesliResponse): Links {
  const links: Links = {};
  for (const [key, id] of ODESLI_PLATFORMS) {
    const url = data.linksByPlatform[key]?.url;
    if (url && isTrustedLink(id, url)) links[id] = url;
  }
  return links;
}

function trackFromOdesli(data: OdesliResponse): Track {
  // Prefer metadata from music services over YouTube video titles.
  const entities = [
    ...ODESLI_PLATFORMS.map(([key]) => data.linksByPlatform[key]?.entityUniqueId),
    data.entityUniqueId,
  ]
    .map((id) => (id ? data.entitiesByUniqueId[id] : undefined))
    .filter((e): e is OdesliEntity => Boolean(e));
  const named = entities.find((e) => e.title && e.artistName) ?? entities[0];

  return {
    title: named?.title ?? "Sem título",
    artist: named?.artistName ?? "Artista desconhecido",
    cover: entities.find((e) => e.thumbnailUrl)?.thumbnailUrl,
    links: linksFromOdesli(data),
  };
}

// ---------------------------------------------------------------------------
// Deezer: open API, no key. Used for search and for playlist/album track lists.
// ---------------------------------------------------------------------------

interface DeezerTrack {
  id: number;
  title: string;
  link: string;
  duration: number;
  isrc?: string;
  artist: { name: string };
  album?: { title: string; cover_big?: string; cover_xl?: string };
}

interface DeezerAlbum {
  title: string;
  cover_xl?: string;
  cover_big?: string;
  tracks: { data: DeezerTrack[] };
}

interface DeezerPage<T> {
  data: T[];
  next?: string;
}

async function deezer<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.deezer.com/${path}`, { cache: "no-store" });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || data.error) throw new ResolveError("o Deezer não achou esse link");
  return data;
}

function fromDeezer(t: DeezerTrack, album?: { title: string; cover?: string }): Track {
  return {
    title: t.title,
    artist: t.artist.name,
    album: album?.title ?? t.album?.title,
    cover: album?.cover ?? t.album?.cover_xl ?? t.album?.cover_big,
    isrc: t.isrc,
    duration: t.duration,
    links: { deezer: t.link },
  };
}

async function deezerAlbum(id: string): Promise<Track[]> {
  const album = await deezer<DeezerAlbum>(`album/${id}`);
  const meta = { title: album.title, cover: album.cover_xl ?? album.cover_big };
  return album.tracks.data.slice(0, MAX_TRACKS).map((t) => fromDeezer(t, meta));
}

async function deezerPlaylist(id: string): Promise<Track[]> {
  const tracks: Track[] = [];
  let index = 0;
  while (tracks.length < MAX_TRACKS) {
    const page = await deezer<DeezerPage<DeezerTrack>>(`playlist/${id}/tracks?limit=100&index=${index}`);
    tracks.push(...page.data.map((t) => fromDeezer(t)));
    if (!page.next || page.data.length === 0) break;
    index += page.data.length;
  }
  return tracks.slice(0, MAX_TRACKS);
}

export async function searchDeezer(query: string, limit = 12): Promise<Track[]> {
  const page = await deezer<DeezerPage<DeezerTrack>>(`search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return page.data.map((t) => fromDeezer(t));
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

async function followRedirect(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  return res.url;
}

async function resolveUrl(raw: string): Promise<Track[]> {
  let url = new URL(raw);
  let host = url.hostname.replace(/^www\./, "");

  if (host === "link.deezer.com" || host === "deezer.page.link") {
    url = new URL(await followRedirect(url.href));
    host = url.hostname.replace(/^www\./, "");
  }

  if (host === "deezer.com") {
    const match = url.pathname.match(/\/(track|album|playlist)\/(\d+)/);
    if (!match) throw new ResolveError("link do Deezer que eu não entendi");
    const [, kind, id] = match;
    if (kind === "track") return [fromDeezer(await deezer<DeezerTrack>(`track/${id}`))];
    if (kind === "album") return deezerAlbum(id);
    return deezerPlaylist(id);
  }

  if (host === "open.spotify.com") {
    url.search = "";
    url.pathname = url.pathname.replace(/^\/intl-[a-z-]+/i, "");
    if (url.pathname.startsWith("/playlist/")) {
      throw new ResolveError("playlist do Spotify ainda não rola. Cola as faixas, ou a mesma playlist pelo Deezer");
    }
  }

  if (/^(m\.|music\.)?youtube\.com$/.test(host)) {
    const v = url.searchParams.get("v");
    if (!v) {
      if (url.searchParams.has("list")) {
        throw new ResolveError("playlist do YouTube ainda não rola. Cola as faixas uma por uma");
      }
    } else {
      url.search = `?v=${v}`;
    }
  }

  const data = await odesli(url.href);
  const entity = data.entitiesByUniqueId[data.entityUniqueId];
  if (entity?.type === "album") {
    // Albums from any service get expanded through their Deezer equivalent.
    const deezerId = data.linksByPlatform.deezer?.url.match(/\/album\/(\d+)/)?.[1];
    if (deezerId) return deezerAlbum(deezerId);
    throw new ResolveError("achei o álbum, mas não consegui abrir as faixas");
  }
  return [trackFromOdesli(data)];
}

async function searchFirst(query: string): Promise<Track[]> {
  const [first] = await searchDeezer(query, 1);
  if (!first) throw new ResolveError("não achei nada com esse nome");
  return [first];
}

export interface ResolveResult {
  tracks: Track[];
  errors: { input: string; message: string }[];
}

/** Each line is either one or more links, or a free-text search like "artista - música". */
export async function resolveInput(input: string): Promise<ResolveResult> {
  const result: ResolveResult = { tracks: [], errors: [] };
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100);

  for (const line of lines) {
    const urls = line.match(/https?:\/\/\S+/g);
    for (const item of urls ?? [line]) {
      if (result.tracks.length >= MAX_TRACKS) break;
      try {
        result.tracks.push(...(urls ? await resolveUrl(item) : await searchFirst(item)));
      } catch (err) {
        if (!(err instanceof ResolveError)) console.error("[resolve]", item, err);
        result.errors.push({
          input: item,
          message: err instanceof ResolveError ? err.message : "não deu pra ler esse link",
        });
      }
    }
  }

  result.tracks = result.tracks.slice(0, MAX_TRACKS);
  return result;
}

/**
 * Fills in the missing platform links for a saved track. Called lazily when
 * someone clicks a platform, which spreads Odesli calls out over time.
 * Throws RateLimited so the caller can retry later instead of caching a miss.
 */
export async function lookupLinks(track: Track): Promise<Links> {
  const source = track.links.deezer ?? track.links.spotify ?? Object.values(track.links)[0];
  let links: Links = {};

  if (source) {
    try {
      links = linksFromOdesli(await odesli(source, { retries: 0 }));
    } catch (err) {
      if (err instanceof RateLimited) throw err;
    }
  }

  if (!links.deezer && track.isrc) {
    try {
      links.deezer = (await deezer<DeezerTrack>(`track/isrc:${track.isrc}`)).link;
    } catch {
      // fall back to a search link
    }
  }

  return links;
}
