export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [setting, userCount] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "setup_completed" } }),
    prisma.user.count(),
  ]);

  return NextResponse.json({
    completed: setting?.value === "true",
    hasAdmin: userCount > 0,
  });
}
