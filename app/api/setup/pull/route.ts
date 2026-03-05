import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // Only allow during setup (before setup is completed)
  const setting = await prisma.settings.findUnique({
    where: { key: "setup_completed" },
  });
  if (setting?.value === "true") {
    return new Response(JSON.stringify({ error: "Setup already completed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { serverId, name } = await req.json();

  if (!serverId || !name) {
    return new Response(
      JSON.stringify({ error: "serverId and name are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    return new Response(JSON.stringify({ error: "Server not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ollamaRes = await fetch(`${server.url}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, stream: true }),
  });

  if (!ollamaRes.ok || !ollamaRes.body) {
    return new Response(
      JSON.stringify({ error: `Pull failed: ${ollamaRes.statusText}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(ollamaRes.body, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
