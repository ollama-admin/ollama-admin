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
  const checks = {
    database: "ok" as const,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  let status: "ok" | "degraded" | "error" = "ok";

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.database = "error";
    status = "error";
  }

  const health: HealthStatus = {
    status,
    version: process.env.npm_package_version || "unknown",
    timestamp: new Date().toISOString(),
    checks,
  };

  const httpStatus = status === "ok" ? 200 : status === "degraded" ? 200 : 503;

  return NextResponse.json(health, { status: httpStatus });
}
