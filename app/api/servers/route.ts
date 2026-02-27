import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const servers = await prisma.server.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(servers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, url, gpuAgentUrl, active } = body;

  if (!name || !url) {
    return NextResponse.json(
      { error: "Name and URL are required" },
      { status: 400 }
    );
  }

  const server = await prisma.server.create({
    data: {
      name,
      url: url.replace(/\/$/, ""),
      gpuAgentUrl: gpuAgentUrl || null,
      active: active ?? true,
    },
  });

  return NextResponse.json(server, { status: 201 });
}
