import { NextRequest, NextResponse } from "next/server";
import { pullManager } from "@/lib/pull-manager";

export async function GET(req: NextRequest) {
  const serverId = req.nextUrl.searchParams.get("serverId") || undefined;
  const jobs = pullManager.getStatus(serverId);
  return NextResponse.json(jobs);
}
