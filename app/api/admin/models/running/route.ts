import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listRunningModels } from "@/lib/ollama";

export async function GET(req: NextRequest) {
  const serverId = req.nextUrl.searchParams.get("serverId");

  if (!serverId) {
    return NextResponse.json(
      { error: "serverId is required" },
      { status: 400 }
    );
  }

  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  try {
    const data = await listRunningModels(server.url);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list running models";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
