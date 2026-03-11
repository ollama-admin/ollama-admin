import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitKey } from "@/lib/with-rate-limit";
import { logger } from "@/lib/logger";
import { logAsync } from "@/lib/log-async";

interface ModelTarget {
  serverId: string;
  model: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rlKey = getRateLimitKey(req);
  const rl = checkRateLimit(rlKey);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
        },
      }
    );
  }

  const { content, targets } = (await req.json()) as {
    content: string;
    targets: ModelTarget[];
  };

  if (!content?.trim() || !targets?.length || targets.length > 3) {
    return new Response(
      JSON.stringify({ error: "content and 1-3 targets required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const chat = await prisma.chat.findUnique({
    where: { id: id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!chat) {
    return new Response(JSON.stringify({ error: "Chat not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const serverIds = Array.from(new Set(targets.map((t) => t.serverId)));
  const servers = await prisma.server.findMany({
    where: { id: { in: serverIds } },
  });
  const serverMap = new Map(servers.map((s) => [s.id, s]));

  for (const t of targets) {
    if (!serverMap.has(t.serverId)) {
      return new Response(
        JSON.stringify({ error: `Server ${t.serverId} not found` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Save user message
  const compareGroup = `cmp-${Date.now()}`;
  await prisma.message.create({
    data: {
      chatId: chat.id,
      role: "user",
      content,
      compareGroup,
    },
  });

  // Build chat history
  const chatParams = chat.parameters ? JSON.parse(chat.parameters) : {};
  const options: Record<string, unknown> = {};
  if (chatParams.temperature !== undefined)
    options.temperature = chatParams.temperature;
  if (chatParams.topK !== undefined) options.top_k = chatParams.topK;
  if (chatParams.topP !== undefined) options.top_p = chatParams.topP;
  if (chatParams.repeatPenalty !== undefined)
    options.repeat_penalty = chatParams.repeatPenalty;
  if (chatParams.seed !== undefined) options.seed = chatParams.seed;
  if (chatParams.numCtx !== undefined) options.num_ctx = chatParams.numCtx;
  if (chatParams.numPredict !== undefined)
    options.num_predict = chatParams.numPredict;
  if (chatParams.stop)
    options.stop = chatParams.stop.split(",").map((s: string) => s.trim());

  const previousMessages = chat.messages
    .filter((m) => m.role === "user" || (m.role === "assistant" && !m.compareGroup))
    .map((m) => ({ role: m.role, content: m.content }));

  const allMessages = [
    ...(chatParams.systemPrompt
      ? [{ role: "system", content: chatParams.systemPrompt }]
      : []),
    ...previousMessages,
    { role: "user", content },
  ];

  const bodyBase = {
    messages: allMessages,
    stream: true,
    ...(Object.keys(options).length > 0 ? { options } : {}),
    ...(chatParams.keepAlive ? { keep_alive: chatParams.keepAlive } : {}),
  };

  const startTime = Date.now();

  // Launch parallel requests
  const responses = await Promise.all(
    targets.map(async (t) => {
      const server = serverMap.get(t.serverId)!;
      try {
        const res = await fetch(`${server.url}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...bodyBase, model: t.model }),
        });
        return { target: t, server, res, ok: res.ok && !!res.body };
      } catch {
        return { target: t, server, res: null, ok: false };
      }
    })
  );

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const processTarget = async (
        idx: number,
        target: ModelTarget,
        server: { id: string; name: string },
        res: Response | null,
        ok: boolean
      ) => {
        const side = String(idx);

        if (!ok || !res?.body) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                side,
                error: `Error: ${res?.statusText || "Connection failed"}`,
              })}\n\n`
            )
          );
          return;
        }

        const reader = res.body.getReader();
        let buffer = "";
        let fullContent = "";
        let promptTokens = 0;
        let completionTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                fullContent += json.message.content;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ side, token: json.message.content })}\n\n`
                  )
                );
              }
              if (json.done) {
                promptTokens = json.prompt_eval_count || 0;
                completionTokens = json.eval_count || 0;
              }
            } catch {
              // skip
            }
          }
        }

        const latencyMs = Date.now() - startTime;

        // Save assistant message with model info
        await prisma.message.create({
          data: {
            chatId: chat.id,
            role: "assistant",
            content: fullContent,
            model: target.model,
            serverId: target.serverId,
            compareGroup,
            promptTokens,
            completionTokens,
            latencyMs,
          },
        });

        logAsync({
          serverId: server.id,
          model: target.model,
          endpoint: "/api/chat/compare",
          promptTokens,
          completionTokens,
          latencyMs,
          statusCode: 200,
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              side,
              done: true,
              model: target.model,
              promptTokens,
              completionTokens,
              latencyMs,
            })}\n\n`
          )
        );
      };

      await Promise.all(
        responses.map((r, idx) =>
          processTarget(idx, r.target, r.server, r.res, r.ok)
        )
      );

      // Update chat title if needed
      if (chat.title === "New Conversation" && content) {
        await prisma.chat.update({
          where: { id: chat.id },
          data: { title: content.slice(0, 50) },
        });
      }

      logger.info("Compare completed", {
        chatId: chat.id,
        models: targets.map((t) => t.model),
      });

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ allDone: true })}\n\n`)
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
