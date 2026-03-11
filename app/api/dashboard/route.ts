export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface RunningModel {
  name: string;
  size: number;
  size_vram: number;
  expires_at: string;
}

interface GpuInfo {
  name: string;
  memoryTotal: number;
  memoryUsed: number;
  utilization: number;
}

interface ServerStatus {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline";
  version?: string;
  runningModels: RunningModel[];
  gpu: GpuInfo[] | null;
}

function generateDummyGpuData(): GpuInfo[] {
  const baseMem = 4 * 1024 * 1024 * 1024 + Math.random() * 4 * 1024 * 1024 * 1024;
  const totalMem = 12 * 1024 * 1024 * 1024;
  return [
    {
      name: "NVIDIA GeForce RTX 4090",
      memoryTotal: totalMem,
      memoryUsed: Math.round(baseMem),
      utilization: Math.round(35 + Math.random() * 30),
    },
  ];
}

function generateDummyModels(): RunningModel[] {
  const now = new Date();
  return [
    {
      name: "llama3.1:8b",
      size: 4.7 * 1024 * 1024 * 1024,
      size_vram: 4.7 * 1024 * 1024 * 1024,
      expires_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    },
    {
      name: "codellama:13b",
      size: 7.4 * 1024 * 1024 * 1024,
      size_vram: 7.4 * 1024 * 1024 * 1024,
      expires_at: new Date(now.getTime() + 3 * 60 * 1000).toISOString(),
    },
  ];
}

export async function GET() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const start24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [logsToday, logsYesterday, logs24h, servers] = await Promise.all([
    prisma.log.findMany({
      where: { createdAt: { gte: startOfToday } },
      select: {
        latencyMs: true,
        statusCode: true,
        promptTokens: true,
        completionTokens: true,
        model: true,
        createdAt: true,
      },
    }),
    prisma.log.count({
      where: { createdAt: { gte: startOfYesterday, lt: startOfToday } },
    }),
    prisma.log.findMany({
      where: { createdAt: { gte: start24hAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.server.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
  ]);

  // KPIs from today's logs
  const errorCount = logsToday.filter((l) => l.statusCode >= 400).length;
  const tokensToday = logsToday.reduce(
    (sum, l) => sum + (l.promptTokens ?? 0) + (l.completionTokens ?? 0),
    0
  );

  const latencies = logsToday.map((l) => l.latencyMs).sort((a, b) => a - b);
  const avgLatencyMs =
    latencies.length > 0 ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0;
  const p95LatencyMs =
    latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] ?? 0 : 0;

  // Top 5 models today
  const modelCounts: Record<string, number> = {};
  for (const log of logsToday) {
    modelCounts[log.model] = (modelCounts[log.model] ?? 0) + 1;
  }
  const topModels = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([model, count]) => ({ model, count }));

  // Requests per hour — last 24 buckets
  const hourBuckets: Record<string, number> = {};
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`;
    hourBuckets[key] = 0;
  }
  for (const log of logs24h) {
    const d = log.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`;
    if (key in hourBuckets) hourBuckets[key]++;
  }
  const requestsPerHour = Object.entries(hourBuckets).map(([hour, count]) => ({ hour, count }));

  // Server health + running models + GPU
  const serverStatuses: ServerStatus[] = await Promise.all(
    servers.map(async (server) => {
      const result: ServerStatus = {
        id: server.id,
        name: server.name,
        url: server.url,
        status: "offline",
        runningModels: [],
        gpu: null,
      };

      try {
        const res = await fetch(`${server.url}/api/version`, {
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          result.status = "online";
          result.version = data.version;
        }
      } catch {
        logger.warn("Server health check failed", { server: server.name });
      }

      if (result.status === "online") {
        try {
          const psRes = await fetch(`${server.url}/api/ps`, {
            signal: AbortSignal.timeout(4000),
          });
          if (psRes.ok) {
            const data = await psRes.json();
            result.runningModels = data.models ?? [];
          }
        } catch {
          // not critical
        }
      }

      if (server.gpuAgentUrl) {
        try {
          const gpuRes = await fetch(`${server.gpuAgentUrl}/gpu`, {
            signal: AbortSignal.timeout(4000),
          });
          if (gpuRes.ok) {
            const data = await gpuRes.json();
            result.gpu = data.map((g: GpuInfo) => ({
              name: g.name,
              memoryTotal: g.memoryTotal,
              memoryUsed: g.memoryUsed,
              utilization: g.utilization,
            }));
          }
        } catch {
          // GPU agent not available
        }
      }

      if (process.env.NODE_ENV === "development" && !result.gpu) {
        result.gpu = generateDummyGpuData();
        if (result.runningModels.length === 0 && result.status === "online") {
          result.runningModels = generateDummyModels();
        }
      }

      return result;
    })
  );

  const serversOnline = serverStatuses.filter((s) => s.status === "online").length;

  return NextResponse.json({
    kpis: {
      serversOnline,
      serversTotal: servers.length,
      requestsToday: logsToday.length,
      requestsYesterday: logsYesterday,
      tokensToday,
      avgLatencyMs,
      p95LatencyMs,
      errorCount,
      errorRate:
        logsToday.length > 0 ? ((errorCount / logsToday.length) * 100).toFixed(1) : "0.0",
    },
    requestsPerHour,
    topModels,
    servers: serverStatuses,
  });
}
