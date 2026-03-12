export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lookupGpuSpecs } from "@/lib/gpu-specs";

interface GpuAgentInfo {
  name: string;
  memoryTotal: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("serverId");

  const server = serverId
    ? await prisma.server.findUnique({ where: { id: serverId } })
    : await prisma.server.findFirst({ where: { active: true } });

  if (!server?.gpuAgentUrl) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ gpuName: "NVIDIA GeForce RTX 4090", vramGB: 24, bandwidthGBs: 1008 });
    }
    return NextResponse.json(null);
  }

  try {
    const res = await fetch(`${server.gpuAgentUrl}/gpu`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return NextResponse.json(null);

    const gpuInfo: GpuAgentInfo[] = await res.json();
    if (!gpuInfo?.[0]) return NextResponse.json(null);

    const gpu = gpuInfo[0];
    const vramGB = gpu.memoryTotal / 1024 ** 3;
    const specs = lookupGpuSpecs(gpu.name, vramGB);

    return NextResponse.json({
      gpuName: gpu.name,
      vramGB,
      bandwidthGBs: specs?.bw ?? null,
    });
  } catch {
    return NextResponse.json(null);
  }
}
