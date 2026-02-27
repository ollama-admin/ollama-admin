"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  X,
  Pencil,
  RefreshCw,
  Download,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { useToast } from "@/components/ui/toast";
import {
  ChatParametersPanel,
  type ChatParameters,
} from "@/components/chat/chat-parameters";

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
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const loadChat = async (id: string) => {
    const res = await fetch(`/api/chats/${id}`);
    const data = await res.json();
    setCurrentChatId(id);
    setMessages(data.messages || []);
    setSelectedModel(data.model);
    setSelectedServer(data.serverId);
    setChatParameters(data.parameters ? JSON.parse(data.parameters) : {});
    setEditingMessageId(null);
    setAttachedImages([]);
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
      setAttachedImages([]);
      fetchChats();
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
    if (!input.trim() || !currentChatId || streaming) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    const msgContent = input;
    const imgs = attachedImages.length > 0 ? [...attachedImages] : undefined;
    setInput("");
    setAttachedImages([]);

    await handleStream(currentChatId, {
      content: msgContent,
      ...(imgs ? { images: imgs } : {}),
    });
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachedImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
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
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-auto"
            aria-label={t("selectModel")}
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
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

        {currentChatId && (
          <ChatParametersPanel
            parameters={chatParameters}
            onChange={updateParameters}
          />
        )}

        {/* Messages */}
        <div
          className="flex-1 overflow-auto p-4"
          aria-live="polite"
          aria-relevant="additions"
        >
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
                  className={`group flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "bg-[hsl(var(--muted))]"
                    }`}
                  >
                    {msg.images && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {JSON.parse(msg.images).map(
                          (img: string, i: number) => (
                            <img
                              key={i}
                              src={`data:image/jpeg;base64,${img}`}
                              alt={`Attachment ${i + 1}`}
                              className="h-16 w-16 rounded object-cover"
                            />
                          )
                        )}
                      </div>
                    )}

                    {editingMessageId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded border bg-[hsl(var(--background))] p-2 text-sm text-[hsl(var(--foreground))]"
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

                    {msg.role === "assistant" && msg.latencyMs && (
                      <div className="mt-1 text-xs opacity-60">
                        {(msg.promptTokens || 0) + (msg.completionTokens || 0)}{" "}
                        {t("tokens")} · {msg.latencyMs}ms
                      </div>
                    )}
                  </div>

                  {!streaming && editingMessageId !== msg.id && (
                    <div className="ml-1 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {msg.role === "user" && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditContent(msg.content);
                          }}
                          className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                          aria-label={t("editMessage")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {msg.role === "assistant" && (
                        <button
                          onClick={regenerateResponse}
                          className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                          aria-label={t("regenerate")}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {streaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-[hsl(var(--muted))] px-4 py-3">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-[hsl(var(--muted))] px-4 py-2.5">
                    <div className="whitespace-pre-wrap text-sm">
                      {streamingContent}
                    </div>
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
            {attachedImages.length > 0 && (
              <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img
                      src={`data:image/jpeg;base64,${img}`}
                      alt={`Attachment ${i + 1}`}
                      className="h-12 w-12 rounded object-cover"
                    />
                    <button
                      onClick={() =>
                        setAttachedImages((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className="absolute -right-1 -top-1 rounded-full bg-[hsl(var(--destructive))] p-0.5 text-white"
                      aria-label={`Remove image ${i + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mx-auto flex max-w-3xl gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                title={t("attachImage")}
                disabled={streaming}
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
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
            <p className="mt-1 text-center text-xs text-[hsl(var(--muted-foreground))]">
              Press{" "}
              <kbd className="rounded border px-1 py-0.5 text-[10px]">
                Ctrl
              </kbd>
              +
              <kbd className="rounded border px-1 py-0.5 text-[10px]">
                Enter
              </kbd>{" "}
              to send
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
