import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MixView from "@/components/MixView";
import { getMix } from "@/lib/store";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const mix = await getMix((await params).id);
  if (!mix) return { title: "fwd.fm" };
  const count = `${mix.tracks.length} ${mix.tracks.length === 1 ? "faixa" : "faixas"}`;
  const images = mix.tracks[0]?.cover ? [mix.tracks[0].cover] : [];

  // Encrypted mixes: the server cannot read subject or sender, so the preview only shows the count.
  if (mix.secret) {
    const description = `${count} pra você. Abre no seu streaming favorito.`;
    return {
      title: `FWD: ${count} · fwd.fm`,
      description,
      robots: { index: false },
      openGraph: { title: `FWD: ${count}`, description, images },
    };
  }

  const description = `${count}${mix.author ? ` de ${mix.author}` : ""}. Abre no seu streaming favorito.`;
  return {
    title: `FWD: ${mix.title} · fwd.fm`,
    description,
    openGraph: { title: `FWD: ${mix.title}`, description, images },
  };
}

export default async function MixPage({ params, searchParams }: Props) {
  const [{ id }, { novo }] = await Promise.all([params, searchParams]);
  const mix = await getMix(id);
  if (!mix) notFound();
  return <MixView mix={mix} isNew={novo === "1"} />;
}
