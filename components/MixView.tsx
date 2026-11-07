"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cover from "./Cover";
import { formatDuration, totalDuration } from "@/lib/format";
import { androidIntent, appUri, detectDevice, inAppBrowser, openDesktopApp, type Device } from "@/lib/open";
import { getPlatform, isPlatformId, PLATFORMS, platformStyle, type Platform } from "@/lib/platforms";
import type { Mix, PlatformId, StoredTrack } from "@/lib/types";

const STORAGE_KEY = "fwd.platform";

export default function MixView({ mix, isNew }: { mix: Mix; isNew: boolean }) {
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [shareUrl, setShareUrl] = useState(`/m/${mix.id}`);
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [embeddedIn, setEmbeddedIn] = useState<string | null>(null);

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
  const total = totalDuration(mix.tracks);

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

          <ol className="tracklist">
            {mix.tracks.map((t, i) => (
              <li key={t.id} className="track">
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

interface TrackLinkProps {
  track: StoredTrack;
  platform: Platform;
  device: Device;
  /** inside an app's embedded browser, where intent:// may not be handled */
  embedded: boolean;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}

/**
 * Link to a track that prefers the installed streaming app. Known links point
 * straight at the platform (so iOS Universal Links fire on tap); unknown ones go
 * through /go, which looks the track up on first click.
 */
function TrackLink({ track, platform, device, embedded, children, ...rest }: TrackLinkProps) {
  const web = track.links[platform.id];
  const fallback = `/go/${track.id}/${platform.id}`;

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
      onClick={
        uri && web
          ? (e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              openDesktopApp(uri, web);
            }
          : undefined
      }
    >
      {children}
    </a>
  );
}
