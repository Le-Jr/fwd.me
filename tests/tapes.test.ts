import { describe, expect, it } from "vitest";
import { hashSeed, TAPES, tapeFor } from "@/lib/tapes";

describe("tapeFor", () => {
  it("is stable for the same seed, ignoring case and outer spaces", () => {
    expect(tapeFor("Negro Drama")).toBe(tapeFor("Negro Drama"));
    expect(tapeFor("  negro drama ")).toBe(tapeFor("Negro Drama"));
  });

  it("falls back to the house tape without a seed", () => {
    expect(tapeFor("")).toBe(TAPES[0]);
    expect(tapeFor(null)).toBe(TAPES[0]);
    expect(tapeFor(undefined)).toBe(TAPES[0]);
  });

  it("spreads different seeds across the palettes", () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => tapeFor(`https://www.deezer.com/track/${i}`).name));
    expect(used.size).toBe(TAPES.length);
  });

  it("hashes to an unsigned 32-bit integer", () => {
    for (const s of ["", "a", "fwd.fm", "ação 🎧"]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});
