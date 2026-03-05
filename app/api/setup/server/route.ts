import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const server = await prisma.server.findFirst({ orderBy: { createdAt: "asc" } });
  if (!server) {
    return NextResponse.json({ error: "No server found" }, { status: 404 });
  }
  return NextResponse.json(server);
}

export async function POST(req: NextRequest) {
  // Only allow during setup
  const setting = await prisma.settings.findUnique({
    where: { key: "setup_completed" },
  });
  if (setting?.value === "true") {
    return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
  }

  const { name, url } = await req.json();

  if (!name || !url) {
    return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
  }

  const server = await prisma.server.create({
    data: {
      name,
      url: url.replace(/\/$/, ""),
      active: true,
    },
  });

  return NextResponse.json(server, { status: 201 });
}
