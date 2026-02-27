import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();

  for (const [key, value] of Object.entries(data)) {
    await prisma.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  return NextResponse.json({ ok: true });
}
