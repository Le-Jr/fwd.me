import { describe, expect, it } from "vitest";
import { formatDuration, totalDuration } from "@/lib/format";

describe("formatDuration", () => {
  it("uses m:ss under 10 minutes", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(212)).toBe("3:32");
  });

  it("rounds to minutes from 10 minutes and to h00 from an hour", () => {
    expect(formatDuration(1440)).toBe("24 min");
    expect(formatDuration(3600 + 25 * 60)).toBe("1h25");
    expect(formatDuration(7200)).toBe("2h00");
  });
});

describe("totalDuration", () => {
  it("sums known durations and skips missing ones", () => {
    expect(totalDuration([{ duration: 100 }, {}, { duration: 50 }])).toBe(150);
    expect(totalDuration([])).toBe(0);
  });
});
