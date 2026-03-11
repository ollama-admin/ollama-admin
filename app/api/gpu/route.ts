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
  memoryFree: number;
  temperature: number;
  utilization: number;
  powerDraw: number | null;
}

interface ServerGpuData {
  serverId: string;
  serverName: string;
  runningModels: RunningModel[];
  gpuInfo: GpuInfo[] | null;
  error?: string;
}

function generateDummyGpuData(): GpuInfo[] {
  const baseUtil = 35 + Math.random() * 30;
  const baseMem = 4 * 1024 * 1024 * 1024 + Math.random() * 4 * 1024 * 1024 * 1024;
  const totalMem = 12 * 1024 * 1024 * 1024;
  return [
    {
      name: "NVIDIA GeForce RTX 4090",
      memoryTotal: totalMem,
      memoryUsed: Math.round(baseMem),
      memoryFree: Math.round(totalMem - baseMem),
      temperature: Math.round(45 + Math.random() * 25),
      utilization: Math.round(baseUtil),
      powerDraw: Math.round((120 + Math.random() * 180) * 10) / 10,
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
        logger.warn("Cannot reach Ollama", { server: server.name, url: server.url });
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

      // In development, provide dummy data when no GPU agent is configured
      if (process.env.NODE_ENV === "development" && !result.gpuInfo) {
        result.gpuInfo = generateDummyGpuData();
        if (result.runningModels.length === 0 && !result.error) {
          result.runningModels = generateDummyModels();
        }
      }

      return result;
    })
  );

  return NextResponse.json(results);
}
