import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await prisma.settings.upsert({
    where: { key: "setup_completed" },
    update: { value: "true" },
    create: { key: "setup_completed", value: "true" },
  });

  return NextResponse.json({ ok: true });
}
