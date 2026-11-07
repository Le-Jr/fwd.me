import { describe, expect, it } from "vitest";
import { needsLinks, withYoutubePair } from "@/lib/mixLinks";
import type { StoredTrack } from "@/lib/types";

const track = (over: Partial<StoredTrack>): StoredTrack => ({
  id: "t1",
  position: 0,
  title: "Oceano",
  artist: "Djavan",
  links: {},
  resolvedAt: null,
  ...over,
});

describe("withYoutubePair", () => {
  it("derives YouTube Music from YouTube and back", () => {
    expect(withYoutubePair({ youtube: "https://www.youtube.com/watch?v=abcdefghijk" })).toEqual({
      youtube: "https://www.youtube.com/watch?v=abcdefghijk",
      ytmusic: "https://music.youtube.com/watch?v=abcdefghijk",
    });
    expect(withYoutubePair({ ytmusic: "https://music.youtube.com/watch?v=abcdefghijk" }).youtube).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
  });

  it("leaves links without a video untouched", () => {
    const links = { deezer: "https://www.deezer.com/track/1" };
    expect(withYoutubePair(links)).toBe(links);
  });
});

describe("needsLinks", () => {
  it("wants never-resolved tracks", () => {
    expect(needsLinks(track({}))).toBe(true);
  });

  it("re-checks old lookups that predate the YouTube search, once", () => {
    const old = Date.UTC(2026, 0, 1);
    expect(needsLinks(track({ resolvedAt: old }))).toBe(true);
    expect(needsLinks(track({ resolvedAt: old, links: { youtube: "https://youtu.be/abcdefghijk" } }))).toBe(false);
    expect(needsLinks(track({ resolvedAt: Date.UTC(2027, 0, 1) }))).toBe(false);
  });
});
