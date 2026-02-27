import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { active } = await req.json();

  try {
    const key = await prisma.apiKey.update({
      where: { id: params.id },
      data: { active },
    });
    return NextResponse.json({ id: key.id, active: key.active });
  } catch {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.apiKey.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }
}
