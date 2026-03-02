import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  version: string;
  timestamp: string;
  checks: {
    database: "ok" | "error";
    uptime: number;
  };
}

const startTime = Date.now();

export async function GET() {
  let databaseStatus: "ok" | "error" = "ok";
  let status: "ok" | "degraded" | "error" = "ok";

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "error";
    status = "error";
  }

  const health: HealthStatus = {
    status,
    version: process.env.npm_package_version || "unknown",
    timestamp: new Date().toISOString(),
    checks: {
      database: databaseStatus,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    },
  };

  const httpStatus = status === "error" ? 503 : 200;

  return NextResponse.json(health, { status: httpStatus });
}
