import { searchDeezer } from "@/lib/resolve";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (q.length < 2) return Response.json({ tracks: [] });

  try {
    return Response.json({ tracks: await searchDeezer(q) });
  } catch {
    return Response.json({ tracks: [], error: "a busca falhou, tenta de novo" }, { status: 502 });
  }
}
