import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.preset.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const data = await req.json();

  try {
    const preset = await prisma.preset.update({
      where: { id: params.id },
      data: {
        name: data.name?.trim(),
        temperature: data.temperature ?? null,
        topK: data.topK ?? null,
        topP: data.topP ?? null,
        numCtx: data.numCtx ?? null,
        numPredict: data.numPredict ?? null,
        systemPrompt: data.systemPrompt ?? null,
      },
    });
    return NextResponse.json(preset);
  } catch {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }
}
