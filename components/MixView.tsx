"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cover from "./Cover";
import PlayAll, { type Playlist } from "./PlayAll";
import { TrackLink } from "./StreamLink";
import { decryptSecret, keyFromHash, type MixSecret } from "@/lib/crypto";
import { formatDuration, totalDuration } from "@/lib/format";
import { detectDevice, inAppBrowser, type Device } from "@/lib/open";
import { getPlatform, isPlatformId, PLATFORMS, platformStyle } from "@/lib/platforms";
import type { Links, Mix, PlatformId, StoredTrack } from "@/lib/types";

const STORAGE_KEY = "fwd.platform";
const queueKey = (id: string) => `fwd.queue.${id}`;

/** Subject/sender/note as shown: decrypted from the link key, or legacy plaintext. */
type Letter =
  | { state: "open"; secret: MixSecret }
  | { state: "decrypting" }
  | { state: "no-key" }
  | { state: "bad-key" };

function legacyLetter(mix: Mix): Letter {
  return { state: "open", secret: { title: mix.title, author: mix.author ?? "", note: mix.note ?? "" } };
}

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
  const [letter, setLetter] = useState<Letter>(() => (mix.secret ? { state: "decrypting" } : legacyLetter(mix)));
  const [linkKey, setLinkKey] = useState<string | null>(null);

  // the key sits in the #fragment, which never reaches the server: decrypt here
  useEffect(() => {
    if (!mix.secret) return;
    const envelope = mix.secret;
    let alive = true;
    function unlock() {
      const key = keyFromHash(window.location.hash);
      setLinkKey(key);
      if (!key) {
        setLetter({ state: "no-key" });
        return;
      }
      setLetter({ state: "decrypting" });
      decryptSecret(key, envelope)
        .then((secret) => alive && setLetter({ state: "open", secret }))
        .catch(() => alive && setLetter({ state: "bad-key" }));
    }
    unlock();
    // someone may paste the full link over a key-less one in the same tab
    window.addEventListener("hashchange", unlock);
    return () => {
      alive = false;
      window.removeEventListener("hashchange", unlock);
    };
  }, [mix.secret]);

  // the server-side <title> can only say "N faixas"; show the real subject once decrypted
  useEffect(() => {
    if (letter.state !== "open" || !mix.secret) return;
    const title = `FWD: ${letter.secret.title} · fwd.fm`;
    document.title = title;
    // Next applies route metadata right after navigation; set it again once that settles
    const t = window.setTimeout(() => (document.title = title), 300);
    return () => window.clearTimeout(t);
  }, [letter, mix.secret]);

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
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("copia o link:", fullShareUrl);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `FWD: ${open?.title ?? "ouve isso"}`, url: fullShareUrl });
        return;
      } catch {
        // cancelled: fall through to copy
      }
    }
    copy();
  }

  const open = letter.state === "open" ? letter.secret : null;
  // the share link must carry the key, or friends get a locked letter
  const fullShareUrl = linkKey ? `${shareUrl}#k=${linkKey}` : shareUrl;
  const locked = letter.state === "no-key" || letter.state === "bad-key";
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
            <span>FWD:</span>{" "}
            {open ? open.title : locked ? <span className="locked">🔒 mensagem trancada</span> : <span className="locked">…</span>}
          </h1>

          <dl className="headers" style={{ marginTop: 14 }}>
            <div>
              <dt>De:</dt>
              <dd>{open ? open.author || "alguém com bom gosto" : locked ? "🔒" : "…"}</dd>
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

          {open?.note && <p className="note">{open.note}</p>}

          {locked && (
            <p className="notice" role="note">
              {letter.state === "no-key" ? (
                <>
                  Esse link chegou <b>sem a chave</b> (a parte depois do <b>#</b>). As músicas abrem normal, mas o
                  assunto, o remetente e a mensagem só aparecem com o link completo.
                </>
              ) : (
                <>
                  A chave desse link <b>não confere</b>. Pede pra quem mandou copiar o link de novo, inteiro.
                </>
              )}
            </p>
          )}

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
            <code>{fullShareUrl}</code>
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

