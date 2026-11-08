/**
 * Cassette looks. A tape's palette is derived from a stable seed (a track's
 * link, a mix subject), so the same song or mix always gets the same tape.
 * Curated instead of random colors, so every combination stays on-brand.
 */

export interface TapePalette {
  name: string;
  shell: string;
  bottom: string;
  label: string;
  ink: string;
  /** three stops of the band around the window */
  band: [string, string, string];
}

export const TAPES: readonly TapePalette[] = [
  { name: "neon", shell: "#1b1a2a", bottom: "#252338", label: "#f2f0ff", ink: "#10101a", band: ["#ff3df2", "#c6ff3d", "#3df2ff"] },
  { name: "cromo", shell: "#8d93a5", bottom: "#a4aabb", label: "#eef0f5", ink: "#1a1d26", band: ["#5b6070", "#d9dde6", "#5b6070"] },
  { name: "cristal", shell: "rgba(205, 225, 255, 0.22)", bottom: "rgba(205, 225, 255, 0.3)", label: "#ffffff", ink: "#111522", band: ["#3df2ff", "#7a8cff", "#3df2ff"] },
  { name: "setentinha", shell: "#2b1d14", bottom: "#3a281b", label: "#f3e6c8", ink: "#3a1f0e", band: ["#c2410c", "#ff7a1a", "#ffb21a"] },
  { name: "ouro", shell: "#0c0b10", bottom: "#17151e", label: "#17151e", ink: "#e8c46a", band: ["#8a6420", "#e8c46a", "#8a6420"] },
  { name: "estúdio", shell: "#ecebf0", bottom: "#d6d5dd", label: "#ffffff", ink: "#1a1a1a", band: ["#e11d2e", "#e11d2e", "#1a1a1a"] },
  { name: "vaporwave", shell: "#2a1640", bottom: "#371d55", label: "#fde2ff", ink: "#2a1640", band: ["#ff71ce", "#b967ff", "#01cdfe"] },
  { name: "menta", shell: "#12322b", bottom: "#1a443b", label: "#e7fff6", ink: "#0c241f", band: ["#2dd4bf", "#a3e635", "#facc15"] },
];

/** FNV-1a: tiny, stable across runtimes, good enough spread for picking a palette. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function tapeFor(seed: string | null | undefined): TapePalette {
  if (!seed) return TAPES[0];
  return TAPES[hashSeed(seed.trim().toLowerCase()) % TAPES.length];
}
