import { isTrustedLink } from "./platforms";
import { cacheGet, cacheSet } from "./store";
import type { Links, PlatformId, Track } from "./types";

const DAY = 86_400_000;
const UA = "Mozilla/5.0 (compatible; fwd.fm/0.1; +https://fwd.fm)";
export const MAX_TRACKS = 500;

export class ResolveError extends Error {}

export class RateLimited extends ResolveError {
  constructor() {
    super("muitas buscas seguidas, tenta de novo em 1 minuto");
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * How a link becomes a Track:
 *   1. read title/artist from the source (Deezer API, Spotify page meta, YouTube oEmbed)
 *   2. match it on Deezer, which gives us a Deezer link, cover and ISRC
 *   3. other platforms are filled lazily on click (lookupLinks), falling back
 *      to that platform's search page with "artist title".
 */

// ---------------------------------------------------------------------------
// Deezer: open API, no key. Backbone for search, matching and track lists.
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
  id: number;
  title: string;
  cover_xl?: string;
  cover_big?: string;
  artist?: { name: string };
  tracks: { data: DeezerTrack[] };
}

interface DeezerPage<T> {
  data: T[];
  next?: string;
}

async function deezer<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.deezer.com/${path}`, { cache: "no-store" });
  const data = (await res.json()) as T & { error?: { code?: number } };
  if (data.error?.code === 4) throw new RateLimited();
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

async function deezerAlbum(id: string | number): Promise<Track[]> {
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

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Best Deezer match for a title/artist pair, preferring one whose artist agrees. */
async function matchOnDeezer(artist: string, title: string): Promise<Track | null> {
  const candidates = await searchDeezer(`${artist} ${title}`, 5);
  const wanted = normalize(artist);
  return (
    candidates.find((c) => normalize(c.artist).includes(wanted) || wanted.includes(normalize(c.artist))) ??
    candidates[0] ??
    null
  );
}

// ---------------------------------------------------------------------------
// Source readers for links that are not Deezer.
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Reads the public link-preview tags of an open.spotify.com page. */
async function spotifyMeta(url: string) {
  // No accept-language on purpose: the English tag format below is what we parse.
  const res = await fetch(url, { headers: { "user-agent": UA }, cache: "no-store" });
  if (!res.ok) throw new ResolveError("o Spotify não abriu esse link");
  const html = await res.text();
  const meta = (name: string) => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]*>`))?.[0];
    const content = tag?.match(/content="([^"]*)"/)?.[1];
    return content ? decodeEntities(content) : undefined;
  };
  let title = meta("og:title");
  // og:description looks like "Artist · Album · Song · 1987"
  let artist = meta("music:musician_description") ?? meta("og:description")?.split(" · ")[0];
  // Album pages: "Listen to Discovery - Album by Daft Punk | Spotify"
  const listen = title?.match(/^Listen to (.+) - (?:Album|EP|Single|Compilation) by (.+?) \| Spotify$/i);
  if (listen) {
    title = listen[1];
    artist ??= listen[2];
  }
  if (!title || !artist) throw new ResolveError("não consegui ler esse link do Spotify");
  return { title, artist, cover: meta("og:image") };
}

/** "Artist - Song (Official Video)" by "Artist - Topic" → { artist, title } */
function parseYoutubeTitle(rawTitle: string, author: string) {
  let artist = author.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
  let title = rawTitle
    .replace(/\s*[([][^)\]]*(official|oficial|video|vídeo|clipe|audio|áudio|lyric|letra|visualizer|hd|4k|remaster)[^)\]]*[)\]]/gi, "")
    .trim();
  const dash = title.match(/^(.+?)\s+[-–—|]\s+(.+)$/);
  if (dash) {
    artist = dash[1].trim();
    title = dash[2].trim();
  }
  return { artist, title };
}

async function youtubeMeta(url: string) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new ResolveError("não achei esse vídeo no YouTube");
  const data = (await res.json()) as { title: string; author_name: string; thumbnail_url?: string };
  return { ...parseYoutubeTitle(data.title, data.author_name), cover: data.thumbnail_url };
}

/** Builds a track from source metadata, enriched with its Deezer match when there is one. */
async function withDeezerMatch(source: { title: string; artist: string; cover?: string }, links: Links): Promise<Track> {
  const match = await matchOnDeezer(source.artist, source.title).catch(() => null);
  if (!match) return { title: source.title, artist: source.artist, cover: source.cover, links };
  return { ...match, links: { ...match.links, ...links } };
}

// ---------------------------------------------------------------------------
// Optional direct-link providers (only used when keys are configured).
// ---------------------------------------------------------------------------

const ODESLI_PLATFORMS: [string, PlatformId][] = [
  ["deezer", "deezer"],
  ["spotify", "spotify"],
  ["amazonMusic", "amazon"],
  ["youtubeMusic", "ytmusic"],
  ["youtube", "youtube"],
];

interface OdesliResponse {
  linksByPlatform: Record<string, { url: string } | undefined>;
}

/** song.link closed its public API; this only runs with ODESLI_API_KEY. */
async function odesliLinks(url: string): Promise<Links> {
  const key = process.env.ODESLI_API_KEY;
  if (!key) return {};

  const cacheKey = `odesli:${url}`;
  let data = cacheGet<OdesliResponse>(cacheKey, 7 * DAY);
  if (!data) {
    const params = new URLSearchParams({ url, key, userCountry: process.env.ODESLI_COUNTRY ?? "BR" });
    const res = await fetch(`https://api.song.link/v1-alpha.1/links?${params}`, { cache: "no-store" });
    if (res.status === 429) throw new RateLimited();
    if (!res.ok) return {};
    data = (await res.json()) as OdesliResponse;
    cacheSet(cacheKey, data);
  }

  const links: Links = {};
  for (const [name, id] of ODESLI_PLATFORMS) {
    const link = data.linksByPlatform[name]?.url;
    if (link && isTrustedLink(id, link)) links[id] = link;
  }
  return links;
}

