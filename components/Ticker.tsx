import { PLATFORMS } from "@/lib/platforms";

const ITEMS = [
  "FW: FW: FW: ouve essa",
  ...PLATFORMS.map((p) => p.name),
  "sem login",
  "um link, qualquer streaming",
  "playlist de 3 ou de 300",
];

export default function Ticker() {
  // Rendered twice so the marquee loops seamlessly at -50%.
  const items = [...ITEMS, ...ITEMS];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {items.map((item, i) => (
          <span key={i}>✦ {item}</span>
        ))}
      </div>
    </div>
  );
}
