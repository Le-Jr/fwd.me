import type { PlatformId } from "./types";

/**
 * Client-side helpers for handing a track over to the listener's streaming app.
 *
 * - iOS: a direct https link tapped in the same tab triggers Universal Links,
 *   which open the app when installed. Custom schemes are avoided there because
 *   Safari shows an "invalid address" alert when the app is missing.
 * - Android: an intent:// URL targets the app package and carries the web link
 *   as browser_fallback_url, so Chrome opens the web page when the app is missing.
 * - Desktop: Spotify and Deezer register URI schemes; we try the app first and
 *   open the web player if the page never loses focus.
 */

export type Device = "ios" | "android" | "desktop";

const ANDROID_PACKAGES: Record<PlatformId, string> = {
  spotify: "com.spotify.music",
  ytmusic: "com.google.android.apps.youtube.music",
  youtube: "com.google.android.youtube",
  deezer: "deezer.android.app",
  amazon: "com.amazon.mp3",
};

export function detectDevice(ua: string, maxTouchPoints = 0): Device {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS reports itself as a Mac; touch support gives it away
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  return "desktop";
}

const IN_APP_BROWSERS: [RegExp, string][] = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB/i, "Facebook"],
  [/WhatsApp/i, "WhatsApp"],
  [/musical_ly|TikTok|BytedanceWebview/i, "TikTok"],
  [/Twitter/i, "X"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Snapchat/i, "Snapchat"],
  [/Line\//i, "LINE"],
  [/Telegram/i, "Telegram"],
];

/** Name of the app whose embedded browser we're in, or null for a real browser. */
export function inAppBrowser(ua: string): string | null {
  for (const [re, name] of IN_APP_BROWSERS) if (re.test(ua)) return name;
  return null;
}

/** `spotify:track:ID` / `deezer://www.deezer.com/track/ID` for desktop apps. */
export function appUri(platform: PlatformId, webUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(webUrl);
  } catch {
    return null;
  }
  const kind = "(track|album|playlist|artist|episode|show)";
  if (platform === "spotify") {
    const m = u.pathname.match(new RegExp(`/${kind}/([A-Za-z0-9]+)`));
    return m ? `spotify:${m[1]}:${m[2]}` : null;
  }
  if (platform === "deezer") {
    const m = u.pathname.match(new RegExp(`/${kind}/(\\d+)`));
    return m ? `deezer://www.deezer.com/${m[1]}/${m[2]}` : null;
  }
  return null;
}

/** intent:// link that opens the app on Android and falls back to the web page. */
export function androidIntent(platform: PlatformId, webUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(webUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  return (
    `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;` +
    `package=${ANDROID_PACKAGES[platform]};` +
    `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
  );
}

/**
 * Desktop: try the app's URI scheme, then open the web player in a new tab if
 * the browser keeps focus (app missing or the prompt was dismissed).
 */
export function openDesktopApp(uri: string, webUrl: string, waitMs = 1500): void {
  let left = false;
  const onLeave = () => {
    left = true;
  };
  const onVisibility = () => {
    if (document.hidden) left = true;
  };
  window.addEventListener("blur", onLeave);
  window.addEventListener("pagehide", onLeave);
  document.addEventListener("visibilitychange", onVisibility);

  window.location.href = uri;

  window.setTimeout(() => {
    window.removeEventListener("blur", onLeave);
    window.removeEventListener("pagehide", onLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    if (left) return;
    // no "noopener" feature here: it makes window.open return null, hiding a blocked popup
    const tab = window.open(webUrl, "_blank");
    if (tab) tab.opener = null;
    else window.location.href = webUrl;
  }, waitMs);
}
