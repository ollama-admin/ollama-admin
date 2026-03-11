export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await prisma.log.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    include: {
      server: { select: { name: true } },
      apiKey: { select: { id: true, name: true } },
    },
  });

  const requestsByDay: Record<string, number> = {};
  const tokensByDay: Record<string, number> = {};
  const tokensByModel: Record<string, number> = {};
  const latencyByModel: Record<string, { total: number; count: number }> = {};
  const modelUsage: Record<string, number> = {};
  const apiKeyUsageMap: Record<string, { name: string; requests: number; tokens: number }> = {};
  let errorCount = 0;

  for (const log of logs) {
    const day = log.createdAt.toISOString().split("T")[0];
    requestsByDay[day] = (requestsByDay[day] || 0) + 1;

    const totalTokens = (log.promptTokens || 0) + (log.completionTokens || 0);
    tokensByDay[day] = (tokensByDay[day] || 0) + totalTokens;
    tokensByModel[log.model] = (tokensByModel[log.model] || 0) + totalTokens;

    if (!latencyByModel[log.model]) {
      latencyByModel[log.model] = { total: 0, count: 0 };
    }
    latencyByModel[log.model].total += log.latencyMs;
    latencyByModel[log.model].count += 1;

    modelUsage[log.model] = (modelUsage[log.model] || 0) + 1;

    if (log.apiKeyId && log.apiKey) {
      if (!apiKeyUsageMap[log.apiKeyId]) {
        apiKeyUsageMap[log.apiKeyId] = { name: log.apiKey.name, requests: 0, tokens: 0 };
      }
      apiKeyUsageMap[log.apiKeyId].requests += 1;
      apiKeyUsageMap[log.apiKeyId].tokens += totalTokens;
    }

    if (log.statusCode >= 400) errorCount++;
  }

  const avgLatencyByModel: Record<string, number> = {};
  for (const [model, data] of Object.entries(latencyByModel)) {
    avgLatencyByModel[model] = Math.round(data.total / data.count);
  }

  const topModels = Object.entries(modelUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([model, count]) => ({ model, count }));

  const apiKeyUsage = Object.entries(apiKeyUsageMap)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.requests - a.requests);

  return NextResponse.json({
    totalRequests: logs.length,
    errorCount,
    errorRate: logs.length > 0 ? ((errorCount / logs.length) * 100).toFixed(1) : "0",
    requestsByDay,
    tokensByDay,
    tokensByModel,
    avgLatencyByModel,
    topModels,
    apiKeyUsage,
  });
}
