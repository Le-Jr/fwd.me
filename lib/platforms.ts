import type { CSSProperties } from "react";
import type { PlatformId } from "./types";

export interface Platform {
  id: PlatformId;
  name: string;
  /** two-letter tag shown in the UI instead of brand logos */
  code: string;
  color: string;
  ink: string;
  hosts: RegExp;
  search: (query: string) => string;
}

const enc = encodeURIComponent;

export const PLATFORMS: Platform[] = [
  {
    id: "spotify",
    name: "Spotify",
    code: "SP",
    color: "#1ed760",
    ink: "#04130a",
    hosts: /^open\.spotify\.com$/,
    search: (q) => `https://open.spotify.com/search/${enc(q)}`,
  },
  {
    id: "ytmusic",
    name: "YouTube Music",
    code: "YM",
    color: "#ff5b4f",
    ink: "#1a0503",
    hosts: /^music\.youtube\.com$/,
    search: (q) => `https://music.youtube.com/search?q=${enc(q)}`,
  },
  {
    id: "youtube",
    name: "YouTube",
    code: "YT",
    color: "#ff1744",
    ink: "#ffffff",
    hosts: /^((www|m)\.)?youtube\.com$|^youtu\.be$/,
    search: (q) => `https://www.youtube.com/results?search_query=${enc(q)}`,
  },
  {
    id: "deezer",
    name: "Deezer",
    code: "DZ",
    color: "#a64dff",
    ink: "#ffffff",
    hosts: /^(www\.)?deezer\.com$/,
    search: (q) => `https://www.deezer.com/search/${enc(q)}`,
  },
  {
    id: "amazon",
    name: "Amazon Music",
    code: "AM",
    color: "#25d1da",
    ink: "#03181a",
    hosts: /^(music\.)?amazon\.[a-z.]+$/,
    search: (q) => `https://music.amazon.com/search/${enc(q)}`,
  },
];

export function getPlatform(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function isPlatformId(id: string): id is PlatformId {
  return PLATFORMS.some((p) => p.id === id);
}

/** Links are later used as redirect targets, so only accept the platform's own hosts. */
export function isTrustedLink(id: PlatformId, url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && getPlatform(id)!.hosts.test(u.hostname);
  } catch {
    return false;
  }
}

export function platformStyle(p: Platform): CSSProperties {
  return { "--c": p.color, "--ink": p.ink } as CSSProperties;
}
