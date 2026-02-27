import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitKey } from "@/lib/with-rate-limit";

export async function POST(req: NextRequest) {
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

  const { prompt, serverIdA, modelA, serverIdB, modelB, parameters } =
    await req.json();

  if (!prompt?.trim() || !serverIdA || !modelA || !serverIdB || !modelB) {
    return new Response(
      JSON.stringify({ error: "prompt, servers, and models are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const [serverA, serverB] = await Promise.all([
    prisma.server.findUnique({ where: { id: serverIdA } }),
    prisma.server.findUnique({ where: { id: serverIdB } }),
  ]);

  if (!serverA || !serverB) {
    return new Response(
      JSON.stringify({ error: "Server not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const chatParams = parameters || {};
  const options: Record<string, unknown> = {};
  if (chatParams.temperature !== undefined)
    options.temperature = chatParams.temperature;
  if (chatParams.topK !== undefined) options.top_k = chatParams.topK;
  if (chatParams.topP !== undefined) options.top_p = chatParams.topP;
  if (chatParams.numCtx !== undefined) options.num_ctx = chatParams.numCtx;
  if (chatParams.numPredict !== undefined)
    options.num_predict = chatParams.numPredict;

  const messages = chatParams.systemPrompt
    ? [
        { role: "system", content: chatParams.systemPrompt },
        { role: "user", content: prompt },
      ]
    : [{ role: "user", content: prompt }];

  const bodyBase = {
    messages,
    stream: true,
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };

  const startTime = Date.now();

  const [resA, resB] = await Promise.all([
    fetch(`${serverA.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...bodyBase, model: modelA }),
    }),
    fetch(`${serverB.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...bodyBase, model: modelB }),
    }),
  ]);

  const readerA = resA.ok && resA.body ? resA.body.getReader() : null;
  const readerB = resB.ok && resB.body ? resB.body.getReader() : null;

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const state = {
        a: { done: false, content: "", buffer: "", promptTokens: 0, completionTokens: 0 },
        b: { done: false, content: "", buffer: "", promptTokens: 0, completionTokens: 0 },
      };

      if (!readerA) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ side: "a", error: `Model A error: ${resA.statusText}` })}\n\n`)
        );
        state.a.done = true;
      }
      if (!readerB) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ side: "b", error: `Model B error: ${resB.statusText}` })}\n\n`)
        );
        state.b.done = true;
      }

      const processChunks = async (
        reader: ReadableStreamDefaultReader<Uint8Array>,
        side: "a" | "b"
      ) => {
        const s = state[side];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          s.buffer += decoder.decode(value, { stream: true });
          const lines = s.buffer.split("\n");
          s.buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                s.content += json.message.content;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ side, token: json.message.content })}\n\n`
                  )
                );
              }
              if (json.done) {
                s.promptTokens = json.prompt_eval_count || 0;
                s.completionTokens = json.eval_count || 0;
              }
            } catch {
              // skip
            }
          }
        }
        s.done = true;
        const latencyMs = Date.now() - startTime;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              side,
              done: true,
              promptTokens: s.promptTokens,
              completionTokens: s.completionTokens,
              latencyMs,
            })}\n\n`
          )
        );
      };

      const promises: Promise<void>[] = [];
      if (readerA) promises.push(processChunks(readerA, "a"));
      if (readerB) promises.push(processChunks(readerB, "b"));

      await Promise.all(promises);

      const logData = [
        { serverId: serverA.id, model: modelA, tokens: state.a },
        { serverId: serverB.id, model: modelB, tokens: state.b },
      ];
      for (const l of logData) {
        await prisma.log.create({
          data: {
            serverId: l.serverId,
            model: l.model,
            endpoint: "/api/compare",
            promptTokens: l.tokens.promptTokens,
            completionTokens: l.tokens.completionTokens,
            latencyMs: Date.now() - startTime,
            statusCode: 200,
          },
        });
      }

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
