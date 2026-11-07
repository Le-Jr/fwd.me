import { after } from "next/server";
import { resolveMixLinks } from "@/lib/mixLinks";
import { MAX_TRACKS } from "@/lib/resolve";
import { createMix } from "@/lib/store";
import type { Track } from "@/lib/types";
import { ENVELOPE_RE } from "@/lib/crypto";
import { cleanTrack } from "@/lib/validate";

// the after() hook looks every link up once the response is sent
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.tracks)) {
    return Response.json({ error: "formato inválido" }, { status: 400 });
  }
  // subject, note and sender arrive already encrypted; plaintext is never accepted
  if (typeof body.secret !== "string" || !ENVELOPE_RE.test(body.secret)) {
    return Response.json({ error: "mensagem sem criptografia" }, { status: 400 });
  }

  const tracks = body.tracks
    .slice(0, MAX_TRACKS)
    .map(cleanTrack)
    .filter((t): t is Track => t !== null);
  if (tracks.length === 0) {
    return Response.json({ error: "adiciona pelo menos uma faixa" }, { status: 400 });
  }

  const id = await createMix({ secret: body.secret, tracks });
  // look every link up now, so friends never wait on the first click
  after(() => resolveMixLinks(id).catch(() => null));
  return Response.json({ id }, { status: 201 });
}
