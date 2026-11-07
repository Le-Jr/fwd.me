import { describe, expect, it } from "vitest";
import { parseYoutubeTitle, youtubeId } from "@/lib/resolve";

describe("parseYoutubeTitle", () => {
  it("splits 'Artist - Song' and drops video noise", () => {
    expect(parseYoutubeTitle("Djavan - Oceano (Áudio Oficial)", "DjavanOficial")).toEqual({
      artist: "Djavan",
      title: "Oceano",
    });
    expect(parseYoutubeTitle("Daft Punk - One More Time [Official Video]", "Daft Punk")).toEqual({
      artist: "Daft Punk",
      title: "One More Time",
    });
  });

  it("uses the channel when the title has no artist, cleaning Topic/VEVO", () => {
    expect(parseYoutubeTitle("Azul Da Cor Do Mar", "Tim Maia - Topic")).toEqual({
      artist: "Tim Maia",
      title: "Azul Da Cor Do Mar",
    });
    expect(parseYoutubeTitle("Envolver (Clipe Oficial)", "AnittaVEVO")).toEqual({
      artist: "Anitta",
      title: "Envolver",
    });
  });
});

describe("youtubeId", () => {
  it("reads ids from watch, music and short links", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=FGBhQbmPwH8&t=10")).toBe("FGBhQbmPwH8");
    expect(youtubeId("https://music.youtube.com/watch?v=FGBhQbmPwH8")).toBe("FGBhQbmPwH8");
    expect(youtubeId("https://youtu.be/FGBhQbmPwH8")).toBe("FGBhQbmPwH8");
  });

  it("returns null when there is no id", () => {
    expect(youtubeId("https://www.youtube.com/")).toBeNull();
    expect(youtubeId("https://youtu.be/")).toBeNull();
    expect(youtubeId("")).toBeNull();
  });
});
