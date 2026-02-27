import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const setting = await prisma.settings.findUnique({
    where: { key: "setup_completed" },
  });

  return NextResponse.json({
    completed: setting?.value === "true",
  });
}
