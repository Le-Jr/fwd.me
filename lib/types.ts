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
  title: string;
  note: string | null;
  author: string | null;
  createdAt: number;
  tracks: StoredTrack[];
}
