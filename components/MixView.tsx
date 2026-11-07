"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cover from "./Cover";
import PlayAll, { type Playlist } from "./PlayAll";
import { TrackLink } from "./StreamLink";
import { formatDuration, totalDuration } from "@/lib/format";
import { detectDevice, inAppBrowser, type Device } from "@/lib/open";
import { getPlatform, isPlatformId, PLATFORMS, platformStyle } from "@/lib/platforms";
import type { Links, Mix, PlatformId, StoredTrack } from "@/lib/types";

const STORAGE_KEY = "fwd.platform";
const queueKey = (id: string) => `fwd.queue.${id}`;

export default function MixView({ mix, isNew }: { mix: Mix; isNew: boolean }) {
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [shareUrl, setShareUrl] = useState(`/m/${mix.id}`);
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [embeddedIn, setEmbeddedIn] = useState<string | null>(null);
  const [tracks, setTracks] = useState<StoredTrack[]>(mix.tracks);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [linksLoading, setLinksLoading] = useState(true);
  const [queuePos, setQueuePosState] = useState<number | null>(null);

  // look every link up before anyone taps, and build the "play all" playlist
  useEffect(() => {
    let alive = true;
    fetch(`/api/mixes/${mix.id}/links`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { tracks: { id: string; links: Links }[]; playlist: Playlist | null } | null) => {
        if (!alive || !data) return;
        const byId = new Map(data.tracks.map((t) => [t.id, t.links]));
        setTracks((prev) => prev.map((t) => ({ ...t, links: { ...t.links, ...byId.get(t.id) } })));
        setPlaylist(data.playlist);
      })
      .catch(() => {
        // the per-track /go lookup still works
      })
      .finally(() => alive && setLinksLoading(false));
    return () => {
      alive = false;
    };
  }, [mix.id]);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(queueKey(mix.id)));
      if (saved > 0) setQueuePosState(saved);
    } catch {
      // storage blocked: the queue lasts this visit
    }
  }, [mix.id]);

  function setQueuePos(pos: number | null) {
    setQueuePosState(pos);
    try {
      if (pos === null) localStorage.removeItem(queueKey(mix.id));
      else localStorage.setItem(queueKey(mix.id), String(pos));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setShareUrl(`${window.location.origin}/m/${mix.id}`);
    setDevice(detectDevice(navigator.userAgent, navigator.maxTouchPoints));
    setEmbeddedIn(inAppBrowser(navigator.userAgent));
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isPlatformId(saved)) setPlatform(saved);
    } catch {
      // storage blocked: the picker still works for this visit
    }
  }, [mix.id]);

  function choose(id: PlatformId) {
    setPlatform(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("copia o link:", shareUrl);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `FWD: ${mix.title}`, url: shareUrl });
        return;
      } catch {
        // cancelled: fall through to copy
      }
    }
    copy();
  }

  const current = platform ? getPlatform(platform)! : null;
  const total = totalDuration(tracks);
  const queueOn = queuePos !== null && current !== null && current.id !== "youtube" && current.id !== "ytmusic";

  return (
    <>
      <section className="window window-cyan" aria-labelledby="mix-title">
        <div className="window-bar">
          <span className="window-title">fwd.fm/m/{mix.id}</span>
          <span className="window-ctrl">[–][□][×]</span>
        </div>

        <div className="window-body">
          {isNew && (
            <div className="banner">
              <span>✓ link pronto. agora é só mandar pros amigos</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
                {copied ? "copiado!" : "copiar link"}
              </button>
            </div>
          )}

          <h1 id="mix-title" className="mix-title">
            <span>FWD:</span> {mix.title}
          </h1>

          <dl className="headers" style={{ marginTop: 14 }}>
            <div>
              <dt>De:</dt>
              <dd>{mix.author || "alguém com bom gosto"}</dd>
            </div>
            <div>
              <dt>Para:</dt>
              <dd>você</dd>
            </div>
            <div>
              <dt>Anexos:</dt>
              <dd>
                {mix.tracks.length} {mix.tracks.length === 1 ? "faixa" : "faixas"}
                {total > 0 && ` · ${formatDuration(total)}`}
              </dd>
            </div>
          </dl>

          {mix.note && <p className="note">{mix.note}</p>}

          {embeddedIn && (
            <p className="notice" role="note">
              Você tá no navegador do <b>{embeddedIn}</b>, que costuma não abrir o app de música. Toca nos{" "}
              <b>três pontinhos</b> e escolhe <b>abrir no navegador</b> pra música tocar direto no app.
            </p>
          )}

          <div className="picker">
            <p className="picker-label">
              {current ? (
                <>
                  abrindo tudo no <b>{current.name}</b>. troca quando quiser
                </>
              ) : (
                "onde você ouve? escolhe uma vez que a gente lembra"
              )}
            </p>
            <div className="chips">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  style={platformStyle(p)}
                  aria-pressed={platform === p.id}
                  onClick={() => choose(p.id)}
                >
                  <b>{p.code}</b>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {current && (
            <PlayAll
              platform={current}
              tracks={tracks}
              playlist={playlist}
              loading={linksLoading}
              device={device}
              embedded={embeddedIn !== null}
              pos={queuePos}
              setPos={setQueuePos}
            />
          )}

          <ol className="tracklist">
            {tracks.map((t, i) => (
              <li
                key={t.id}
                className={`track${queueOn && i < queuePos! ? " track-played" : ""}${queueOn && i === queuePos ? " track-next" : ""}`}
              >
                <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                <Cover src={t.cover} />
                <div className="meta">
                  <strong>{t.title}</strong>
                  <span className="artist">{t.artist}</span>
                  <span className="alts">
                    {PLATFORMS.filter((p) => p.id !== platform).map((p) => (
                      <TrackLink
                        key={p.id}
                        track={t}
                        platform={p}
                        device={device}
                        embedded={embeddedIn !== null}
                        title={`Abrir no ${p.name}`}
                      >
                        {p.code}
                      </TrackLink>
                    ))}
                  </span>
                </div>
                {current ? (
                  <TrackLink
                    className="open-btn"
                    track={t}
                    onOpen={queueOn ? () => setQueuePos(i + 1) : undefined}
                    platform={current}
                    device={device}
                    embedded={embeddedIn !== null}
                    aria-label={`Abrir ${t.title} no ${current.name}`}
                  >
                    ▶ <span>abrir</span>
                  </TrackLink>
                ) : (
                  <span className="open-btn open-btn-idle">
                    ↑ <span>escolhe</span>
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="share-row">
            <code>{shareUrl}</code>
            <button type="button" className="btn btn-primary" onClick={share}>
              {copied ? "copiado!" : "encaminhar ↗"}
            </button>
          </div>
        </div>
      </section>

      <p className="cta">
        <Link href="/">+ fazer o seu FWD</Link>
      </p>
    </>
  );
}

