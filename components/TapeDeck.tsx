import Cassette from "./Cassette";
import type { TapePalette } from "@/lib/tapes";

export interface DeckTape {
  /** a new key ejects the old tape and slides this one in */
  key: string | number;
  label: string;
  art?: string | null;
  palette: TapePalette;
  /** 0..1, tape moving from the left reel to the right */
  progress: number;
  spinning?: boolean;
}

export type DeckKey = "rew" | "play" | "ff" | "stop" | "eject";

type Props = {
  tape: DeckTape | null;
  /** text on the green display */
  lcd: React.ReactNode;
  /** line under the deck */
  msg: React.ReactNode;
  /** the key shown pressed */
  active?: DeckKey | null;
  className?: string;
};

const KEYS: { id: DeckKey; d: string }[] = [
  { id: "rew", d: "M11 6v12L2 12zM22 6v12l-9-6z" },
  { id: "play", d: "M7 5v14l12-7z" },
  { id: "ff", d: "M2 6v12l9-6zM13 6v12l9-6z" },
  { id: "stop", d: "M6 6h12v12H6z" },
  { id: "eject", d: "M12 5l8 9H4zM4 16h16v3H4z" },
];

/**
 * The tape deck shown in the composer and on a mix page. Purely visual: the
 * keys mirror state, they are not controls (the real ones sit next to it).
 */
export default function TapeDeck({ tape, lcd, msg, active = null, className = "" }: Props) {
  return (
    <div className={`deck${tape ? "" : " deck-is-empty"}${className ? ` ${className}` : ""}`}>
      <div className="deck-top">
        <span className="deck-brand">fwd·deck</span>
        <span className="deck-lcd">
          <span className="deck-led" />
          {lcd}
        </span>
      </div>

      <div className="deck-bay" aria-hidden="true">
        {/* sizes the bay the same with or without a tape */}
        <Cassette className="deck-ghost" />
        {tape && (
          <div key={tape.key} className="deck-k7">
            <Cassette
              label={tape.label}
              art={tape.art}
              palette={tape.palette}
              progress={tape.progress}
              spinning={tape.spinning}
            />
          </div>
        )}
        <div className="deck-glass" />
      </div>

      <div className="deck-keys" aria-hidden="true">
        {KEYS.map((k) => (
          <span key={k.id} className={active === k.id ? "deck-key deck-key-on" : "deck-key"}>
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path d={k.d} fill="currentColor" />
            </svg>
          </span>
        ))}
      </div>

      <p className="deck-msg">{msg}</p>
    </div>
  );
}
