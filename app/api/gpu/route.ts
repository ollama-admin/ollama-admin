import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  memoryFree: number;
  temperature: number;
  utilization: number;
}

interface ServerGpuData {
  serverId: string;
  serverName: string;
  runningModels: RunningModel[];
  gpuInfo: GpuInfo[] | null;
  error?: string;
}

export async function GET() {
  const servers = await prisma.server.findMany({
    where: { active: true },
  });

  const results: ServerGpuData[] = await Promise.all(
    servers.map(async (server) => {
      const result: ServerGpuData = {
        serverId: server.id,
        serverName: server.name,
        runningModels: [],
        gpuInfo: null,
      };

      try {
        const psRes = await fetch(`${server.url}/api/ps`, {
          signal: AbortSignal.timeout(5000),
        });
        if (psRes.ok) {
          const data = await psRes.json();
          result.runningModels = data.models || [];
        }
      } catch {
        result.error = "Could not connect to Ollama server";
      }

      if (server.gpuAgentUrl) {
        try {
          const gpuRes = await fetch(`${server.gpuAgentUrl}/gpu`, {
            signal: AbortSignal.timeout(5000),
          });
          if (gpuRes.ok) {
            result.gpuInfo = await gpuRes.json();
          }
        } catch {
          // GPU agent not available
        }
      }

      return result;
    })
  );

  return NextResponse.json(results);
}
