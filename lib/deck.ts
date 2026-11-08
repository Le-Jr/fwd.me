/** one side of a C90: how much music the deck's tape "holds" */
export const SIDE_SECONDS = 45 * 60;

/** mm:ss for the deck display, zero-padded like an LCD counter */
export function deckClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Where a track opened in another app probably is now. We never see the other
 * app's playback, so this estimates from when it was opened and its length.
 */
export function playProgress(openedAt: number, now: number, duration: number | undefined) {
  const length = duration && duration > 0 ? duration : 210;
  const elapsed = Math.max(0, (now - openedAt) / 1000);
  return { elapsed: Math.min(elapsed, length), length, progress: Math.min(1, elapsed / length), done: elapsed >= length };
}
