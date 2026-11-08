"use client";

import { encryptSecret, generateKey } from "@/lib/crypto";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cover from "./Cover";
import TapeDeck from "./TapeDeck";
import { deckClock, SIDE_SECONDS } from "@/lib/deck";
import { tapeFor } from "@/lib/tapes";
import { formatDuration, totalDuration } from "@/lib/format";
import type { Track } from "@/lib/types";

type Draft = Track & { key: string };

let seq = 0;
const withKey = (t: Track): Draft => ({ ...t, key: `t${++seq}` });
const identity = (t: Track) => Object.values(t.links)[0] ?? `${t.artist}|${t.title}`;

const FLY_MS = 560;

/** the last addition; a new id replays the deck's insert animation */
type TapeInsert = { id: number; label: string };

/**
 * Throws a mini tape from `from` into the deck slot. Returns how long to wait
 * before adding the track so the deck's insert lands with it (0 = no flight:
 * reduced motion, or the deck is off screen).
 */
function flyToDeck(from: HTMLElement): number {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const bay = document.querySelector(".deck-bay");
  if (!bay) return 0;
  const a = from.getBoundingClientRect();
  const b = bay.getBoundingClientRect();
  if (b.bottom < 0 || b.top > window.innerHeight) return 0;

  const tape = document.createElement("div");
  tape.className = "fly-k7";
  tape.setAttribute("aria-hidden", "true");
  const x0 = a.left + a.width / 2 - 22;
  const y0 = a.top + a.height / 2 - 14;
  const dx = b.left + b.width / 2 - 22 - x0;
  const dy = b.top + b.height / 2 - 14 - y0;
  const lift = Math.min(140, Math.abs(dy) / 2 + 50);
  tape.style.left = `${x0}px`;
  tape.style.top = `${y0}px`;
  document.body.appendChild(tape);
  const anim = tape.animate(
    [
      { transform: "translate(0, 0) scale(0.7) rotate(0deg)", opacity: 0 },
      { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(1.2) rotate(-14deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.7) rotate(0deg)`, opacity: 0.15 },
    ],
    { duration: FLY_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  );
  anim.onfinish = () => tape.remove();
  anim.oncancel = () => tape.remove();
  return FLY_MS - 140;
}

export default function Composer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"paste" | "search">("paste");
  const [paste, setPaste] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [tracks, setTracks] = useState<Draft[]>([]);
  const [busy, setBusy] = useState<null | "resolve" | "save">(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastAdd, setLastAdd] = useState<TapeInsert | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { tracks: Track[] };
        setResults(data.tracks);
      } catch {
        // aborted or offline: keep the previous results
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  function addTracks(list: Track[]) {
    const known = new Set(tracks.map(identity));
    const added = list.filter((t) => !known.has(identity(t)) && known.add(identity(t)));
    if (added.length) {
      setLastAdd((prev) => ({
        id: (prev?.id ?? 0) + 1,
        label: added.length === 1 ? `${added[0].title} · ${added[0].artist}` : `+${added.length} faixas na fita`,
      }));
    }
    setTracks((current) => {
      const seen = new Set(current.map(identity));
      const fresh = list.filter((t) => !seen.has(identity(t)) && seen.add(identity(t)));
      return [...current, ...fresh.map(withKey)];
    });
  }

  function addFromSearch(button: HTMLElement, t: Track) {
    const wait = flyToDeck(button);
    if (wait) setTimeout(() => addTracks([t]), wait);
    else addTracks([t]);
  }

  function move(index: number, delta: number) {
    setTracks((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  function remove(index: number) {
    setTracks((current) => current.filter((_, i) => i !== index));
  }

  async function pull() {
    if (!paste.trim() || busy) return;
    setBusy("resolve");
    setErrors([]);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: paste }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "deu ruim");
      addTracks(data.tracks);
      const failed = data.errors as { input: string; message: string }[];
      setErrors(failed.map((e) => `${e.input} → ${e.message}`));
      // Keep only what failed so it can be fixed and retried.
      setPaste(failed.map((e) => e.input).join("\n"));
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "deu ruim"]);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!tracks.length || busy) return;
    setBusy("save");
    setErrors([]);
    try {
      // subject, sender and note are encrypted here; the key only ever lives in the link's #fragment
      const key = generateKey();
      const secret = await encryptSecret(key, { title: title.trim() || "ouve isso", author: author.trim(), note: note.trim() });
      const res = await fetch("/api/mixes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, tracks: tracks.map(({ key: _key, ...t }) => t) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "não deu pra salvar");
      router.push(`/m/${data.id}?novo=1#k=${key}`);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "não deu pra salvar"]);
      setBusy(null);
    }
  }

  const total = totalDuration(tracks);
  const inTape = new Set(tracks.map(identity));

  return (
    <section className="window" aria-label="Novo FWD">
      <div className="window-bar">
        <span className="window-title">nova_mensagem.fwd</span>
        <span className="window-ctrl">[–][□][×]</span>
      </div>

      <div className="window-body">
        <label className="field-row">
          <span className="field-label">Assunto:</span>
          <span className="fwd-prefix">FWD:</span>
          <input
            className="bare"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ouve isso"
            maxLength={120}
          />
        </label>
        <label className="field-row">
          <span className="field-label">De:</span>
          <input
            className="bare"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="seu nome (opcional)"
            maxLength={60}
          />
        </label>
        <label className="field-row field-row-top">
          <span className="field-label">Msg:</span>
          <textarea
            className="bare"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="escreve um recado: por que essa tem que tocar agora?"
            maxLength={500}
          />
        </label>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={mode === "paste"}
            onClick={() => setMode("paste")}
          >
            colar links
          </button>
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={mode === "search"}
            onClick={() => setMode("search")}
          >
            buscar música
          </button>
        </div>

        {mode === "paste" ? (
          <div className="pane" role="tabpanel">
            <textarea
              className="input mono"
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) pull();
              }}
              placeholder={
                "https://open.spotify.com/track/...\nhttps://www.deezer.com/playlist/...\nou só: Racionais - Negro Drama"
              }
              aria-label="Links ou nomes de músicas, um por linha"
            />
            <div className="pane-foot">
              <span className="hint">um por linha · faixa, álbum ou playlist do Deezer · ctrl+enter</span>
              <button type="button" className="btn" onClick={pull} disabled={!paste.trim() || busy !== null}>
                {busy === "resolve" ? "puxando..." : "puxar ↵"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pane" role="tabpanel">
            <input
              className="input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="artista, música, álbum..."
              aria-label="Buscar música"
              autoFocus
            />
            {searching && <p className="hint">buscando...</p>}
            {results.length > 0 && (
              <ul className="results">
                {results.map((t) => {
                  const added = inTape.has(identity(t));
                  return (
                    <li key={identity(t)} className={added ? "result result-added" : "result"}>
                      <Cover src={t.cover} />
                      <div className="meta">
                        <strong>{t.title}</strong>
                        <span className="artist">{t.artist}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={added}
                        onClick={(e) => addFromSearch(e.currentTarget, t)}
                      >
                        {added ? "✓ na fita" : "+ add"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <ul className="errors" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="attach-head">
          <strong>[anexos]</strong>
          <span>
            {tracks.length} {tracks.length === 1 ? "faixa" : "faixas"}
            {total > 0 && ` · ${formatDuration(total)}`}
          </span>
        </div>

        <TapeDeck
          tape={
            tracks.length
              ? {
                  key: lastAdd?.id ?? 0,
                  label: `FWD: ${title.trim() || "ouve isso"}`,
                  palette: tapeFor(title.trim() || "ouve isso"),
                  progress: total / SIDE_SECONDS,
                }
              : null
          }
          active={tracks.length ? "rew" : null}
          lcd={
            tracks.length ? (
              <>
                <span>FX {String(tracks.length).padStart(2, "0")}</span>
                <span className={total > SIDE_SECONDS ? "deck-over" : undefined}>
                  {deckClock(total)}/{deckClock(SIDE_SECONDS)}
                </span>
              </>
            ) : (
              <span>INSIRA UMA FITA</span>
            )
          }
          msg={
            tracks.length ? (
              <span key={lastAdd?.id ?? 0} className="deck-toast">
                {lastAdd ? `▸ ${lastAdd.label}` : `${tracks.length} na fita`}
                {total > SIDE_SECONDS && <span className="deck-warn"> · passou de um lado</span>}
              </span>
            ) : (
              "nenhuma faixa ainda. cola um link aí em cima ↑"
            )
          }
        />

        {tracks.length > 0 && (
          <ol className="tracklist compact">
            {tracks.map((t, i) => (
              <li key={t.key} className="track">
                <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                <Cover src={t.cover} />
                <div className="meta">
                  <strong>{t.title}</strong>
                  <span className="artist">{t.artist}</span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === tracks.length - 1}
                    aria-label="Descer"
                  >
                    ↓
                  </button>
                  <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label="Remover">
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="send-row">
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={send}
            disabled={!tracks.length || busy !== null}
          >
            {busy === "save" ? "encaminhando..." : "FWD → gerar link"}
          </button>
        </div>
      </div>
    </section>
  );
}