async function spotifyToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  const cached = cacheGet<string>("spotify:token", 50 * 60 * 1000);
  if (cached) return cached;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { access_token } = (await res.json()) as { access_token: string };
  cacheSet("spotify:token", access_token);
  return access_token;
}

async function spotifyByIsrc(isrc: string): Promise<string | undefined> {
  const token = await spotifyToken();
  if (!token) return undefined;
  const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(`isrc:${isrc}`)}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 429) throw new RateLimited();
  if (!res.ok) return undefined;
  const data = (await res.json()) as { tracks?: { items?: { external_urls?: { spotify?: string } }[] } };
  return data.tracks?.items?.[0]?.external_urls?.spotify;
}

// ---------------------------------------------------------------------------
// YouTube: no key. Reads the first video of the public search page so every
// track gets a video id (used for direct links and the "play all" playlist).
// ---------------------------------------------------------------------------

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

/** Video id of the top search result, cached (misses for a day, hits for a month). */
async function youtubeSearch(artist: string, title: string): Promise<string | null> {
  const query = `${artist} ${title}`;
  const cacheKey = `yt:${normalize(query)}`;
  const cached = cacheGet<{ id: string | null }>(cacheKey, 30 * DAY);
  if (cached && (cached.id || cacheGet(cacheKey, DAY))) return cached.id;

  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
    headers: { "user-agent": BROWSER_UA, "accept-language": "en" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const id = (await res.text()).match(/"videoRenderer":\{"videoId":"([\w-]{11})"/)?.[1] ?? null;
  cacheSet(cacheKey, { id });
  return id;
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

async function followRedirect(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, cache: "no-store" });
  return res.url;
}

async function resolveUrl(raw: string): Promise<Track[]> {
  let url = new URL(raw);
  let host = url.hostname.replace(/^www\./, "");

  if (["link.deezer.com", "deezer.page.link", "spotify.link"].includes(host)) {
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
    const match = url.pathname.match(/\/(track|album|playlist)\/([A-Za-z0-9]+)/);
    if (!match) throw new ResolveError("link do Spotify que eu não entendi");
    const [, kind, id] = match;
    if (kind === "playlist") {
      throw new ResolveError("playlist do Spotify ainda não rola. Cola as faixas, ou a mesma playlist pelo Deezer");
    }
    const clean = `https://open.spotify.com/${kind}/${id}`;
    const meta = await spotifyMeta(clean);
    if (kind === "album") {
      const page = await deezer<DeezerPage<DeezerAlbum>>(
        `search/album?q=${encodeURIComponent(`${meta.artist} ${meta.title}`)}&limit=1`,
      );
      if (!page.data[0]) throw new ResolveError("não achei esse álbum fora do Spotify");
      return deezerAlbum(page.data[0].id);
    }
    return [await withDeezerMatch(meta, { spotify: clean })];
  }

  if (/^(m\.|music\.)?youtube\.com$|^youtu\.be$/.test(host)) {
    const v = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
    if (!v) {
      throw new ResolveError(
        url.searchParams.has("list")
          ? "playlist do YouTube ainda não rola. Cola as faixas uma por uma"
          : "link do YouTube que eu não entendi",
      );
    }
    const isMusic = host === "music.youtube.com";
    const clean = `https://${isMusic ? "music" : "www"}.youtube.com/watch?v=${v}`;
    const meta = await youtubeMeta(clean);
    return [await withDeezerMatch(meta, isMusic ? { ytmusic: clean } : { youtube: clean })];
  }

  if (/(^|\.)amazon\./.test(host)) {
    throw new ResolveError("link da Amazon ainda não dá pra ler. Busca pelo nome que eu acho");
  }

  throw new ResolveError("esse site eu ainda não conheço");
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
      // Deezer allows ~50 requests / 5s; keep long pastes polite.
      if (lines.length > 10) await sleep(120);
    }
  }

  result.tracks = result.tracks.slice(0, MAX_TRACKS);
  return result;
}

/**
 * Fills in missing platform links for a saved track. Runs lazily when someone
 * clicks a platform. Throws RateLimited so the caller can retry later instead
 * of remembering a miss.
 */
export async function lookupLinks(track: Track): Promise<Links> {
  const source = track.links.deezer ?? track.links.spotify ?? Object.values(track.links)[0];
  const links: Links = source ? await odesliLinks(source) : {};

  if (!links.deezer && !track.links.deezer) {
    try {
      links.deezer = track.isrc
        ? (await deezer<DeezerTrack>(`track/isrc:${track.isrc}`)).link
        : (await matchOnDeezer(track.artist, track.title))?.links.deezer;
    } catch (err) {
      if (err instanceof RateLimited) throw err;
    }
  }

  if (!links.spotify && !track.links.spotify && track.isrc) {
    links.spotify = await spotifyByIsrc(track.isrc);
  }

  // one video id serves both YouTube and YouTube Music
  const known = links.youtube ?? track.links.youtube ?? links.ytmusic ?? track.links.ytmusic;
  const videoId = known ? youtubeId(known) : await youtubeSearch(track.artist, track.title).catch(() => null);
  if (videoId) {
    if (!links.youtube && !track.links.youtube) links.youtube = `https://www.youtube.com/watch?v=${videoId}`;
    if (!links.ytmusic && !track.links.ytmusic) links.ytmusic = `https://music.youtube.com/watch?v=${videoId}`;
  }

  for (const key of Object.keys(links) as PlatformId[]) {
    if (!links[key]) delete links[key];
  }
  return links;
}
