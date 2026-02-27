"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface CatalogModel {
  id: string;
  name: string;
  description: string | null;
  family: string | null;
  tags: string;
  pullCount: number | null;
  lastUpdated: string | null;
}

interface Server {
  id: string;
  name: string;
}

const familyOptions = [
  "llama", "mistral", "gemma", "phi", "qwen", "codellama",
  "deepseek", "vicuna", "starcoder", "command-r",
];

export default function DiscoverPage() {
  const t = useTranslations("discover");
  const { toast } = useToast();
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState("");

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data);
        if (data.length > 0) setSelectedServer(data[0].id);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (family) params.set("family", family);

    setLoading(true);
    fetch(`/api/catalog?${params}`)
      .then((r) => r.json())
      .then(setModels)
      .finally(() => setLoading(false));
  }, [search, family]);

  const handlePull = async (modelName: string) => {
    if (!selectedServer) return;
    setPullingModel(modelName);
    setPullProgress("Starting...");

    try {
      const res = await fetch("/api/admin/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selectedServer, name: modelName }),
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
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.total && json.completed) {
              setPullProgress(`${Math.round((json.completed / json.total) * 100)}%`);
            } else {
              setPullProgress(json.status || "Downloading...");
            }
          } catch {
            // skip
          }
        }
      }
      toast(`Model '${modelName}' downloaded`, "success");
    } catch {
      toast(`Failed to download '${modelName}'`, "error");
    } finally {
      setPullingModel(null);
      setPullProgress("");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchModels")}
          className="flex-1"
        />
        <Select
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          className="w-auto"
        >
          <option value="">{t("allFamilies")}</option>
          {familyOptions.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>
        {servers.length > 1 && (
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="w-auto"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      ) : models.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Card key={model.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{model.name}</h3>
                  {model.family && (
                    <Badge variant="muted" className="mt-1">
                      {model.family}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handlePull(model.name)}
                  disabled={pullingModel === model.name || !selectedServer}
                  loading={pullingModel === model.name}
                >
                  {pullingModel === model.name ? pullProgress : t("pullModel")}
                </Button>
              </div>
              {model.description && (
                <p className="mt-2 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {model.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {model.tags.split(",").map((tag) => (
                  <Badge key={tag} variant="muted" className="text-[10px]">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
              {model.pullCount && (
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {model.pullCount.toLocaleString()} {t("downloads")}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
