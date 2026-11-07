import { needsLinks, resolveMixLinks, withYoutubePair, youtubePlaylist } from "@/lib/mixLinks";
import { getMix } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Everything the share page needs to open the whole mix: every track's links
 * (looked up now if missing) and a ready-made YouTube / YT Music playlist.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mix = getMix(id);
  if (!mix) return Response.json({ error: "mix não encontrado" }, { status: 404 });

  const tracks = mix.tracks.some(needsLinks) ? ((await resolveMixLinks(id)) ?? mix.tracks) : mix.tracks;
  const playlist = await youtubePlaylist(tracks);
  return Response.json(
    { tracks: tracks.map((t) => ({ id: t.id, links: withYoutubePair(t.links) })), playlist },
    { headers: { "cache-control": "no-store" } },
  );
}
