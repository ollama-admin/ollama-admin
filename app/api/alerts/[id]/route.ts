import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const data = await req.json();

  try {
    const alert = await prisma.alert.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    await prisma.alert.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
}
