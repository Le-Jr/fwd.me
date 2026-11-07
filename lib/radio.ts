/**
 * Picks a random playable track from Deezer for the floating radio.
 *
 * Deezer has no "random track" endpoint, and probing random ids mostly hits
 * dead entries. Instead we search a random seed word at a random offset, which
 * reaches deep into the catalog, not just the charts.
 */

export interface RadioTrack {
  title: string;
  artist: string;
  cover?: string;
  /** 30s MP3 preview (signed URL that expires, so never cache it for long) */
  preview: string;
  link: string;
}

interface DeezerSearchTrack {
  title: string;
  link: string;
  preview?: string;
  readable?: boolean;
  artist: { name: string };
  album?: { cover_medium?: string; cover_big?: string };
}

// short, common words across languages and genres so results stay varied
const SEEDS = [
  "amor", "love", "noite", "night", "sol", "sun", "coração", "heart", "baby", "fire",
  "lua", "moon", "dance", "samba", "funk", "rock", "jazz", "blues", "soul", "pop",
  "house", "disco", "reggae", "forró", "pagode", "mpb", "bossa", "rap", "trap", "indie",
  "dream", "city", "rain", "chuva", "mar", "ocean", "summer", "verão", "fly", "gold",
  "blue", "azul", "vida", "life", "time", "tempo", "home", "casa", "free", "wild",
  "girl", "boy", "party", "festa", "saudade", "corazón", "noche", "fiesta", "électro", "nuit",
];

const rand = (n: number) => Math.floor(Math.random() * n);

export async function randomTrack(): Promise<RadioTrack | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const q = SEEDS[rand(SEEDS.length)];
    // deeper offsets thin out on rarer seeds; retries cover empty pages
    const index = rand(attempt === 0 ? 300 : 100);
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&index=${index}&limit=50`, {
      cache: "no-store",
    });
    if (!res.ok) continue;
    const page = (await res.json()) as { data?: DeezerSearchTrack[] };
    const playable = (page.data ?? []).filter((t) => t.preview && t.readable !== false);
    if (!playable.length) continue;
    const t = playable[rand(playable.length)];
    return {
      title: t.title,
      artist: t.artist.name,
      cover: t.album?.cover_medium ?? t.album?.cover_big,
      preview: t.preview!,
      link: t.link,
    };
  }
  return null;
}
