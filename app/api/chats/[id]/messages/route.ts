import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit";
import { getRateLimitKey } from "@/lib/with-rate-limit";

function buildOllamaRequest(
  chat: {
    model: string;
    parameters: string | null;
    server: { url: string };
  },
  ollamaMessages: Array<{ role: string; content: string; images?: string[] }>
) {
  const chatParams = chat.parameters ? JSON.parse(chat.parameters) : {};

  const messages = chatParams.systemPrompt
    ? [{ role: "system", content: chatParams.systemPrompt }, ...ollamaMessages]
    : ollamaMessages;

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

  return {
    url: `${chat.server.url}/api/chat`,
    body: {
      model: chat.model,
      messages,
      stream: true,
      ...(Object.keys(options).length > 0 ? { options } : {}),
      ...(chatParams.keepAlive ? { keep_alive: chatParams.keepAlive } : {}),
    },
  };
}

function createSSEStream(
  ollamaRes: Response,
  chat: { id: string; title: string; server: { id: string }; model: string },
  startTime: number,
  content: string
) {
  const reader = ollamaRes.body!.getReader();
  const decoder = new TextDecoder();

  let fullContent = "";
  let promptTokens = 0;
  let completionTokens = 0;

  return new ReadableStream({
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

      if (chat.title === "New Conversation" && content) {
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
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { content, images, regenerate, editMessageId } = await req.json();

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

  let finalMessages = chat.messages;
  let userContent = content;

  if (regenerate) {
    const lastAssistant = [...chat.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistant) {
      await prisma.message.delete({ where: { id: lastAssistant.id } });
      finalMessages = chat.messages.filter((m) => m.id !== lastAssistant.id);
    }
    const lastUser = [...finalMessages].reverse().find((m) => m.role === "user");
    userContent = lastUser?.content || "";
  } else if (editMessageId) {
    const editIndex = chat.messages.findIndex((m) => m.id === editMessageId);
    if (editIndex >= 0) {
      const idsToDelete = chat.messages.slice(editIndex).map((m) => m.id);
      await prisma.message.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      finalMessages = chat.messages.slice(0, editIndex);
    }

    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "user",
        content,
        images: images ? JSON.stringify(images) : null,
      },
    });
  } else {
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "user",
        content,
        images: images ? JSON.stringify(images) : null,
      },
    });
  }

  const ollamaMessages = [
    ...finalMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      ...(m.images ? { images: JSON.parse(m.images) } : {}),
    })),
    ...(regenerate
      ? []
      : [
          {
            role: "user" as const,
            content: userContent,
            ...(images ? { images } : {}),
          },
        ]),
  ];

  const startTime = Date.now();
  const { url, body } = buildOllamaRequest(chat, ollamaMessages);

  const ollamaRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!ollamaRes.ok || !ollamaRes.body) {
    return new Response(
      JSON.stringify({ error: `Ollama error: ${ollamaRes.statusText}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = createSSEStream(ollamaRes, chat, startTime, userContent);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
