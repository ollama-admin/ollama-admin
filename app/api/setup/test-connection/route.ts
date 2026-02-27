import { NextRequest, NextResponse } from "next/server";
import { getVersion } from "@/lib/ollama";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const version = await getVersion(url);
    return NextResponse.json({ status: "online", version: version.version });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ status: "offline", error: message });
  }
}
