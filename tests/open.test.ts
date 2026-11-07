import { describe, expect, it } from "vitest";
import { androidIntent, appUri, detectDevice, inAppBrowser } from "@/lib/open";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

describe("detectDevice", () => {
  it("tells iOS, Android and desktop apart", () => {
    expect(detectDevice(IPHONE)).toBe("ios");
    expect(detectDevice(ANDROID)).toBe("android");
    expect(detectDevice(MAC)).toBe("desktop");
  });

  it("spots iPadOS pretending to be a Mac via touch points", () => {
    expect(detectDevice(MAC, 5)).toBe("ios");
  });
});

describe("inAppBrowser", () => {
  it("names embedded browsers and ignores real ones", () => {
    expect(inAppBrowser(`${IPHONE} Instagram 350.0.0`)).toBe("Instagram");
    expect(inAppBrowser(`${ANDROID} [FB_IAB/FB4A;FBAV/400.0]`)).toBe("Facebook");
    expect(inAppBrowser(`${ANDROID} musical_ly_2023`)).toBe("TikTok");
    expect(inAppBrowser(IPHONE)).toBeNull();
    expect(inAppBrowser(ANDROID)).toBeNull();
  });
});

describe("appUri", () => {
  it("maps Spotify web links to spotify: URIs", () => {
    expect(appUri("spotify", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x")).toBe(
      "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
    );
    expect(appUri("spotify", "https://open.spotify.com/intl-pt/album/abc123")).toBe("spotify:album:abc123");
  });

  it("maps Deezer web links to deezer:// URIs", () => {
    expect(appUri("deezer", "https://www.deezer.com/br/track/3135553")).toBe("deezer://www.deezer.com/track/3135553");
  });

  it("returns null for platforms without a scheme and for junk", () => {
    expect(appUri("youtube", "https://www.youtube.com/watch?v=x")).toBeNull();
    expect(appUri("spotify", "https://open.spotify.com/")).toBeNull();
    expect(appUri("spotify", "nope")).toBeNull();
  });
});

describe("androidIntent", () => {
  it("targets the app package with the web link as fallback", () => {
    const url = "https://www.youtube.com/watch?v=FGBhQbmPwH8&list=TLGG1";
    expect(androidIntent("youtube", url)).toBe(
      "intent://www.youtube.com/watch?v=FGBhQbmPwH8&list=TLGG1#Intent;scheme=https;" +
        "package=com.google.android.youtube;" +
        `S.browser_fallback_url=${encodeURIComponent(url)};end`,
    );
  });

  it("refuses non-https links", () => {
    expect(androidIntent("deezer", "http://www.deezer.com/track/1")).toBeNull();
    expect(androidIntent("deezer", "garbage")).toBeNull();
  });
});
