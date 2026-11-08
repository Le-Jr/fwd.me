"use client";

import { useEffect, useState } from "react";
import TapeDeck from "./TapeDeck";
import { deckClock, playProgress } from "@/lib/deck";
import { tapeFor } from "@/lib/tapes";
import type { StoredTrack } from "@/lib/types";

export interface NowPlaying {
  index: number;
  /** Date.now() when the track was opened */
  at: number;
}

type Props = {
  tracks: StoredTrack[];
  now: NowPlaying | null;
  /** mix subject, or null while locked/decrypting */
  subject: string | null;
  mixId: string;
  platformName: string | null;
};

/**
 * The deck on a mix page. Before anything plays it holds the mix's own tape;
 * opening a track swaps in that song's tape, and the reels turn for roughly as
 * long as the song lasts (the music plays in another app, so it is an estimate).
 */
export default function MixDeck({ tracks, now, subject, mixId, platformName }: Props) {
  const [clock, setClock] = useState(() => Date.now());
  const track = now ? tracks[now.index] : null;
  const pos = now && track ? playProgress(now.at, clock, track.duration) : null;

  const done = pos?.done ?? false;
  useEffect(() => {
    if (!now || done) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [now, done]);

  if (!track || !pos) {
    return (
      <TapeDeck
        className="deck-big"
        tape={{
          key: "mix",
          label: `FWD: ${subject ?? "fita trancada"}`,
          palette: tapeFor(subject ?? mixId),
          progress: 0,
        }}
        active="stop"
        lcd={<span>PRONTO · {String(tracks.length).padStart(2, "0")} FX</span>}
        msg="escolhe uma música aqui embaixo: a fita troca junto"
      />
    );
  }

  return (
    <TapeDeck
      className="deck-big"
      tape={{
        key: `${track.id}-${now!.at}`,
        label: track.title,
        art: track.cover,
        palette: tapeFor(Object.values(track.links)[0] ?? track.id),
        progress: pos.progress,
        spinning: !pos.done,
      }}
      active={pos.done ? "stop" : "play"}
      lcd={
        <>
          <span>
            {pos.done ? "■" : "▶"} {String(now!.index + 1).padStart(2, "0")}/{String(tracks.length).padStart(2, "0")}
          </span>
          <span>
            {deckClock(pos.elapsed)}/{deckClock(pos.length)}
          </span>
        </>
      }
      msg={
        <span key={`${track.id}-${now!.at}`} className="deck-toast">
          {pos.done ? "✓ " : "▸ "}
          <b>{track.title}</b> · {track.artist}
          {platformName && !pos.done && <span className="deck-where"> · tocando no {platformName}</span>}
        </span>
      }
    />
  );
}
