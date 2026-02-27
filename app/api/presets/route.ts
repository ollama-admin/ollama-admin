import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const presets = await prisma.preset.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(presets);
}

export async function POST(req: NextRequest) {
  const data = await req.json();

  if (!data.name?.trim()) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const preset = await prisma.preset.create({
    data: {
      name: data.name.trim(),
      temperature: data.temperature ?? null,
      topK: data.topK ?? null,
      topP: data.topP ?? null,
      numCtx: data.numCtx ?? null,
      numPredict: data.numPredict ?? null,
      systemPrompt: data.systemPrompt ?? null,
    },
  });

  return NextResponse.json(preset, { status: 201 });
}
