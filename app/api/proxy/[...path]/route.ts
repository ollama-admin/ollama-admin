import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/with-rate-limit";

async function proxyToOllama(req: NextRequest) {
  const path = req.nextUrl.pathname.replace("/api/proxy", "");
  const serverId = req.nextUrl.searchParams.get("serverId");

  if (!serverId) {
    return new Response(JSON.stringify({ error: "serverId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    return new Response(JSON.stringify({ error: "Server not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  let body: string | null = null;
  let model = "unknown";
  let endpoint = path;

  if (req.method === "POST" || req.method === "PUT") {
    body = await req.text();
    try {
      const parsed = JSON.parse(body);
      if (parsed.model) model = parsed.model;
    } catch {
      // not JSON
    }
  }

  try {
    const ollamaUrl = `${server.url}${path}`;
    const ollamaRes = await fetch(ollamaUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body } : {}),
    });

    const latencyMs = Date.now() - startTime;
    const statusCode = ollamaRes.status;

    await prisma.log.create({
      data: {
        serverId: server.id,
        model,
        endpoint,
        latencyMs,
        statusCode,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      },
    });

    const responseBody = ollamaRes.body;
    return new Response(responseBody, {
      status: statusCode,
      headers: {
        "Content-Type": ollamaRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : "Proxy error";

    await prisma.log.create({
      data: {
        serverId: server.id,
        model,
        endpoint,
        latencyMs,
        statusCode: 502,
      },
    });

    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const GET = withRateLimit(proxyToOllama);
export const POST = withRateLimit(proxyToOllama);
export const PUT = withRateLimit(proxyToOllama);
export const DELETE = withRateLimit(proxyToOllama);
