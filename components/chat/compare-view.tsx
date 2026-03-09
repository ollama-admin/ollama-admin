"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { MessageContent } from "@/components/chat/message-content";
import { TypingIndicator } from "@/components/ui/typing-indicator";

export interface CompareResult {
  content: string;
  streaming: boolean;
  error?: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  done: boolean;
}

interface CompareViewProps {
  results: CompareResult[];
  prompt?: string;
}

export function CompareView({ results, prompt }: CompareViewProps) {
  const t = useTranslations("chat");
  const scrollRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    results.forEach((r, i) => {
      if (r.streaming && scrollRefs.current[i]) {
        scrollRefs.current[i]?.scrollTo(0, scrollRefs.current[i]!.scrollHeight);
      }
    });
  }, [results]);

  const cols = results.length === 1 ? "grid-cols-1" : results.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {prompt && (
        <div className="border-b px-4 py-2.5">
          <div className="ml-auto max-w-[70%] rounded-2xl bg-[hsl(var(--primary))] px-4 py-2.5 text-[hsl(var(--primary-foreground))]">
            <div className="whitespace-pre-wrap text-sm">{prompt}</div>
          </div>
        </div>
      )}
      <div className={`grid ${cols} flex-1 min-h-0`}>
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`flex flex-col min-h-0 ${idx < results.length - 1 ? "border-r" : ""}`}
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="truncate text-sm font-medium">{result.model}</span>
              {result.done && result.latencyMs && (
                <span className="ml-2 shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                  {(result.promptTokens || 0) + (result.completionTokens || 0)}{" "}
                  {t("tokens")} · {result.latencyMs}ms
                </span>
              )}
            </div>
            <div
              ref={(el) => { scrollRefs.current[idx] = el; }}
              className="flex-1 overflow-auto p-4"
            >
              {result.error ? (
                <div className="text-sm text-[hsl(var(--destructive))]">
                  {result.error}
                </div>
              ) : result.content ? (
                <MessageContent content={result.content} />
              ) : result.streaming ? (
                <TypingIndicator />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
