import Cassette from "./Cassette";
import { formatDuration } from "@/lib/format";

/** one side of a C90 */
const SIDE_SECONDS = 45 * 60;

export type TapeInsert = { id: number; label: string };

type Props = {
  count: number;
  total: number;
  title: string;
  /** the last addition; a new id replays the insert animation */
  lastAdd: TapeInsert | null;
};

const clock = (s: number) => {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/**
 * Tape deck above the attachment list: every addition drops a tape into the
 * slot, and the tape fills up as the mix gets longer (one C90 side).
 */
export default function TapeDeck({ count, total, title, lastAdd }: Props) {
  const empty = count === 0;
  const over = total > SIDE_SECONDS;

  return (
    <div className={`deck${empty ? " deck-is-empty" : ""}`}>
      <div className="deck-bay">
        {empty ? (
          <div className="deck-slot" aria-hidden="true" />
        ) : (
          <div key={lastAdd?.id ?? 0} className="deck-k7">
            <Cassette label={`FWD: ${title.trim() || "ouve isso"}`} progress={total / SIDE_SECONDS} />
          </div>
        )}
      </div>

      <div className="deck-panel">
        <div className="deck-lcd" aria-hidden="true">
          <span className="deck-led" />
          {empty ? (
            <span>INSIRA UMA FITA</span>
          ) : (
            <>
              <span>FX {String(count).padStart(2, "0")}</span>
              <span className={over ? "deck-over" : undefined}>
                {clock(total)}/{clock(SIDE_SECONDS)}
              </span>
            </>
          )}
        </div>
        {empty ? (
          <p className="deck-msg">nenhuma faixa ainda. cola um link aí em cima ↑</p>
        ) : (
          <p key={lastAdd?.id ?? 0} className="deck-msg deck-toast">
            {lastAdd ? <>▸ {lastAdd.label}</> : `${count} na fita`}
            {over && <span className="deck-warn"> · passou de um lado ({formatDuration(total)})</span>}
          </p>
        )}
      </div>
    </div>
  );
}
