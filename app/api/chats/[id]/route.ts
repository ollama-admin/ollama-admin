export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await prisma.chat.findUnique({
    where: { id: id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      server: true,
    },
  });

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json(chat);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { title, parameters, model, serverId } = await req.json();

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (parameters !== undefined)
    data.parameters = parameters ? JSON.stringify(parameters) : null;
  if (model !== undefined) data.model = model;
  if (serverId !== undefined) data.serverId = serverId;

  try {
    const chat = await prisma.chat.update({
      where: { id: id },
      data,
    });
    return NextResponse.json(chat);
  } catch {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.chat.delete({ where: { id: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
}
