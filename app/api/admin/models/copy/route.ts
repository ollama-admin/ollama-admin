import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { copyModel } from "@/lib/ollama";

export async function POST(req: NextRequest) {
  const { serverId, source, destination } = await req.json();

  if (!serverId || !source || !destination) {
    return NextResponse.json(
      { error: "serverId, source, and destination are required" },
      { status: 400 }
    );
  }

  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  try {
    await copyModel(server.url, source, destination);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to copy model";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
