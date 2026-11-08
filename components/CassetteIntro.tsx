"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Cassette from "./Cassette";

/**
 * Runs before first paint (inline in <head>): decides whether this visit gets the intro.
 * Once per tab session, never with reduced motion. Without JS the class is never set,
 * so the overlay simply never shows.
 */
export const INTRO_SCRIPT = `try{var d=document.documentElement;if(!sessionStorage.getItem("fwd.k7")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("k7-intro");sessionStorage.setItem("fwd.k7","1")}}catch(e){}`;

/** rew, play, ff, stop, eject */
const KEYS = [
  "M11 6v12L2 12zM22 6v12l-9-6z",
  "M7 5v14l12-7z",
  "M2 6v12l9-6zM13 6v12l9-6z",
  "M6 6h12v12H6z",
  "M12 5l8 9H4zM4 16h16v3H4z",
];

/** deck pops in, tape slides in (~1.1s), door closes, rewind; then the tape leaves */
const HOLD_MS = 2700;

/**
 * Opening animation: a tape deck appears, a tape slides into it, the door
 * closes and it rewinds. Then the tape flies into the floating radio and
 * becomes its cassette. Click, tap or any key skips it.
 */
export default function CassetteIntro() {
  const pathname = usePathname();
  const [done, setDone] = useState(false);
  const tapeRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const flying = useRef(false);

  const finish = useCallback(() => {
    document.documentElement.classList.remove("k7-intro");
    setDone(true);
  }, []);

  const fly = useCallback(
    (fast: boolean) => {
      if (flying.current) return;
      flying.current = true;
      const tape = tapeRef.current;
      if (!tape || typeof tape.animate !== "function") return finish();

      const from = tape.getBoundingClientRect();
      const target = document.querySelector(".radio-k7")?.getBoundingClientRect();
      const duration = fast ? 380 : 720;
      const end: Keyframe =
        target && target.width > 0
          ? {
              transform: `translate(${target.left + target.width / 2 - (from.left + from.width / 2)}px, ${
                target.top + target.height / 2 - (from.top + from.height / 2)
              }px) scale(${target.width / from.width})`,
            }
          : { transform: "scale(0.4)", opacity: 0 };

      overlayRef.current?.querySelectorAll(".k7-fade, .k7-deck, .k7-glass, .k7-copy").forEach((el) =>
        el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: duration * 0.8, fill: "forwards" }),
      );
      const anim = tape.animate([{ transform: "none" }, end], {
        duration,
        easing: "cubic-bezier(0.6, 0, 0.2, 1)",
        fill: "forwards",
      });
      anim.onfinish = finish;
      anim.oncancel = finish;
    },
    [finish],
  );

  useEffect(() => {
    if (!document.documentElement.classList.contains("k7-intro")) {
      setDone(true);
      return;
    }
    const timer = setTimeout(() => fly(false), HOLD_MS);
    const skip = () => fly(true);
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [fly]);

  if (done) return null;

  const caption = pathname.startsWith("/m/") ? "> você recebeu uma fita" : "> rebobinando a fita...";

  return (
    <div ref={overlayRef} className="k7-overlay" onClick={() => fly(true)} aria-hidden="true">
      <div className="k7-fade" />
      <div className="k7-stage">
        <div className="k7-deck">
          <div className="k7-deck-top">
            <span className="k7-brand">fwd·deck</span>
            <span className="k7-lcd">
              <span className="k7-lcd-a">SEM FITA</span>
              <span className="k7-lcd-b">
                <b>&lt;&lt;</b> REW
              </span>
            </span>
          </div>
          {/* empty bay; the tape is a sibling so it can fly out while the deck fades */}
          <div className="k7-bay">
            <Cassette className="k7-ghost" />
          </div>
          <div className="k7-keys">
            {KEYS.map((d, i) => (
              <span key={d} className={i === 0 ? "k7-key k7-key-on" : "k7-key"}>
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path d={d} fill="currentColor" />
                </svg>
              </span>
            ))}
          </div>
        </div>
        <div ref={tapeRef} className="k7-intro-tape">
          <div className="k7-intro-drop">
            <Cassette label="fwd.fm · mixtape" progress={1} />
          </div>
        </div>
        <div className="k7-glass" />
        <div className="k7-copy">
          <p className="k7-caption" style={{ "--n": caption.length } as React.CSSProperties}>
            {caption}
          </p>
          <p className="k7-skip">toque pra pular</p>
        </div>
      </div>
    </div>
  );
}
