export function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h${String(m).padStart(2, "0")}`;
  }
  if (seconds >= 600) return `${Math.round(seconds / 60)} min`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function totalDuration(tracks: { duration?: number }[]): number {
  return tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
}
