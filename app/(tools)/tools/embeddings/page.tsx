"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import type { OllamaModel } from "@/lib/ollama";
import { isEmbeddingModel } from "@/lib/model-utils";
import { Binary } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface Server {
  id: string;
  name: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export default function EmbeddingsPage() {
  const t = useTranslations("tools.embeddings");
  const { toast } = useToast();

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [embeddingModels, setEmbeddingModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);

  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [embeddingA, setEmbeddingA] = useState<number[] | null>(null);
  const [embeddingB, setEmbeddingB] = useState<number[] | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

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
    try {
      const res = await fetch(`/api/admin/models?serverId=${selectedServer}`);
      const data = await res.json();
      const embedding = (data.models || []).filter(isEmbeddingModel);
      setEmbeddingModels(embedding);
      if (embedding.length > 0) setSelectedModel(embedding[0].name);
      else setSelectedModel("");
    } catch {
      setEmbeddingModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [selectedServer]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const generateEmbeddings = async () => {
    if (!textA.trim() || !selectedModel || !selectedServer) return;
    setGenerating(true);
    setEmbeddingA(null);
    setEmbeddingB(null);
    setSimilarity(null);

    try {
      const inputs = [textA.trim()];
      if (textB.trim()) inputs.push(textB.trim());

      const res = await fetch(
        `/api/proxy/api/embed?serverId=${selectedServer}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel, input: inputs }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || res.statusText);
      }

      const data = await res.json();
      const embeddings: number[][] = data.embeddings || [];

      if (embeddings.length > 0) setEmbeddingA(embeddings[0]);
      if (embeddings.length > 1) {
        setEmbeddingB(embeddings[1]);
        setSimilarity(cosineSimilarity(embeddings[0], embeddings[1]));
      }
    } catch (err) {
      toast(
        `${t("error")}: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loadingModels && embeddingModels.length === 0) {
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

  if (embeddingModels.length === 0 && !loadingModels) {
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
          icon={Binary}
          title={t("noModels")}
          description={t("noModelsDescription")}
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
            {embeddingModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left: Inputs */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold">{t("inputText")}</h2>
          <Textarea
            label={t("textA")}
            value={textA}
            onChange={(e) => setTextA(e.target.value)}
            placeholder={t("textAPlaceholder")}
            rows={4}
            className="text-sm"
          />
          <div className="mt-4">
            <Textarea
              label={t("textB")}
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
              placeholder={t("textBPlaceholder")}
              rows={4}
              className="text-sm"
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t("textBHint")}
            </p>
          </div>
          <Button
            className="mt-4 w-full"
            onClick={generateEmbeddings}
            disabled={!textA.trim() || !selectedModel || generating}
          >
            {generating ? t("generating") : t("generate")}
          </Button>
        </Card>

        {/* Right: Results */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold">{t("result")}</h2>

          {generating ? (
            <div className="space-y-3">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : embeddingA ? (
            <div className="space-y-4">
              {similarity !== null && (
                <div className="rounded-lg border bg-[hsl(var(--muted))] p-4 text-center">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {t("cosineSimilarity")}
                  </p>
                  <p className="text-3xl font-bold">
                    {(similarity * 100).toFixed(1)}%
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  {t("embeddingA")} ({embeddingA.length} {t("dimensions")})
                </p>
                <pre className="max-h-32 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs">
                  [{embeddingA.slice(0, 20).map((v) => v.toFixed(6)).join(", ")}
                  {embeddingA.length > 20 && `, ... (${embeddingA.length - 20} more)`}]
                </pre>
              </div>

              {embeddingB && (
                <div>
                  <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {t("embeddingB")} ({embeddingB.length} {t("dimensions")})
                  </p>
                  <pre className="max-h-32 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs">
                    [{embeddingB.slice(0, 20).map((v) => v.toFixed(6)).join(", ")}
                    {embeddingB.length > 20 && `, ... (${embeddingB.length - 20} more)`}]
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]">
              <Binary className="h-8 w-8" />
              <p className="text-sm">{t("resultEmpty")}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
