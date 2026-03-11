import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { active } = await req.json();

  try {
    const key = await prisma.apiKey.update({
      where: { id: id },
      data: { active },
    });
    return NextResponse.json({ id: key.id, active: key.active });
  } catch {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.apiKey.delete({ where: { id: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }
}
