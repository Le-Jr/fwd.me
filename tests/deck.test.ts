import { describe, expect, it } from "vitest";
import { deckClock, playProgress } from "@/lib/deck";

describe("deckClock", () => {
  it("pads minutes and seconds", () => {
    expect(deckClock(0)).toBe("00:00");
    expect(deckClock(318.7)).toBe("05:18");
    expect(deckClock(2700)).toBe("45:00");
    expect(deckClock(-4)).toBe("00:00");
  });
});

describe("playProgress", () => {
  it("estimates position from when the track was opened", () => {
    expect(playProgress(0, 60_000, 240)).toEqual({ elapsed: 60, length: 240, progress: 0.25, done: false });
  });

  it("stops at the end of the track", () => {
    expect(playProgress(0, 300_000, 240)).toEqual({ elapsed: 240, length: 240, progress: 1, done: true });
  });

  it("assumes a typical length when the duration is unknown", () => {
    expect(playProgress(0, 105_000, undefined).length).toBe(210);
    expect(playProgress(0, 105_000, 0).progress).toBe(0.5);
  });
});
