"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useRef } from "react";
import type { OllamaModel } from "@/lib/ollama";
import { isVisionModel } from "@/lib/model-utils";
import { Wrench, Upload, X, ImageIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { MessageContent } from "@/components/chat/message-content";

interface Server {
  id: string;
  name: string;
}

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

export default function OcrPage() {
  const t = useTranslations("tools.ocr");
  const tc = useTranslations("common");
  const { toast } = useToast();

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [visionModels, setVisionModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data);
        if (data.length > 0) setSelectedServer(data[0].id);
      });
  }, []);

  const fetchModels = useCallback(async () => {
    if (!selectedServer) return;
    setLoadingModels(true);
    setConnectionError(false);
    try {
      const res = await fetch(`/api/admin/models?serverId=${selectedServer}`);
      if (!res.ok) {
        setConnectionError(true);
        setVisionModels([]);
        setSelectedModel("");
        return;
      }
      const data = await res.json();
      const vision = (data.models || []).filter(isVisionModel);
      setVisionModels(vision);
      if (vision.length > 0) setSelectedModel(vision[0].name);
      else setSelectedModel("");
    } catch {
      setConnectionError(true);
      setVisionModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [selectedServer]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      toast(t("imageTooLarge"), "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.replace(/^data:[^;]+;base64,/, ""));
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFileChange(file);
  };

  const clearImage = () => {
    setImageBase64(null);
    setImagePreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = async () => {
    if (!imageBase64 || !selectedModel || !selectedServer) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/proxy/api/chat?serverId=${selectedServer}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: "user",
                content: prompt || t("defaultPrompt"),
                images: [imageBase64],
              },
            ],
            stream: false,
          }),
          signal: controller.signal,
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || res.statusText);
      }
      const data = await res.json();
      setResult(data.message?.content || "");
    } catch (err) {
      if (controller.signal.aborted) return;
      toast(
        `${t("error")}: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnalyzing(false);
  };

  if (loadingModels && visionModels.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (connectionError && !loadingModels) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="mt-4 w-auto"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
        <EmptyState
          icon={AlertTriangle}
          title={tc("connectionError")}
          description={tc("connectionErrorDescription")}
          action={<Button onClick={fetchModels}>{tc("retry")}</Button>}
        />
      </div>
    );
  }

  if (visionModels.length === 0 && !loadingModels) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="mt-4 w-auto"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <EmptyState
          icon={Wrench}
          title={t("noVisionModels")}
          description={t("noVisionModelsDescription")}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-3">
          {servers.length > 1 && (
            <Select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="w-auto"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-auto"
          >
            {visionModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left: Image upload */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold">{t("uploadImage")}</h2>

          {imagePreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-80 w-full rounded-lg border object-contain"
              />
              <button
                onClick={clearImage}
                className="absolute right-2 top-2 rounded-full bg-[hsl(var(--background))] p-1 shadow-md transition-colors hover:bg-[hsl(var(--accent))]"
                aria-label={t("clearImage")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]"
            >
              <Upload className="h-8 w-8" />
              <p className="text-sm">{t("dropOrClick")}</p>
              <p className="text-xs">{t("supportedFormats")}</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          />

          <div className="mt-4">
            <Textarea
              label={t("customPrompt")}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("defaultPrompt")}
              rows={3}
              className="text-sm"
            />
          </div>

          {analyzing ? (
            <Button
              className="mt-4 w-full"
              variant="destructive"
              onClick={handleCancel}
            >
              {tc("cancel")}
            </Button>
          ) : (
            <Button
              className="mt-4 w-full"
              onClick={handleAnalyze}
              disabled={!imageBase64 || !selectedModel}
            >
              {t("analyze")}
            </Button>
          )}
        </Card>

        {/* Right: Result */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold">{t("result")}</h2>

          {analyzing ? (
            <div className="space-y-3">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : result !== null ? (
            <div className="max-h-[500px] overflow-y-auto">
              <MessageContent content={result} />
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm">{t("resultEmpty")}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
