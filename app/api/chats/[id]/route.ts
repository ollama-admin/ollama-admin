import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const chat = await prisma.chat.findUnique({
    where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  const { title, parameters } = await req.json();

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (parameters !== undefined)
    data.parameters = parameters ? JSON.stringify(parameters) : null;

  try {
    const chat = await prisma.chat.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(chat);
  } catch {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.chat.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
}
