"use client";

import { useEffect, useState, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { codeToHtml } from "shiki";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      themes: { light: "github-light", dark: "vitesse-dark" },
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
          className="overflow-x-auto bg-[hsl(210,20%,90%)] p-3 text-sm dark:bg-[hsl(220,20%,12%)] [&_pre]:!bg-transparent [&_pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto bg-[hsl(210,20%,90%)] p-3 text-sm text-[hsl(222,47%,11%)] dark:bg-[hsl(220,20%,12%)] dark:text-[hsl(142,76%,56%)]">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function MarkdownText({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ children, className }) {
          const match = /language-(\w+)/.exec(className || "");
          if (match) {
            return (
              <CodeBlock
                code={String(children).replace(/\n$/, "")}
                language={match[1]}
              />
            );
          }
          return (
            <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>;
        },
        li({ children }) {
          return <li>{children}</li>;
        },
        h1({ children }) {
          return <h1 className="mb-2 text-lg font-bold">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="mb-2 text-base font-bold">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="mb-1 text-sm font-bold">{children}</h3>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="mb-2 border-l-2 border-[hsl(var(--border))] pl-3 italic text-[hsl(var(--muted-foreground))]">
              {children}
            </blockquote>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--primary))] underline underline-offset-2"
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="mb-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-1 text-left font-semibold">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-[hsl(var(--border))] px-2 py-1">{children}</td>
          );
        },
        hr() {
          return <hr className="my-3 border-[hsl(var(--border))]" />;
        },
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function MessageContent({ content }: MessageContentProps) {
  const parts = useMemo(() => parseContent(content), [content]);

  return (
    <div className="text-sm leading-relaxed">
      {parts.map((part, i) =>
        part.type === "code" ? (
          <CodeBlock
            key={i}
            code={part.content}
            language={part.language || "text"}
          />
        ) : (
          <MarkdownText key={i} content={part.content} />
        )
      )}
    </div>
  );
}
