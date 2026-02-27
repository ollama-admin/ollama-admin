"use client";

import { useEffect, useState, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { codeToHtml } from "shiki";

interface MessageContentProps {
  content: string;
}

interface ContentPart {
  type: "text" | "code";
  content: string;
  language?: string;
}

function parseContent(raw: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: raw.slice(lastIndex, match.index) });
    }
    parts.push({
      type: "code",
      language: match[1] || "text",
      content: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push({ type: "text", content: raw.slice(lastIndex) });
  }

  return parts;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: language,
      themes: { light: "github-light", dark: "github-dark" },
    })
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative my-2 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between bg-[hsl(var(--muted))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">
        <span>{language}</span>
        <button
          onClick={copyCode}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-[hsl(var(--accent))]"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      {html ? (
        <div
          className="overflow-x-auto p-3 text-sm [&_pre]:!bg-transparent [&_pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 text-sm">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export function MessageContent({ content }: MessageContentProps) {
  const parts = useMemo(() => parseContent(content), [content]);

  return (
    <div className="text-sm">
      {parts.map((part, i) =>
        part.type === "code" ? (
          <CodeBlock
            key={i}
            code={part.content}
            language={part.language || "text"}
          />
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            {part.content}
          </span>
        )
      )}
    </div>
  );
}
