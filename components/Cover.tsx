/* eslint-disable @next/next/no-img-element -- covers come from many CDNs */
export default function Cover({ src }: { src?: string }) {
  if (!src) return <span className="cover" aria-hidden="true" />;
  return <img className="cover" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />;
}
