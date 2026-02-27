import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") || "";

  const where = search
    ? {
        OR: [
          { title: { contains: search } },
          { messages: { some: { content: { contains: search } } } },
        ],
      }
    : {};

  const chats = await prisma.chat.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      server: { select: { name: true } },
    },
  });

  return NextResponse.json(chats);
}

export async function POST(req: NextRequest) {
  const { title, model, serverId, parameters } = await req.json();

  if (!model || !serverId) {
    return NextResponse.json(
      { error: "model and serverId are required" },
      { status: 400 }
    );
  }

  const chat = await prisma.chat.create({
    data: {
      title: title || "New Conversation",
      model,
      serverId,
      parameters: parameters ? JSON.stringify(parameters) : null,
    },
  });

  return NextResponse.json(chat, { status: 201 });
}
