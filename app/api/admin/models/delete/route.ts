import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteModel } from "@/lib/ollama";
import { logger } from "@/lib/logger";

export async function DELETE(req: NextRequest) {
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
  if (!server.active) {
    return NextResponse.json({ error: "Server is inactive" }, { status: 403 });
  }

  try {
    await deleteModel(server.url, name);
    logger.info("Model deleted", { model: name, server: server.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete model";
    logger.error("Failed to delete model", { model: name, error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
