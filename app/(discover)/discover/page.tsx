"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw } from "lucide-react";
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

interface CatalogResponse {
  models: CatalogModel[];
  families: string[];
  lastRefreshed: string | null;
  total: number;
}

interface Server {
  id: string;
  name: string;
}

export default function DiscoverPage() {
  const t = useTranslations("discover");
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.role === "admin") setIsAdmin(true);
      });
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data);
        if (data.length > 0) setSelectedServer(data[0].id);
      });
  }, []);

  const fetchCatalog = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (family) params.set("family", family);

    setLoading(true);
    fetch(`/api/catalog?${params}`)
      .then((r) => r.json())
      .then((data: CatalogResponse) => {
        setModels(data.models);
        setFamilies(data.families);
        setLastRefreshed(data.lastRefreshed);
      })
      .finally(() => setLoading(false));
  }, [search, family]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/catalog/refresh", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || t("refreshError"), "error");
        return;
      }
      toast(t("refreshSuccess"), "success");
      fetchCatalog();
    } catch {
      toast(t("refreshError"), "error");
    } finally {
      setRefreshing(false);
    }
  };

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
      toast(t("pullComplete", { name: modelName }), "success");
    } catch {
      toast(t("pullError", { name: modelName }), "error");
    } finally {
      setPullingModel(null);
      setPullProgress("");
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("lastRefresh")}: {new Date(lastRefreshed).toLocaleDateString()}
            </span>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              loading={refreshing}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {refreshing ? t("refreshing") : t("refreshCatalog")}
            </Button>
          )}
        </div>
      </div>

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
          {families.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>
        {isAdmin && servers.length > 1 && (
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
          action={
            isAdmin ? (
              <Button onClick={handleRefresh} disabled={refreshing} loading={refreshing}>
                {refreshing ? t("refreshing") : t("emptyAction")}
              </Button>
            ) : undefined
          }
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
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => handlePull(model.name)}
                    disabled={pullingModel === model.name || !selectedServer}
                    loading={pullingModel === model.name}
                  >
                    {pullingModel === model.name ? pullProgress : t("pullModel")}
                  </Button>
                )}
              </div>
              {model.description && (
                <p className="mt-2 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {model.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {model.tags.split(",").filter(Boolean).map((tag) => (
                  <Badge key={tag} variant="muted" className="text-[10px]">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
              {model.pullCount != null && model.pullCount > 0 && (
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
