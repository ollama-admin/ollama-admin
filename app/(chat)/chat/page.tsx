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
  GitCompareArrows,
  PlusCircle,
  MinusCircle,
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
import { type CompareResult } from "@/components/chat/compare-view";
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
  model?: string;
  serverId?: string;
  compareGroup?: string;
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

interface CompareTarget {
  serverId: string;
  model: string;
}

const emptyResult = (model: string): CompareResult => ({
  content: "",
  streaming: true,
  model,
  done: false,
});

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

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareTargets, setCompareTargets] = useState<CompareTarget[]>([]);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [compareStreaming, setCompareStreaming] = useState(false);

  // Models cache per server for compare selectors
  const [serverModelsCache, setServerModelsCache] = useState<Record<string, OllamaModel[]>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const comparePromptRef = useRef<string>("");

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
        setServerModelsCache((prev) => ({ ...prev, [selectedServer]: m }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServer]);

  // Fetch models for compare target servers
  const fetchModelsForServer = useCallback(async (serverId: string) => {
    if (serverModelsCache[serverId]) return;
    const res = await fetch(`/api/admin/models?serverId=${serverId}`);
    const data = await res.json();
    const m = data.models || [];
    setServerModelsCache((prev) => ({ ...prev, [serverId]: m }));
  }, [serverModelsCache]);

  const shouldAutoScroll = useRef(false);

  useEffect(() => {
    if (!shouldAutoScroll.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    shouldAutoScroll.current = false;
  }, [messages]);

  // Auto-scroll during compare streaming
  useEffect(() => {
    if (compareStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [compareResults, compareStreaming]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (input.trim() || streaming || compareStreaming) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [input, streaming, compareStreaming]);

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 120;
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = newHeight + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
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
    shouldAutoScroll.current = true;
    setMessages(data.messages || []);
    setSelectedModel(data.model);
    setSelectedServer(data.serverId);
    setChatParameters(data.parameters ? JSON.parse(data.parameters) : {});
    setEditingMessageId(null);
    setCompareResults([]);
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
      setCompareResults([]);
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

  // Toggle compare mode
  const toggleCompareMode = () => {
    if (!compareMode) {
      // Initialize with 2 targets using current server/model
      setCompareTargets([
        { serverId: selectedServer, model: selectedModel },
        { serverId: selectedServer, model: models.length > 1 ? models[1].name : models[0]?.name || "" },
      ]);
      setCompareMode(true);
    } else {
      setCompareMode(false);
      setCompareTargets([]);
      setCompareResults([]);
    }
  };

  const addCompareTarget = () => {
    if (compareTargets.length >= 3) return;
    setCompareTargets((prev) => [
      ...prev,
      { serverId: selectedServer, model: models[0]?.name || "" },
    ]);
  };

  const removeCompareTarget = (idx: number) => {
    if (compareTargets.length <= 2) return;
    setCompareTargets((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCompareTarget = (idx: number, field: "serverId" | "model", value: string) => {
    setCompareTargets((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    if (field === "serverId") {
      fetchModelsForServer(value);
    }
  };

  // Regular single-model streaming
  const handleStream = async (
    chatId: string,
    body: Record<string, unknown>
  ) => {
    setStreaming(true);
    setStreamingContent("");
    abortRef.current = new AbortController();
    let didInitialScroll = false;

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
              if (!didInitialScroll) {
                didInitialScroll = true;
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }
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

  // Compare mode streaming
  const handleCompareStream = async (chatId: string, content: string) => {
    setCompareStreaming(true);
    setCompareResults(compareTargets.map((t) => emptyResult(t.model)));
    comparePromptRef.current = content;
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/chats/${chatId}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targets: compareTargets }),
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

            const sideIdx = parseInt(json.side);

            if (json.error) {
              setCompareResults((prev) => {
                const updated = [...prev];
                updated[sideIdx] = { ...updated[sideIdx], error: json.error, streaming: false, done: true };
                return updated;
              });
            } else if (json.token) {
              setCompareResults((prev) => {
                const updated = [...prev];
                updated[sideIdx] = { ...updated[sideIdx], content: updated[sideIdx].content + json.token };
                return updated;
              });
            } else if (json.done) {
              setCompareResults((prev) => {
                const updated = [...prev];
                updated[sideIdx] = {
                  ...updated[sideIdx],
                  streaming: false,
                  done: true,
                  promptTokens: json.promptTokens,
                  completionTokens: json.completionTokens,
                  latencyMs: json.latencyMs,
                };
                return updated;
              });
            }
          } catch {
            // skip
          }
        }
      }

      // Reload messages from server (they were persisted by the API)
      const chatRes = await fetch(`/api/chats/${chatId}`);
      const chatData = await chatRes.json();
      setMessages(chatData.messages || []);
      setCompareResults([]);
      fetchChats();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setCompareResults((prev) => prev.map((r) => ({ ...r, streaming: false })));
      }
    } finally {
      setCompareStreaming(false);
      abortRef.current = null;
    }
  };

  const sendMessage = async () => {
    const isCompare = compareMode && compareTargets.length >= 2;
    if (!input.trim() || streaming || compareStreaming) return;

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

        const msgContent = input;
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        if (isCompare) {
          shouldAutoScroll.current = true;
          await handleCompareStream(chat.id, msgContent);
        } else {
          const userMessage: Message = {
            id: `temp-${Date.now()}`,
            role: "user",
            content: msgContent,
          };
          shouldAutoScroll.current = true;
          setMessages([userMessage]);
          await handleStream(chat.id, { content: msgContent });
        }
        return;
      } catch {
        toast("Error creating conversation", "error");
        return;
      }
    }

    const msgContent = input;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (isCompare) {
      shouldAutoScroll.current = true;
      await handleCompareStream(currentChatId, msgContent);
    } else {
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: msgContent,
      };
      shouldAutoScroll.current = true;
      setMessages((prev) => [...prev, userMessage]);
      await handleStream(currentChatId, { content: msgContent });
    }
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
        setCompareResults([]);
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

  const isStreaming = streaming || compareStreaming;
  const canSend = input.trim().length > 0 && !isStreaming && (!!currentChatId || (!!selectedServer && !!selectedModel));

  // Group messages by compareGroup for rendering
  const groupedMessages = (() => {
    const groups: Array<{ type: "single"; message: Message } | { type: "compare"; userMessage: Message; responses: Message[] }> = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (processedIds.has(msg.id)) continue;

      if (msg.compareGroup && msg.role === "user") {
        // Find ALL assistant messages with same compareGroup (may not be consecutive)
        const responses = messages.filter(
          (m) => m.compareGroup === msg.compareGroup && m.role === "assistant"
        );
        responses.forEach((r) => processedIds.add(r.id));
        processedIds.add(msg.id);
        groups.push({ type: "compare", userMessage: msg, responses });
      } else {
        processedIds.add(msg.id);
        groups.push({ type: "single", message: msg });
      }
    }
    return groups;
  })();

  // Render a single message group (user or assistant bubble)
  const renderMessageGroup = (
    group: (typeof groupedMessages)[number],
    groupIdx: number
  ) => {
    if (group.type === "compare") {
      const cols = group.responses.length === 1 ? "grid-cols-1" : group.responses.length === 2 ? "grid-cols-2" : "grid-cols-3";
      return (
        <div key={`cmp-${groupIdx}`} className="space-y-3">
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-[hsl(var(--primary))] px-5 py-3.5 text-[hsl(var(--primary-foreground))]">
              <div className="flex items-center gap-2 text-sm">
                <GitCompareArrows className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-wrap">{group.userMessage.content}</span>
              </div>
            </div>
          </div>
          {group.responses.length > 0 && (
            <div className={`grid ${cols} gap-3`}>
              {group.responses.map((r, rIdx) => (
                <div key={rIdx} className="rounded-2xl bg-[hsl(var(--muted))] px-4 py-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{r.model || "Unknown"}</span>
                    {r.latencyMs && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {(r.promptTokens || 0) + (r.completionTokens || 0)} {t("tokens")} · {r.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <MessageContent content={r.content} />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    const msg = group.message;
    return (
      <div key={msg.id} className="group">
        {msg.role === "user" ? (
          <div className="flex justify-end">
            <div className="flex items-start gap-1">
              {!isStreaming && editingMessageId !== msg.id && (
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
              <div className="max-w-[85%] rounded-2xl bg-[hsl(var(--primary))] px-5 py-3.5 text-[hsl(var(--primary-foreground))]">
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
              {!isStreaming && (
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
    );
  };

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

          {/* Compare mode toggle */}
          <button
            onClick={toggleCompareMode}
            disabled={isStreaming}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              compareMode
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "hover:bg-[hsl(var(--accent))]",
              isStreaming && "opacity-50"
            )}
            title={t("compareMode")}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {t("compareMode")}
          </button>

          {currentChatId && !compareMode && (
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

        {/* Compare targets bar */}
        {compareMode && (
          <div className="flex flex-wrap items-center gap-3 border-b bg-[hsl(var(--muted))]/30 px-4 py-2">
            {compareTargets.map((target, idx) => {
              const targetModels = serverModelsCache[target.serverId] || models;
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {idx + 1}.
                  </span>
                  <div className="relative">
                    <select
                      value={target.serverId}
                      onChange={(e) => updateCompareTarget(idx, "serverId", e.target.value)}
                      className="h-7 appearance-none rounded border bg-transparent pl-2 pr-6 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                    >
                      {servers.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[hsl(var(--background))]">
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div className="relative">
                    <select
                      value={target.model}
                      onChange={(e) => updateCompareTarget(idx, "model", e.target.value)}
                      className="h-7 appearance-none rounded border bg-transparent pl-2 pr-6 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                    >
                      {targetModels.map((m) => (
                        <option key={m.name} value={m.name} className="bg-[hsl(var(--background))]">
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  {compareTargets.length > 2 && (
                    <button
                      onClick={() => removeCompareTarget(idx)}
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {compareTargets.length < 3 && (
              <button
                onClick={addCompareTarget}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                {t("addModel")}
              </button>
            )}
          </div>
        )}

        <ChatParametersModal
          open={paramsOpen}
          onClose={() => setParamsOpen(false)}
          parameters={chatParameters}
          onChange={currentChatId ? updateParameters : setChatParameters}
        />

        {/* Messages area */}
        {!currentChatId && messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
            <EmptyState
              icon={MessageSquare}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          </div>
        ) : (
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-auto p-4"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="mx-auto max-w-5xl space-y-6">
              {groupedMessages.map((group, groupIdx) =>
                renderMessageGroup(group, groupIdx)
              )}

              {/* Live compare streaming inline */}
              {compareResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-[hsl(var(--primary))] px-5 py-3.5 text-[hsl(var(--primary-foreground))]">
                      <div className="flex items-center gap-2 text-sm">
                        <GitCompareArrows className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{comparePromptRef.current}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`grid ${compareResults.length === 1 ? "grid-cols-1" : compareResults.length === 2 ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
                    {compareResults.map((result, rIdx) => (
                      <div key={rIdx} className="rounded-2xl bg-[hsl(var(--muted))] px-4 py-2.5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{result.model}</span>
                          {result.done && result.latencyMs && (
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                              {(result.promptTokens || 0) + (result.completionTokens || 0)} {t("tokens")} · {result.latencyMs}ms
                            </span>
                          )}
                        </div>
                        {result.error ? (
                          <div className="text-sm text-[hsl(var(--destructive))]">{result.error}</div>
                        ) : result.content ? (
                          <MessageContent content={result.content} />
                        ) : result.streaming ? (
                          <TypingIndicator />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
          </div>
        )}

        {/* Input area */}
        <div className="bg-[hsl(var(--background))] px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-end gap-2">
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
                placeholder={compareMode ? t("comparePlaceholder") : t("typeMessage")}
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none overflow-y-hidden rounded-xl border bg-[hsl(var(--card))] py-3 pl-12 pr-12 text-sm shadow-sm transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
              />
              {isStreaming ? (
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
                  aria-label={compareMode ? t("compareMode") : t("sendMessage")}
                >
                  {compareMode ? (
                    <GitCompareArrows className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
