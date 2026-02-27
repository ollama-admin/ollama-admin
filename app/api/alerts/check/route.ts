import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface AlertResult {
  alertId: string;
  type: string;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  detail: string;
}

export async function GET() {
  const alerts = await prisma.alert.findMany({ where: { enabled: true } });
  if (alerts.length === 0) {
    return NextResponse.json([]);
  }

  const results: AlertResult[] = [];

  for (const alert of alerts) {
    if (alert.type === "error_rate") {
      const since = new Date();
      since.setHours(since.getHours() - 1);
      const logs = await prisma.log.findMany({
        where: { createdAt: { gte: since } },
      });
      const total = logs.length;
      const errors = logs.filter((l) => l.statusCode >= 400).length;
      const rate = total > 0 ? (errors / total) * 100 : 0;

      results.push({
        alertId: alert.id,
        type: alert.type,
        threshold: alert.threshold,
        currentValue: Math.round(rate * 10) / 10,
        triggered: rate > alert.threshold,
        detail: `${errors}/${total} errors in last hour`,
      });
    }

    if (alert.type === "latency") {
      const since = new Date();
      since.setHours(since.getHours() - 1);
      const logs = await prisma.log.findMany({
        where: { createdAt: { gte: since } },
      });
      const avgLatency =
        logs.length > 0
          ? logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length
          : 0;

      results.push({
        alertId: alert.id,
        type: alert.type,
        threshold: alert.threshold,
        currentValue: Math.round(avgLatency),
        triggered: avgLatency > alert.threshold,
        detail: `Avg ${Math.round(avgLatency)}ms over ${logs.length} requests`,
      });
    }

    if (alert.type === "gpu_temperature" || alert.type === "gpu_vram") {
      const servers = await prisma.server.findMany({
        where: { active: true, gpuAgentUrl: { not: null } },
      });

      for (const server of servers) {
        if (!server.gpuAgentUrl) continue;
        try {
          const gpuRes = await fetch(`${server.gpuAgentUrl}/gpu`, {
            signal: AbortSignal.timeout(5000),
          });
          if (!gpuRes.ok) continue;
          const gpus: Array<{
            name: string;
            temperature: number;
            memoryUsed: number;
            memoryTotal: number;
          }> = await gpuRes.json();

          for (const gpu of gpus) {
            if (alert.type === "gpu_temperature") {
              results.push({
                alertId: alert.id,
                type: alert.type,
                threshold: alert.threshold,
                currentValue: gpu.temperature,
                triggered: gpu.temperature > alert.threshold,
                detail: `${gpu.name} on ${server.name}: ${gpu.temperature}°C`,
              });
            }
            if (alert.type === "gpu_vram") {
              const usedPct =
                gpu.memoryTotal > 0
                  ? (gpu.memoryUsed / gpu.memoryTotal) * 100
                  : 0;
              results.push({
                alertId: alert.id,
                type: alert.type,
                threshold: alert.threshold,
                currentValue: Math.round(usedPct),
                triggered: usedPct > alert.threshold,
                detail: `${gpu.name} on ${server.name}: ${Math.round(usedPct)}% VRAM`,
              });
            }
          }
        } catch {
          // GPU agent unreachable
        }
      }
    }
  }

  return NextResponse.json(results);
}
