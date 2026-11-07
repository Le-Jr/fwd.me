import { describe, expect, it } from "vitest";
import { getPlatform, isPlatformId, isTrustedLink, PLATFORMS } from "@/lib/platforms";

describe("isTrustedLink", () => {
  it("accepts each platform's own https hosts", () => {
    expect(isTrustedLink("spotify", "https://open.spotify.com/track/abc")).toBe(true);
    expect(isTrustedLink("deezer", "https://www.deezer.com/track/1")).toBe(true);
    expect(isTrustedLink("deezer", "https://deezer.com/track/1")).toBe(true);
    expect(isTrustedLink("youtube", "https://youtu.be/FGBhQbmPwH8")).toBe(true);
    expect(isTrustedLink("youtube", "https://m.youtube.com/watch?v=x")).toBe(true);
    expect(isTrustedLink("ytmusic", "https://music.youtube.com/watch?v=x")).toBe(true);
    expect(isTrustedLink("amazon", "https://music.amazon.com.br/albums/x")).toBe(true);
  });

  it("rejects http, other hosts and look-alike domains (open redirect guard)", () => {
    expect(isTrustedLink("spotify", "http://open.spotify.com/track/abc")).toBe(false);
    expect(isTrustedLink("spotify", "https://evil.com/open.spotify.com")).toBe(false);
    expect(isTrustedLink("spotify", "https://open.spotify.com.evil.com/track")).toBe(false);
    expect(isTrustedLink("youtube", "https://music.youtube.com/watch?v=x")).toBe(false);
    expect(isTrustedLink("deezer", "javascript:alert(1)")).toBe(false);
    expect(isTrustedLink("deezer", "not a url")).toBe(false);
  });
});

describe("platform lookup", () => {
  it("finds every platform by id", () => {
    for (const p of PLATFORMS) {
      expect(getPlatform(p.id)).toBe(p);
      expect(isPlatformId(p.id)).toBe(true);
    }
    expect(getPlatform("apple")).toBeUndefined();
    expect(isPlatformId("apple")).toBe(false);
  });

  it("builds encoded search URLs", () => {
    expect(getPlatform("youtube")!.search("Tim Maia & Cia")).toBe(
      "https://www.youtube.com/results?search_query=Tim%20Maia%20%26%20Cia",
    );
  });
});
