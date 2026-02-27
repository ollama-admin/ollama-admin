import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json(server);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { name, url, gpuAgentUrl, active } = body;

  try {
    const server = await prisma.server.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url: url.replace(/\/$/, "") }),
        ...(gpuAgentUrl !== undefined && { gpuAgentUrl: gpuAgentUrl || null }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json(server);
  } catch {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.server.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }
}
