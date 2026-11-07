import { NextResponse } from "next/server";
import { getPlatform } from "@/lib/platforms";
import { lookupLinks } from "@/lib/resolve";
import { getTrack, saveTrackLinks } from "@/lib/store";

/**
 * Sends the listener to the track on their platform. Missing links are looked
 * up on first click; if that fails we fall back to the platform's search page.
 */
export async function GET(req: Request, { params }: { params: Promise<{ trackId: string; platform: string }> }) {
  const { trackId, platform } = await params;
  const track = await getTrack(trackId);
  const target = getPlatform(platform);
  if (!track || !target) return NextResponse.redirect(new URL("/", req.url));

  let links = track.links;
  if (!links[target.id] && !track.resolvedAt) {
    const found = await lookupLinks(track).catch(() => null);
    if (found) {
      links = { ...found, ...links };
      await saveTrackLinks(track.id, links);
    }
  }

  return NextResponse.redirect(links[target.id] ?? target.search(`${track.artist} ${track.title}`));
}
