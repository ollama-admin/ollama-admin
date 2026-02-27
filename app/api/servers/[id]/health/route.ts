import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVersion } from "@/lib/ollama";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const server = await prisma.server.findUnique({
    where: { id: params.id },
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  try {
    const version = await getVersion(server.url);
    return NextResponse.json({
      id: server.id,
      status: "online",
      version: version.version,
    });
  } catch {
    return NextResponse.json({
      id: server.id,
      status: "offline",
    });
  }
}
