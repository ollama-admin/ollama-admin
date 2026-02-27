"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useRef } from "react";
import { GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { MessageContent } from "@/components/chat/message-content";

interface Server {
  id: string;
  name: string;
}

interface OllamaModel {
  name: string;
}

interface SideResult {
  content: string;
  streaming: boolean;
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  done: boolean;
}

const emptySide = (): SideResult => ({
  content: "",
  streaming: false,
  done: false,
});

export default function ComparePage() {
  const t = useTranslations("compare");
  const [servers, setServers] = useState<Server[]>([]);
  const [serverA, setServerA] = useState("");
  const [serverB, setServerB] = useState("");
  const [modelsA, setModelsA] = useState<OllamaModel[]>([]);
  const [modelsB, setModelsB] = useState<OllamaModel[]>([]);
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sideA, setSideA] = useState<SideResult>(emptySide());
  const [sideB, setSideB] = useState<SideResult>(emptySide());
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data);
        if (data.length > 0) {
          setServerA(data[0].id);
          setServerB(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!serverA) return;
    fetch(`/api/admin/models?serverId=${serverA}`)
      .then((r) => r.json())
      .then((data) => {
        const m = data.models || [];
        setModelsA(m);
        if (m.length > 0 && !modelA) setModelA(m[0].name);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverA]);

  useEffect(() => {
    if (!serverB) return;
    fetch(`/api/admin/models?serverId=${serverB}`)
      .then((r) => r.json())
      .then((data) => {
        const m = data.models || [];
        setModelsB(m);
        if (m.length > 0 && !modelB) setModelB(m[0].name);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverB]);

  useEffect(() => {
    scrollRefA.current?.scrollTo(0, scrollRefA.current.scrollHeight);
  }, [sideA.content]);

  useEffect(() => {
    scrollRefB.current?.scrollTo(0, scrollRefB.current.scrollHeight);
  }, [sideB.content]);

  const runComparison = async () => {
    if (!prompt.trim() || !modelA || !modelB || running) return;

    setSideA({ ...emptySide(), streaming: true });
    setSideB({ ...emptySide(), streaming: true });
    setRunning(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          serverIdA: serverA,
          modelA,
          serverIdB: serverB,
          modelB,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));

            if (json.allDone) continue;

            const setter = json.side === "a" ? setSideA : setSideB;

            if (json.error) {
              setter((prev) => ({ ...prev, error: json.error, streaming: false, done: true }));
            } else if (json.token) {
              setter((prev) => ({ ...prev, content: prev.content + json.token }));
            } else if (json.done) {
              setter((prev) => ({
                ...prev,
                streaming: false,
                done: true,
                promptTokens: json.promptTokens,
                completionTokens: json.completionTokens,
                latencyMs: json.latencyMs,
              }));
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setSideA((prev) => ({ ...prev, streaming: false }));
        setSideB((prev) => ({ ...prev, streaming: false }));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stopComparison = () => {
    abortRef.current?.abort();
  };

  const hasResults = sideA.content || sideB.content || sideA.error || sideB.error;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: model selection */}
      <div className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {t("modelA")}
            </span>
            <Select
              value={serverA}
              onChange={(e) => setServerA(e.target.value)}
              className="w-auto"
              aria-label={t("selectServerA")}
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="w-auto"
              aria-label={t("selectModelA")}
            >
              {modelsA.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          <GitCompareArrows className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {t("modelB")}
            </span>
            <Select
              value={serverB}
              onChange={(e) => setServerB(e.target.value)}
              className="w-auto"
              aria-label={t("selectServerB")}
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="w-auto"
              aria-label={t("selectModelB")}
            >
              {modelsB.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Results area */}
      <div className="flex flex-1 overflow-hidden">
        {!hasResults ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={GitCompareArrows}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          </div>
        ) : (
          <div className="flex flex-1">
            {/* Side A */}
            <div className="flex flex-1 flex-col border-r">
              <div className="flex items-center justify-between border-b px-4 py-2">
                <span className="text-sm font-medium">{modelA}</span>
                {sideA.done && sideA.latencyMs && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {(sideA.promptTokens || 0) + (sideA.completionTokens || 0)}{" "}
                    {t("tokens")} · {sideA.latencyMs}ms
                  </span>
                )}
              </div>
              <div ref={scrollRefA} className="flex-1 overflow-auto p-4">
                {sideA.error ? (
                  <div className="text-sm text-[hsl(var(--destructive))]">
                    {sideA.error}
                  </div>
                ) : sideA.content ? (
                  <MessageContent content={sideA.content} />
                ) : sideA.streaming ? (
                  <TypingIndicator />
                ) : null}
              </div>
            </div>

            {/* Side B */}
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b px-4 py-2">
                <span className="text-sm font-medium">{modelB}</span>
                {sideB.done && sideB.latencyMs && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {(sideB.promptTokens || 0) + (sideB.completionTokens || 0)}{" "}
                    {t("tokens")} · {sideB.latencyMs}ms
                  </span>
                )}
              </div>
              <div ref={scrollRefB} className="flex-1 overflow-auto p-4">
                {sideB.error ? (
                  <div className="text-sm text-[hsl(var(--destructive))]">
                    {sideB.error}
                  </div>
                ) : sideB.content ? (
                  <MessageContent content={sideB.content} />
                ) : sideB.streaming ? (
                  <TypingIndicator />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prompt input */}
      <div className="border-t p-4">
        <div className="mx-auto flex max-w-4xl gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                runComparison();
              }
            }}
            placeholder={t("promptPlaceholder")}
            rows={2}
            className="flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          />
          {running ? (
            <Button variant="destructive" onClick={stopComparison}>
              {t("stop")}
            </Button>
          ) : (
            <Button
              onClick={runComparison}
              disabled={!prompt.trim() || !modelA || !modelB}
            >
              {t("compare")}
            </Button>
          )}
        </div>
        <p className="mt-1 text-center text-xs text-[hsl(var(--muted-foreground))]">
          Press{" "}
          <kbd className="rounded border px-1 py-0.5 text-[10px]">Ctrl</kbd>+
          <kbd className="rounded border px-1 py-0.5 text-[10px]">Enter</kbd>{" "}
          to compare
        </p>
      </div>
    </div>
  );
}
