import { randomTrack } from "@/lib/radio";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const track = await randomTrack();
    if (!track) return Response.json({ error: "sem música agora" }, { status: 502 });
    return Response.json({ track }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "o Deezer não respondeu" }, { status: 502 });
  }
}
