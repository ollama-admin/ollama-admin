export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { lookupGpuSpecs } from "@/lib/gpu-specs";
import { scoreModel, type ModelScore } from "@/lib/model-scoring";

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

export interface ModelCompatibility extends ModelScore {
  name: string;
  sizeGB: number;
}

interface ServerGpuData {
  serverId: string;
  serverName: string;
  runningModels: RunningModel[];
  gpuInfo: GpuInfo[] | null;
  modelCompatibility: ModelCompatibility[] | null;
  error?: string;
}

function generateDummyGpuData(): GpuInfo[] {
  const baseUtil = 35 + Math.random() * 30;
  const baseMem = 4 * 1024 * 1024 * 1024 + Math.random() * 4 * 1024 * 1024 * 1024;
  const totalMem = 24 * 1024 * 1024 * 1024;
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

function generateDummyRunningModels(): RunningModel[] {
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

const DUMMY_AVAILABLE_MODELS = [
  { name: "llama3.1:8b",   sizeBytes: 4.7  * 1024 ** 3 },
  { name: "llama3.1:70b",  sizeBytes: 40.0 * 1024 ** 3 },
  { name: "mistral:7b",    sizeBytes: 4.1  * 1024 ** 3 },
  { name: "codellama:13b", sizeBytes: 7.4  * 1024 ** 3 },
  { name: "gemma2:9b",     sizeBytes: 5.4  * 1024 ** 3 },
  { name: "phi3:mini",     sizeBytes: 2.2  * 1024 ** 3 },
  { name: "mixtral:8x7b",  sizeBytes: 26.0 * 1024 ** 3 },
  { name: "llama3.1:405b", sizeBytes: 229  * 1024 ** 3 },
];

function buildCompatibility(
  models: Array<{ name: string; sizeBytes: number }>,
  gpuInfo: GpuInfo[]
): ModelCompatibility[] {
  if (gpuInfo.length === 0) return [];

  const gpu = gpuInfo[0];
  const vramGB = gpu.memoryTotal / 1024 ** 3;
  const specs = lookupGpuSpecs(gpu.name, vramGB);

  return models
    .map(({ name, sizeBytes }) => {
      const sizeGB = sizeBytes / 1024 ** 3;
      const score = scoreModel(sizeGB, vramGB, specs?.bw);
      return { name, sizeGB, ...score };
    })
    .sort((a, b) => {
      const gradeOrder = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 };
      const gDiff = gradeOrder[a.grade] - gradeOrder[b.grade];
      return gDiff !== 0 ? gDiff : b.tps - a.tps;
    });
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
        modelCompatibility: null,
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

      // Fetch available models and compute compatibility scores
      if (result.gpuInfo && !result.error) {
        try {
          const tagsRes = await fetch(`${server.url}/api/tags`, {
            signal: AbortSignal.timeout(5000),
          });
          if (tagsRes.ok) {
            const tagsData = await tagsRes.json();
            const models: Array<{ name: string; size: number }> =
              tagsData.models || [];
            result.modelCompatibility = buildCompatibility(
              models.map((m) => ({ name: m.name, sizeBytes: m.size })),
              result.gpuInfo
            );
          }
        } catch {
          // model compatibility unavailable, not critical
        }
      }

      if (process.env.NODE_ENV === "development" && !result.gpuInfo) {
        result.gpuInfo = generateDummyGpuData();
        if (result.runningModels.length === 0 && !result.error) {
          result.runningModels = generateDummyRunningModels();
        }
        result.modelCompatibility = buildCompatibility(
          DUMMY_AVAILABLE_MODELS,
          result.gpuInfo
        );
      }

      return result;
    })
  );

  return NextResponse.json(results);
}
