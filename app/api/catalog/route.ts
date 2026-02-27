import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") || "";
  const family = req.nextUrl.searchParams.get("family") || "";

  const where: Record<string, unknown> = {};

  if (search) {
    where.name = { contains: search };
  }
  if (family) {
    where.family = family;
  }

  const models = await prisma.catalogModel.findMany({
    where,
    orderBy: { pullCount: "desc" },
  });

  return NextResponse.json(models);
}
