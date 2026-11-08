"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RadioTrack } from "@/lib/radio";
import Cassette from "./Cassette";

const DISMISS_KEY = "fwd.radio.off";
const VOLUME_KEY = "fwd.radio.vol";
/** starts quiet: it greets people who did not ask for music */
const DEFAULT_VOLUME = 0.1;
const BARS = 28;
const COLORS = ["#c6ff3d", "#3df2ff", "#ff3df2"];

type Status = "loading" | "ready" | "playing" | "paused" | "error";

/**
 * Floating mini player that greets every visit with a random 30s preview.
 *
 * Browsers block audio with sound until the visitor interacts with the page,
 * so we try to autoplay and otherwise wait on a pulsing play button. The waves
 * read the real audio through an AnalyserNode once the visitor taps play (an
 * AudioContext created without a gesture starts suspended and would mute the
 * element); until then they are drawn from a synthetic signal.
 *
 * Volume goes through a GainNode placed after the analyser, so the waves keep
 * their full size at low volume (and it also works on iOS, where the element's
 * own volume is read-only). Before the graph exists, the element volume is used.
 */
export default function RadioPlayer() {
  const [hidden, setHidden] = useState(true);
  const [track, setTrack] = useState<RadioTrack | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [showVolume, setShowVolume] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const statusRef = useRef<Status>("loading");
  statusRef.current = status;

  const load = useCallback(async (autoplay: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/random", { cache: "no-store" });
      const data = (await res.json()) as { track?: RadioTrack };
      if (!data.track) throw new Error("no track");
      setTrack(data.track);
      setProgress(0);
      audio.src = data.track.preview;
      if (!autoplay) {
        setStatus("ready");
        return;
      }
      try {
        await audio.play();
        setStatus("playing");
      } catch {
        // autoplay blocked: wait for a tap
        setStatus("ready");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let off = false;
    try {
      off = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // storage blocked: show the player
    }
    if (off) return;
    try {
      const saved = Number(localStorage.getItem(VOLUME_KEY) ?? NaN);
      if (saved >= 0 && saved <= 1) applyVolume(saved);
      else applyVolume(DEFAULT_VOLUME);
    } catch {
      applyVolume(DEFAULT_VOLUME);
    }
    setHidden(false);
    load(true);
  }, [load]);

  // leave room so the player never covers the end of the page
  useEffect(() => {
    document.documentElement.classList.toggle("has-radio", !hidden);
    return () => document.documentElement.classList.remove("has-radio");
  }, [hidden]);

  function applyVolume(v: number) {
    volumeRef.current = v;
    setVolumeState(v);
    const audio = audioRef.current;
    if (gainRef.current) gainRef.current.gain.value = v;
    else if (audio) audio.volume = v;
  }

  function setVolume(v: number) {
    applyVolume(v);
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      // ignore
    }
  }

  /** Wire the analyser; must run inside a user gesture. */
  function connectAnalyser() {
    const audio = audioRef.current;
    if (!audio || analyserRef.current) {
      ctxRef.current?.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      const gain = ctx.createGain();
      gain.gain.value = volumeRef.current;
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);
      audio.volume = 1; // the gain node owns the volume from here on
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      gainRef.current = gain;
    } catch {
      // Web Audio unavailable: synthetic waves still run
    }
  }

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || !track) return;
    connectAnalyser();
    if (audio.paused) {
      try {
        await audio.play();
        setStatus("playing");
      } catch {
        setStatus("error");
      }
    } else {
      audio.pause();
      setStatus("paused");
    }
  }

  function shuffle() {
    connectAnalyser();
    load(true);
  }

  function close() {
    audioRef.current?.pause();
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  // waves
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || hidden) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const freq = new Uint8Array(64);
    let raf = 0;

    function draw(t: number) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      if (canvas!.width !== Math.round(w * dpr)) {
        canvas!.width = Math.round(w * dpr);
        canvas!.height = Math.round(h * dpr);
      }
      g!.setTransform(dpr, 0, 0, dpr, 0, 0);
      g!.clearRect(0, 0, w, h);

      const playing = statusRef.current === "playing";
      const analyser = analyserRef.current;
      if (playing && analyser) analyser.getByteFrequencyData(freq);

      const gap = 2;
      const bw = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        let v: number;
        if (!playing) v = 0.12 + 0.05 * Math.sin(i * 0.9);
        else if (reduced) v = 0.45;
        else if (analyser) v = freq[Math.min(freq.length - 1, Math.floor((i / BARS) * 44))] / 255;
        else v = 0.5 + 0.35 * Math.sin(t / 180 + i * 0.7) * Math.sin(t / 470 + i * 1.3);
        const bh = Math.max(2, Math.min(1, v) * h);
        g!.fillStyle = COLORS[i % COLORS.length];
        g!.fillRect(i * (bw + gap), h - bh, bw, bh);
      }

      if (playing && !reduced) raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hidden, status]);

  const label =
    status === "loading" ? "sintonizando…" : status === "error" ? "fora do ar" : status === "playing" ? "no ar" : "pronta";

  return (
    <>
      {/* kept mounted so the element (and its audio graph) survives track changes */}
      <audio ref={audioRef} crossOrigin="anonymous" preload="auto" onEnded={() => load(true)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
        onError={() => statusRef.current !== "loading" && setStatus("error")}
      />
      {!hidden && (
        <aside className={`radio radio-${status}`} aria-label="rádio aleatória do fwd.fm">
          <Cassette
            className="radio-k7"
            label={track ? track.title : "rádio fwd"}
            art={track?.cover}
            spinning={status === "playing"}
            progress={progress}
          />

          <div className="radio-meta">
            <span className="radio-label">
              <span className="radio-dot" /> fwd · {label}
            </span>
            {track ? (
              <a className="radio-title" href={track.link} target="_blank" rel="noopener" title="abrir no Deezer">
                <strong>{track.title}</strong> <span>· {track.artist}</span>
              </a>
            ) : (
              <span className="radio-title">
                <strong>{status === "error" ? "não rolou agora" : "procurando uma música…"}</strong>
              </span>
            )}
            <canvas ref={canvasRef} className="radio-waves" aria-hidden="true" />
          </div>

          <div className="radio-ctrl">
            <button
              type="button"
              className="radio-play"
              onClick={status === "error" ? shuffle : toggle}
              disabled={status === "loading"}
              aria-label={status === "playing" ? "pausar" : "tocar"}
            >
              {status === "playing" ? <Icon d="M7 5h3v14H7zM14 5h3v14h-3z" /> : <Icon d="M8 5v14l11-7z" />}
            </button>
            <button
              type="button"
              className="radio-btn"
              onClick={() => setShowVolume((v) => !v)}
              aria-label="volume"
              aria-expanded={showVolume}
              title={`volume ${Math.round(volume * 100)}%`}
            >
              <Icon
                d={
                  volume === 0
                    ? "M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6"
                    : volume < 0.5
                      ? "M4 9v6h4l5 4V5L8 9H4zM16.5 9.5a3.5 3.5 0 0 1 0 5"
                      : "M4 9v6h4l5 4V5L8 9H4zM16.5 9.5a3.5 3.5 0 0 1 0 5M19 7a7 7 0 0 1 0 10"
                }
                stroke
              />
            </button>
            <button type="button" className="radio-btn" onClick={shuffle} aria-label="outra música aleatória" title="outra">
              <Icon d="M16 4l4 4-4 4M4 8h16M8 20l-4-4 4-4M20 16H4" stroke />
            </button>
            <button type="button" className="radio-btn" onClick={close} aria-label="fechar rádio" title="fechar">
              <Icon d="M6 6l12 12M18 6L6 18" stroke />
            </button>
          </div>

          {showVolume && (
            <label className="radio-vol">
              <span className="sr-only">volume</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                style={{ "--v": `${Math.round(volume * 100)}%` } as React.CSSProperties}
              />
              <span className="radio-vol-num">{Math.round(volume * 100)}%</span>
            </label>
          )}
        </aside>
      )}
    </>
  );
}

function Icon({ d, stroke }: { d: string; stroke?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d={d}
        fill={stroke ? "none" : "currentColor"}
        stroke={stroke ? "currentColor" : "none"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
