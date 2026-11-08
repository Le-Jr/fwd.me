import { useId } from "react";
import { TAPES, type TapePalette } from "@/lib/tapes";

type Props = {
  /** handwritten line on the label */
  label?: string;
  /** small sticker on the label (track cover) */
  art?: string | null;
  /** reels turn while true */
  spinning?: boolean;
  /** 0 = all tape on the left reel, 1 = all on the right */
  progress?: number;
  side?: string;
  /** colors; defaults to the house neon tape */
  palette?: TapePalette;
  className?: string;
};

const LABEL_CHARS = 22;
const HUB_R = 7;
const REELS = [56, 104] as const;

/**
 * A compact cassette tape drawn in SVG, decorative only (aria-hidden).
 * Reels spin with CSS (`.k7-on`), and the tape packs grow and shrink with `progress`.
 */
export default function Cassette({
  label,
  art,
  spinning = false,
  progress = 0,
  side = "A",
  palette = TAPES[0],
  className = "",
}: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const packs = [10 + 14 * (1 - p), 10 + 14 * p];
  const text = label && label.length > LABEL_CHARS ? `${label.slice(0, LABEL_CHARS - 1)}…` : label;

  return (
    <svg
      className={`k7${spinning ? " k7-on" : ""}${className ? ` ${className}` : ""}`}
      viewBox="0 0 160 100"
      aria-hidden="true"
      focusable="false"
      style={
        {
          "--k7-shell": palette.shell,
          "--k7-bottom": palette.bottom,
          "--k7-label": palette.label,
          "--k7-ink": palette.ink,
        } as React.CSSProperties
      }
    >
      <defs>
        <clipPath id={`win${id}`}>
          <rect x="38" y="31" width="84" height="26" rx="13" />
        </clipPath>
        <linearGradient id={`band${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={palette.band[0]} />
          <stop offset="0.5" stopColor={palette.band[1]} />
          <stop offset="1" stopColor={palette.band[2]} />
        </linearGradient>
      </defs>

      <rect className="k7-shell" x="1.5" y="1.5" width="157" height="97" rx="7" />
      {[
        [8, 8],
        [152, 8],
        [8, 92],
        [152, 92],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} className="k7-screw" cx={cx} cy={cy} r="2.2" />
      ))}

      <rect className="k7-label" x="11" y="8" width="138" height="56" rx="4" />
      <rect x="11" y="28" width="138" height="32" fill={`url(#band${id})`} />
      {text && (
        <text className="k7-text" x="16" y="22">
          {text}
        </text>
      )}
      {art && (
        <image href={art} x="14" y="31" width="22" height="26" preserveAspectRatio="xMidYMid slice" />
      )}
      <circle className="k7-label" cx="134" cy="44" r="9" />
      <text className="k7-side" x="134" y="49.5" textAnchor="middle">
        {side}
      </text>

      <rect className="k7-window" x="38" y="31" width="84" height="26" rx="13" />
      <g clipPath={`url(#win${id})`}>
        {REELS.map((cx, i) => (
          <circle key={cx} className={`k7-tape k7-tape-${i}`} cx={cx} cy="44" r={packs[i]} />
        ))}
      </g>
      {REELS.map((cx) => (
        <g key={cx} className="k7-reel">
          <circle className="k7-hub" cx={cx} cy="44" r={HUB_R} />
          <circle className="k7-hole" cx={cx} cy="44" r="4.2" />
          {[0, 120, 240].map((a) => (
            <rect key={a} className="k7-hub" x={cx - 1} y={44 - 4.4} width="2" height="2.2" transform={`rotate(${a} ${cx} 44)`} />
          ))}
        </g>
      ))}

      <path className="k7-bottom" d="M34 98 L42 74 H118 L126 98" />
      <circle className="k7-hole" cx="54" cy="88" r="3" />
      <circle className="k7-hole" cx="106" cy="88" r="3" />
      <rect className="k7-hole" x="70" y="84" width="5" height="5" rx="1" />
      <rect className="k7-hole" x="85" y="84" width="5" height="5" rx="1" />
    </svg>
  );
}
