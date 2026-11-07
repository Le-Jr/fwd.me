export type PlatformId = "spotify" | "ytmusic" | "youtube" | "deezer" | "amazon";

export type Links = Partial<Record<PlatformId, string>>;

export interface Track {
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  isrc?: string;
  /** seconds */
  duration?: number;
  links: Links;
}

export interface StoredTrack extends Track {
  id: string;
  position: number;
  resolvedAt: number | null;
}

export interface Mix {
  id: string;
  /**
   * Subject, note and sender, AES-GCM encrypted in the browser (lib/crypto.ts).
   * The key lives only in the share link's #fragment. Null on legacy mixes,
   * created before encryption, which keep those fields in plaintext below.
   */
  secret: string | null;
  /** legacy plaintext fields: empty / null on encrypted mixes */
  title: string;
  note: string | null;
  author: string | null;
  createdAt: number;
  tracks: StoredTrack[];
}
