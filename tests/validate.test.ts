import { describe, expect, it } from "vitest";
import { cleanString, cleanTrack } from "@/lib/validate";

const base = { title: "Oceano", artist: "Djavan", links: { deezer: "https://www.deezer.com/track/1" } };

describe("cleanString", () => {
  it("trims, caps length and drops non-strings", () => {
    expect(cleanString("  oi  ", 10)).toBe("oi");
    expect(cleanString("abcdef", 3)).toBe("abc");
    expect(cleanString(42, 10)).toBe("");
    expect(cleanString(undefined, 10)).toBe("");
  });
});

describe("cleanTrack", () => {
  it("keeps a valid track", () => {
    expect(cleanTrack(base)).toEqual({
      title: "Oceano",
      artist: "Djavan",
      album: undefined,
      cover: undefined,
      isrc: undefined,
      duration: undefined,
      links: { deezer: "https://www.deezer.com/track/1" },
    });
  });

  it("rejects non-objects, missing titles and tracks with no trusted link", () => {
    expect(cleanTrack(null)).toBeNull();
    expect(cleanTrack("x")).toBeNull();
    expect(cleanTrack({ ...base, title: "  " })).toBeNull();
    expect(cleanTrack({ ...base, links: { deezer: "https://evil.com/x" } })).toBeNull();
  });

  it("drops untrusted links and unknown platforms but keeps the rest", () => {
    const t = cleanTrack({
      ...base,
      links: { deezer: base.links.deezer, spotify: "https://evil.com", apple: "https://music.apple.com/x" },
    });
    expect(t?.links).toEqual({ deezer: base.links.deezer });
  });

  it("normalizes optional fields", () => {
    const t = cleanTrack({
      ...base,
      artist: "",
      isrc: "brbmg0300729",
      duration: "212.6",
      cover: "http://insecure.example/c.jpg",
    });
    expect(t?.artist).toBe("Artista desconhecido");
    expect(t?.isrc).toBe("BRBMG0300729");
    expect(t?.duration).toBe(213);
    expect(t?.cover).toBeUndefined();
  });

  it("ignores malformed isrc and non-positive durations", () => {
    const t = cleanTrack({ ...base, isrc: "123", duration: -5 });
    expect(t?.isrc).toBeUndefined();
    expect(t?.duration).toBeUndefined();
  });
});
