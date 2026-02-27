import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") || "json";
  const serverId = req.nextUrl.searchParams.get("serverId");

  const where: Record<string, unknown> = {};
  if (serverId) where.serverId = serverId;

  const logs = await prisma.log.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { server: { select: { name: true } } },
  });

  if (format === "csv") {
    const header =
      "timestamp,server,model,endpoint,prompt_tokens,completion_tokens,latency_ms,status_code,user_id,ip";
    const rows = logs.map(
      (l) =>
        `${l.createdAt.toISOString()},${l.server.name},${l.model},${l.endpoint},${l.promptTokens || 0},${l.completionTokens || 0},${l.latencyMs},${l.statusCode},${l.userId || ""},${l.ip || ""}`
    );
    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=ollama-admin-logs.csv",
      },
    });
  }

  return NextResponse.json(logs, {
    headers: {
      "Content-Disposition": "attachment; filename=ollama-admin-logs.json",
    },
  });
}
