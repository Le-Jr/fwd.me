"use client";

import { useState } from "react";
import type { Device } from "@/lib/open";
import type { Platform } from "@/lib/platforms";
import type { StoredTrack } from "@/lib/types";
import { StreamLink, TrackLink } from "./StreamLink";

export interface Playlist {
  youtube: string;
  ytmusic: string;
  /** tracks that made it into the playlist (some may not be on YouTube) */
  count: number;
}

interface Props {
  platform: Platform;
  tracks: StoredTrack[];
  playlist: Playlist | null;
  /** links are still being looked up */
  loading: boolean;
  device: Device;
  embedded: boolean;
  /** index of the next track in queue mode, or null when the queue is off */
  pos: number | null;
  setPos: (pos: number | null) => void;
}

/**
 * Opens the whole mix with as few taps as the platform allows:
 * - YouTube / YT Music: one anonymous playlist with every track.
 * - everywhere else: a queue that opens one track and remembers where you are,
 *   so coming back to the page is a single "next" tap.
 * - Spotify on desktop also gets "copy links", which pasted into a playlist in
 *   the Spotify app adds every track at once.
 */
export default function PlayAll({ platform, tracks, playlist, loading, device, embedded, pos, setPos }: Props) {
  const [copied, setCopied] = useState(false);
  const n = tracks.length;
  if (n < 2) return null;

  const common = { platform, device, embedded };
  const isYoutube = platform.id === "youtube" || platform.id === "ytmusic";
  const spotifyLinks = tracks.map((t) => t.links.spotify).filter((l): l is string => !!l);

  async function copySpotify() {
    try {
      await navigator.clipboard.writeText(spotifyLinks.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("copia os links:", spotifyLinks.join(" "));
    }
  }

  let main: React.ReactNode;
  if (isYoutube) {
    const url = playlist?.[platform.id as "youtube" | "ytmusic"];
    main = url ? (
      <>
        <StreamLink {...common} web={url} fallback={url} className="open-btn playall-btn">
          ▶ tocar tudo
        </StreamLink>
        <span className="playall-hint">
          {playlist!.count === n
            ? `uma playlist no ${platform.name} com as ${n} faixas`
            : `uma playlist no ${platform.name} com ${playlist!.count} de ${n} faixas (o resto não achei lá)`}
        </span>
      </>
    ) : (
      <>
        <span className="open-btn playall-btn open-btn-idle">{loading ? "montando…" : "▶ tocar tudo"}</span>
        <span className="playall-hint">
          {loading ? `montando a playlist no ${platform.name}…` : "não deu pra montar a playlist agora"}
        </span>
      </>
    );
  } else if (pos === null) {
    main = (
      <>
        <TrackLink {...common} track={tracks[0]} className="open-btn playall-btn" onOpen={() => setPos(1)}>
          ▶ tocar em sequência
        </TrackLink>
        <span className="playall-hint">abre a 1ª faixa. volta aqui que a próxima fica a um toque</span>
      </>
    );
  } else if (pos < n) {
    main = (
      <>
        <TrackLink
          {...common}
          track={tracks[pos]}
          className="open-btn playall-btn"
          onOpen={() => setPos(pos + 1)}
          aria-label={`Próxima: ${tracks[pos].title}`}
        >
          ▶ próxima
        </TrackLink>
        <span className="playall-hint">
          <b>
            {pos + 1}/{n}
          </b>{" "}
          · {tracks[pos].title}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => setPos(null)}>
          parar
        </button>
      </>
    );
  } else {
    main = (
      <>
        <span className="playall-hint">
          <b>✓ fila completa</b> · {n} faixas
        </span>
        <button type="button" className="btn btn-sm" onClick={() => setPos(null)}>
          recomeçar
        </button>
      </>
    );
  }

  return (
    <div className="playall" style={{ "--c": platform.color, "--ink": platform.ink } as React.CSSProperties}>
      <div className="playall-row">{main}</div>
      {platform.id === "spotify" && device === "desktop" && spotifyLinks.length > 1 && (
        <div className="playall-row playall-extra">
          <button type="button" className="btn btn-sm" onClick={copySpotify}>
            {copied ? "copiado!" : `copiar ${spotifyLinks.length} links`}
          </button>
          <span className="playall-hint">
            no app do Spotify, abre uma playlist e cola (Ctrl+V): entra tudo de uma vez
            {spotifyLinks.length < n && ` · ${n - spotifyLinks.length} não achei no Spotify`}
          </span>
        </div>
      )}
    </div>
  );
}
