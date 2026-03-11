import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await req.json();

  try {
    const alert = await prisma.alert.update({
      where: { id: id },
      data: {
        ...(data.threshold !== undefined ? { threshold: Number(data.threshold) } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      },
    });
    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.alert.delete({ where: { id: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
}
