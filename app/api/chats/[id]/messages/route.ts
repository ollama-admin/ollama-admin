import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { content, images } = await req.json();

  const chat = await prisma.chat.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      server: true,
    },
  });

  if (!chat) {
    return new Response(JSON.stringify({ error: "Chat not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  await prisma.message.create({
    data: {
      chatId: chat.id,
      role: "user",
      content,
      images: images ? JSON.stringify(images) : null,
    },
  });

  const chatParams = chat.parameters ? JSON.parse(chat.parameters) : {};

  const ollamaMessages = [
    ...(chatParams.systemPrompt
      ? [{ role: "system" as const, content: chatParams.systemPrompt }]
      : []),
    ...chat.messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      ...(m.images ? { images: JSON.parse(m.images) } : {}),
    })),
    {
      role: "user" as const,
      content,
      ...(images ? { images } : {}),
    },
  ];

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

  const startTime = Date.now();

  const ollamaRes = await fetch(`${chat.server.url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: chat.model,
      messages: ollamaMessages,
      stream: true,
      ...(Object.keys(options).length > 0 ? { options } : {}),
      ...(chatParams.keepAlive ? { keep_alive: chatParams.keepAlive } : {}),
    }),
  });

  if (!ollamaRes.ok || !ollamaRes.body) {
    return new Response(
      JSON.stringify({ error: `Ollama error: ${ollamaRes.statusText}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const reader = ollamaRes.body.getReader();
  const decoder = new TextDecoder();

  let fullContent = "";
  let promptTokens = 0;
  let completionTokens = 0;

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";

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
            }
            if (json.done) {
              promptTokens = json.prompt_eval_count || 0;
              completionTokens = json.eval_count || 0;
            }

            controller.enqueue(
              new TextEncoder().encode(`data: ${line}\n\n`)
            );
          } catch {
            // skip
          }
        }
      }

      const latencyMs = Date.now() - startTime;

      await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "assistant",
          content: fullContent,
          promptTokens,
          completionTokens,
          latencyMs,
        },
      });

      await prisma.log.create({
        data: {
          serverId: chat.server.id,
          model: chat.model,
          endpoint: "/api/chat",
          promptTokens,
          completionTokens,
          latencyMs,
          statusCode: 200,
        },
      });

      const titleNeedsUpdate = chat.title === "New Conversation" && content;
      if (titleNeedsUpdate) {
        await prisma.chat.update({
          where: { id: chat.id },
          data: { title: content.slice(0, 50) },
        });
      }

      controller.enqueue(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ done: true, promptTokens, completionTokens, latencyMs })}\n\n`
        )
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
