import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const { type, threshold, enabled } = await req.json();

  if (!type || threshold === undefined) {
    return NextResponse.json(
      { error: "type and threshold are required" },
      { status: 400 }
    );
  }

  const validTypes = ["gpu_temperature", "gpu_vram", "error_rate", "latency"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const alert = await prisma.alert.create({
    data: {
      type,
      threshold: Number(threshold),
      enabled: enabled !== false,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}
