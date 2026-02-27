import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const format = req.nextUrl.searchParams.get("format") || "json";

  const chat = await prisma.chat.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      server: { select: { name: true } },
    },
  });

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  if (format === "markdown") {
    let md = `# ${chat.title}\n\n`;
    md += `**Model:** ${chat.model}  \n`;
    md += `**Server:** ${chat.server.name}  \n`;
    md += `**Date:** ${chat.createdAt.toISOString().split("T")[0]}\n\n---\n\n`;

    for (const msg of chat.messages) {
      const role = msg.role === "user" ? "User" : "Assistant";
      md += `### ${role}\n\n${msg.content}\n\n`;
      if (msg.role === "assistant" && msg.latencyMs) {
        md += `*${(msg.promptTokens || 0) + (msg.completionTokens || 0)} tokens · ${msg.latencyMs}ms*\n\n`;
      }
    }

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${chat.title.replace(/[^a-zA-Z0-9]/g, "_")}.md"`,
      },
    });
  }

  const jsonData = {
    id: chat.id,
    title: chat.title,
    model: chat.model,
    server: chat.server.name,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages: chat.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.images ? { images: JSON.parse(m.images) } : {}),
      ...(m.promptTokens ? { promptTokens: m.promptTokens } : {}),
      ...(m.completionTokens ? { completionTokens: m.completionTokens } : {}),
      ...(m.latencyMs ? { latencyMs: m.latencyMs } : {}),
      createdAt: m.createdAt,
    })),
  };

  return new Response(JSON.stringify(jsonData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${chat.title.replace(/[^a-zA-Z0-9]/g, "_")}.json"`,
    },
  });
}
