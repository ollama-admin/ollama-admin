"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  X,
  Pencil,
  RefreshCw,
  Download,
  Plus,
  Send,
  Square,
  Search,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { useToast } from "@/components/ui/toast";
import {
  ChatParametersModal,
  type ChatParameters,
} from "@/components/chat/chat-parameters";
import { MessageContent } from "@/components/chat/message-content";
import { cn } from "@/lib/cn";

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
  images?: string;
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
  const [chatParameters, setChatParameters] = useState<ChatParameters>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [paramsOpen, setParamsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (input.trim() || streaming) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [input, streaming]);

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleServerChange = async (serverId: string) => {
    setSelectedServer(serverId);
    if (currentChatId) {
      await fetch(`/api/chats/${currentChatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
    }
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    if (currentChatId) {
      await fetch(`/api/chats/${currentChatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
    }
  };

  const loadChat = async (id: string) => {
    const res = await fetch(`/api/chats/${id}`);
    const data = await res.json();
    setCurrentChatId(id);
    setMessages(data.messages || []);
    setSelectedModel(data.model);
    setSelectedServer(data.serverId);
    setChatParameters(data.parameters ? JSON.parse(data.parameters) : {});
    setEditingMessageId(null);
  };

  const createNewChat = async () => {
    if (!selectedServer || !selectedModel) return;
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, serverId: selectedServer }),
      });
      const chat = await res.json();
      setCurrentChatId(chat.id);
      setMessages([]);
      setChatParameters({});
      fetchChats();
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch {
      toast("Error creating conversation", "error");
    }
  };

  const updateParameters = async (params: ChatParameters) => {
    setChatParameters(params);
    if (currentChatId) {
      await fetch(`/api/chats/${currentChatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: params }),
      });
    }
  };

  const handleStream = async (
    chatId: string,
    body: Record<string, unknown>
  ) => {
    setStreaming(true);
    setStreamingContent("");
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          try {
            const json = JSON.parse(line.slice(6));
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

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    if (!currentChatId) {
      if (!selectedServer || !selectedModel) return;
      try {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            serverId: selectedServer,
            parameters: Object.keys(chatParameters).length > 0 ? chatParameters : undefined,
          }),
        });
        const chat = await res.json();
        setCurrentChatId(chat.id);
        fetchChats();

        if (Object.keys(chatParameters).length > 0) {
          await fetch(`/api/chats/${chat.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parameters: chatParameters }),
          });
        }

        const userMessage: Message = {
          id: `temp-${Date.now()}`,
          role: "user",
          content: input,
        };
        setMessages([userMessage]);
        const msgContent = input;
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        await handleStream(chat.id, { content: msgContent });
        return;
      } catch {
        toast("Error creating conversation", "error");
        return;
      }
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    const msgContent = input;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    await handleStream(currentChatId, { content: msgContent });
  };

  const regenerateResponse = async () => {
    if (!currentChatId || streaming) return;

    const lastAssistantIdx = [...messages]
      .reverse()
      .findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx < 0) return;

    const idx = messages.length - 1 - lastAssistantIdx;
    setMessages((prev) => prev.filter((_, i) => i !== idx));

    await handleStream(currentChatId, { regenerate: true });
  };

  const editMessage = async (messageId: string) => {
    if (!currentChatId || streaming || !editContent.trim()) return;

    const editIdx = messages.findIndex((m) => m.id === messageId);
    if (editIdx < 0) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: editContent,
    };
    setMessages(messages.slice(0, editIdx).concat(userMessage));
    setEditingMessageId(null);
    const content = editContent;
    setEditContent("");

    await handleStream(currentChatId, { content, editMessageId: messageId });
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const deleteChat = async (id: string) => {
    if (!window.confirm(t("confirmDelete"))) return;
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

  const exportChat = (format: "json" | "markdown") => {
    if (!currentChatId) return;
    window.open(`/api/chats/${currentChatId}/export?format=${format}`, "_blank");
  };

  const canSend = input.trim().length > 0 && !streaming && (!!currentChatId || (!!selectedServer && !!selectedModel));

  return (
    <div className="flex h-full">
      {/* Chat sidebar */}
      <div className="flex w-64 flex-col border-r bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
        <div className="p-3">
          <button
            onClick={createNewChat}
            disabled={!selectedServer || !selectedModel}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t("newConversation")}
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchConversations")}
              className="h-8 w-full rounded-md border bg-transparent pl-8 pr-3 text-xs transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChat(chat.id)}
              className={cn(
                "group flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-[hsl(var(--accent))]",
                currentChatId === chat.id && "bg-[hsl(var(--accent))]"
              )}
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
                className="ml-2 hidden rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] group-hover:block"
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
          <div className="relative">
            <select
              value={selectedServer}
              onChange={(e) => handleServerChange(e.target.value)}
              aria-label={t("selectServer")}
              className="h-8 appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id} className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          </div>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              aria-label={t("selectModel")}
              className="h-8 appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name} className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          </div>
          {currentChatId && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportChat("markdown")}
                title={t("exportMarkdown")}
              >
                <Download className="h-4 w-4" />
                <span className="ml-1 text-xs">MD</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportChat("json")}
                title={t("exportJson")}
              >
                <Download className="h-4 w-4" />
                <span className="ml-1 text-xs">JSON</span>
              </Button>
            </div>
          )}
        </div>

        <ChatParametersModal
          open={paramsOpen}
          onClose={() => setParamsOpen(false)}
          parameters={chatParameters}
          onChange={currentChatId ? updateParameters : setChatParameters}
        />

        {/* Messages */}
        <div
          className="flex-1 overflow-auto p-4"
          aria-live="polite"
          aria-relevant="additions"
        >
          {!currentChatId && messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <EmptyState
                icon={MessageSquare}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="group">
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="flex items-start gap-1">
                        {!streaming && editingMessageId !== msg.id && (
                          <button
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditContent(msg.content);
                            }}
                            className="mt-2 rounded p-1 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity hover:bg-[hsl(var(--accent))] group-hover:opacity-100"
                            aria-label={t("editMessage")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <div className="max-w-[80%] rounded-2xl bg-[hsl(var(--primary))] px-4 py-2.5 text-[hsl(var(--primary-foreground))]">
                          {editingMessageId === msg.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full rounded-lg border-none bg-[hsl(var(--background))] p-2 text-sm text-[hsl(var(--foreground))] focus:outline-none"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => editMessage(msg.id)}
                                >
                                  {t("editSend")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingMessageId(null)}
                                  className="text-[hsl(var(--primary-foreground))] hover:text-[hsl(var(--primary-foreground))]"
                                >
                                  {t("editCancel")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-sm">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="flex items-start gap-1">
                        <div className="max-w-[80%] rounded-2xl bg-[hsl(var(--muted))] px-4 py-2.5">
                          <MessageContent content={msg.content} />
                          {msg.latencyMs && (
                            <div className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                              {(msg.promptTokens || 0) + (msg.completionTokens || 0)}{" "}
                              {t("tokens")} · {msg.latencyMs}ms
                            </div>
                          )}
                        </div>
                        {!streaming && (
                          <button
                            onClick={regenerateResponse}
                            className="mt-2 rounded p-1 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity hover:bg-[hsl(var(--accent))] group-hover:opacity-100"
                            aria-label={t("regenerate")}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {streaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-[hsl(var(--muted))] px-4 py-3">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl bg-[hsl(var(--muted))] px-4 py-2.5">
                    <MessageContent content={streamingContent} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area — always visible at bottom */}
        <div className="bg-[hsl(var(--background))] px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => setParamsOpen(true)}
                className="absolute left-0 top-0 ml-[7px] mt-[7px] rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                aria-label={t("parametersButton")}
                title={t("parametersButton")}
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResizeTextarea();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t("typeMessage")}
                rows={1}
                disabled={streaming}
                className="w-full resize-none overflow-hidden rounded-xl border bg-[hsl(var(--card))] py-3 pl-12 pr-12 text-sm shadow-sm transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
              />
              {streaming ? (
                <button
                  onClick={stopGeneration}
                  className="absolute right-0 top-0 mr-[7px] mt-[7px] rounded-lg bg-[hsl(var(--destructive))] p-1.5 text-[hsl(var(--destructive-foreground))] transition-colors hover:opacity-90"
                  aria-label={t("stopGeneration")}
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!canSend}
                  className="absolute right-0 top-0 mr-[7px] mt-[7px] rounded-lg bg-[hsl(var(--primary))] p-1.5 text-[hsl(var(--primary-foreground))] transition-colors hover:opacity-90 disabled:opacity-30"
                  aria-label={t("sendMessage")}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
