import { resolveInput } from "@/lib/resolve";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { input?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input.slice(0, 20_000) : "";
  if (!input.trim()) return Response.json({ error: "cola algum link primeiro" }, { status: 400 });

  return Response.json(await resolveInput(input));
}
