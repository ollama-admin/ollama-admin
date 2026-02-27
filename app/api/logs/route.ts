import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const serverId = req.nextUrl.searchParams.get("serverId");
  const model = req.nextUrl.searchParams.get("model");
  const status = req.nextUrl.searchParams.get("status");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);

  const where: Record<string, unknown> = {};

  if (serverId) where.serverId = serverId;
  if (model) where.model = { contains: model };
  if (status === "success") where.statusCode = { lt: 400 };
  if (status === "error") where.statusCode = { gte: 400 };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { server: { select: { name: true } } },
    }),
    prisma.log.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
