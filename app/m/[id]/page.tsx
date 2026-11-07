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
  const mix = getMix((await params).id);
  if (!mix) return { title: "fwd.fm" };
  const description = `${mix.tracks.length} ${mix.tracks.length === 1 ? "faixa" : "faixas"}${
    mix.author ? ` de ${mix.author}` : ""
  }. Abre no seu streaming favorito.`;
  return {
    title: `FWD: ${mix.title} · fwd.fm`,
    description,
    openGraph: { title: `FWD: ${mix.title}`, description, images: mix.tracks[0]?.cover ? [mix.tracks[0].cover] : [] },
  };
}

export default async function MixPage({ params, searchParams }: Props) {
  const [{ id }, { novo }] = await Promise.all([params, searchParams]);
  const mix = getMix(id);
  if (!mix) notFound();
  return <MixView mix={mix} isNew={novo === "1"} />;
}
