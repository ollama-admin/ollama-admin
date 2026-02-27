"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface ChatSummary {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  messages: { content: string }[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
}

interface Server {
  id: string;
  name: string;
}

interface OllamaModel {
  name: string;
}

export default function ChatPage() {
  const t = useTranslations("chat");
  const router = useRouter();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchChats = useCallback(async () => {
    const params = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : "";
    const res = await fetch(`/api/chats${params}`);
    setChats(await res.json());
  }, [searchQuery]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data);
        if (data.length > 0) setSelectedServer(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedServer) return;
    fetch(`/api/admin/models?serverId=${selectedServer}`)
      .then((r) => r.json())
      .then((data) => {
        const m = data.models || [];
        setModels(m);
        if (m.length > 0 && !selectedModel) setSelectedModel(m[0].name);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const loadChat = async (id: string) => {
    const res = await fetch(`/api/chats/${id}`);
    const data = await res.json();
    setCurrentChatId(id);
    setMessages(data.messages || []);
    setSelectedModel(data.model);
    setSelectedServer(data.serverId);
  };

  const createNewChat = async () => {
    if (!selectedServer || !selectedModel) return;

    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          serverId: selectedServer,
        }),
      });
      const chat = await res.json();
      setCurrentChatId(chat.id);
      setMessages([]);
      fetchChats();
    } catch {
      toast("Error creating conversation", "error");
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChatId || streaming) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content }),
        signal: abortRef.current.signal,
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let meta = { promptTokens: 0, completionTokens: 0, latencyMs: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const json = JSON.parse(jsonStr);
            if (json.message?.content) {
              fullContent += json.message.content;
              setStreamingContent(fullContent);
            }
            if (json.done && json.promptTokens !== undefined) {
              meta = {
                promptTokens: json.promptTokens,
                completionTokens: json.completionTokens,
                latencyMs: json.latencyMs,
              };
            }
          } catch {
            // skip
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: fullContent,
          ...meta,
        },
      ]);
      setStreamingContent("");
      fetchChats();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStreamingContent("");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const deleteChat = async (id: string) => {
    try {
      await fetch(`/api/chats/${id}`, { method: "DELETE" });
      if (currentChatId === id) {
        setCurrentChatId(null);
        setMessages([]);
      }
      fetchChats();
      toast("Conversation deleted", "success");
    } catch {
      toast("Error deleting conversation", "error");
    }
  };

  return (
    <div className="flex h-full">
      {/* Chat sidebar */}
      <div className="flex w-64 flex-col border-r">
        <div className="border-b p-3">
          <Button
            onClick={createNewChat}
            disabled={!selectedServer || !selectedModel}
            className="w-full"
          >
            {t("newConversation")}
          </Button>
        </div>
        <div className="border-b p-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchConversations")}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1 overflow-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChat(chat.id)}
              className={`group flex cursor-pointer items-center justify-between border-b px-3 py-2.5 text-sm transition-colors hover:bg-[hsl(var(--accent))] ${
                currentChatId === chat.id ? "bg-[hsl(var(--accent))]" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{chat.title}</div>
                <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {chat.model}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                className="ml-2 hidden rounded p-0.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))] group-hover:block"
                aria-label="Delete conversation"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {chats.length === 0 && (
            <div className="p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
              {t("emptyTitle")}
            </div>
          )}
        </div>
      </div>

      {/* Chat main area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="w-auto"
            aria-label={t("selectServer")}
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-auto"
            aria-label={t("selectModel")}
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </Select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4">
          {!currentChatId ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "bg-[hsl(var(--muted))]"
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    {msg.role === "assistant" && msg.latencyMs && (
                      <div className="mt-1 text-xs opacity-60">
                        {(msg.promptTokens || 0) + (msg.completionTokens || 0)} {t("tokens")} · {msg.latencyMs}ms
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-[hsl(var(--muted))] px-4 py-2.5">
                    <div className="whitespace-pre-wrap text-sm">{streamingContent}</div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {currentChatId && (
          <div className="border-t p-4">
            <div className="mx-auto flex max-w-3xl gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t("typeMessage")}
                rows={1}
                className="flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              />
              {streaming ? (
                <Button variant="destructive" onClick={stopGeneration}>
                  {t("stopGeneration")}
                </Button>
              ) : (
                <Button onClick={sendMessage} disabled={!input.trim()}>
                  {t("sendMessage")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
