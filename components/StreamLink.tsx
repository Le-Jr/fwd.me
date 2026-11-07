"use client";

import { androidIntent, appUri, openDesktopApp, type Device } from "@/lib/open";
import { platformStyle, type Platform } from "@/lib/platforms";
import type { StoredTrack } from "@/lib/types";

interface StreamLinkProps {
  platform: Platform;
  /** direct platform URL, when known */
  web?: string;
  /** where to go when there is no direct URL (our /go lookup) */
  fallback: string;
  device: Device;
  /** inside an app's embedded browser, where intent:// may not be handled */
  embedded: boolean;
  /** runs before the browser follows the link */
  onOpen?: () => void;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}

/**
 * A link into a streaming platform that prefers the installed app: direct URLs
 * on iOS (Universal Links fire on tap), intent:// with web fallback on Android,
 * and the URI scheme with web fallback for Spotify/Deezer on desktop.
 */
export function StreamLink({ platform, web, fallback, device, embedded, onOpen, children, ...rest }: StreamLinkProps) {
  let href = web ?? fallback;
  if (web && device === "android" && !embedded) href = androidIntent(platform.id, web) ?? web;

  const uri = web && device === "desktop" ? appUri(platform.id, web) : null;

  return (
    <a
      {...rest}
      href={href}
      // mobile stays in the same tab: a new tab gets in the way of handing off to the app
      target={device === "desktop" ? "_blank" : undefined}
      rel="noopener"
      style={platformStyle(platform)}
      onClick={(e) => {
        onOpen?.();
        if (!uri || !web || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openDesktopApp(uri, web);
      }}
    >
      {children}
    </a>
  );
}

type TrackLinkProps = Omit<StreamLinkProps, "web" | "fallback"> & { track: StoredTrack };

/** StreamLink for one track; unknown links go through /go, which looks them up on click. */
export function TrackLink({ track, platform, ...rest }: TrackLinkProps) {
  return (
    <StreamLink
      platform={platform}
      web={track.links[platform.id]}
      fallback={`/go/${track.id}/${platform.id}`}
      {...rest}
    />
  );
}
