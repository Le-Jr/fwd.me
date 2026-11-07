"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cover from "./Cover";
import { formatDuration, totalDuration } from "@/lib/format";
import type { Track } from "@/lib/types";

type Draft = Track & { key: string };

let seq = 0;
const withKey = (t: Track): Draft => ({ ...t, key: `t${++seq}` });
const identity = (t: Track) => Object.values(t.links)[0] ?? `${t.artist}|${t.title}`;

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
    setTracks((current) => {
      const seen = new Set(current.map(identity));
      const fresh = list.filter((t) => !seen.has(identity(t)) && seen.add(identity(t)));
      return [...current, ...fresh.map(withKey)];
    });
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
      const res = await fetch("/api/mixes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, author, note, tracks: tracks.map(({ key: _key, ...t }) => t) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "não deu pra salvar");
      router.push(`/m/${data.id}?novo=1`);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "não deu pra salvar"]);
      setBusy(null);
    }
  }

  const total = totalDuration(tracks);

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
            placeholder="essa aqui é pra ouvir no talo"
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
            <ul className="results">
              {results.map((t) => (
                <li key={identity(t)} className="result">
                  <Cover src={t.cover} />
                  <div className="meta">
                    <strong>{t.title}</strong>
                    <span className="artist">{t.artist}</span>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => addTracks([t])}>
                    + add
                  </button>
                </li>
              ))}
            </ul>
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

        {tracks.length === 0 ? (
          <p className="empty">nenhuma faixa ainda. cola um link aí em cima ↑</p>
        ) : (
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
