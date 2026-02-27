import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { showModel } from "@/lib/ollama";

export async function POST(req: NextRequest) {
  const { serverId, name } = await req.json();

  if (!serverId || !name) {
    return NextResponse.json(
      { error: "serverId and name are required" },
      { status: 400 }
    );
  }

  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  try {
    const data = await showModel(server.url, name);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to show model";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
