"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useRef } from "react";
import { Search, RefreshCw, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { getSizeTags, getCapabilityTags } from "@/lib/catalog-utils";

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

interface ActivePull {
  modelRef: string;
  progress: number;
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
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [activePulls, setActivePulls] = useState<Map<string, ActivePull>>(new Map());
  const activePullsRef = useRef(activePulls);
  activePullsRef.current = activePulls;

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

  const fetchDownloaded = useCallback((serverId: string) => {
    if (!serverId) return;
    fetch(`/api/admin/models?serverId=${serverId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.models) {
          const names = new Set<string>(
            data.models.map((m: { name: string }) => m.name)
          );
          setDownloadedModels(names);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedServer) fetchDownloaded(selectedServer);
  }, [selectedServer, fetchDownloaded]);

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

  const handlePull = async (modelName: string, tag?: string) => {
    if (!selectedServer) return;
    const ref = tag ? `${modelName}:${tag}` : modelName;

    if (activePullsRef.current.has(ref)) return;

    setActivePulls((prev) => new Map(prev).set(ref, { modelRef: ref, progress: 0 }));

    try {
      const res = await fetch("/api/admin/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selectedServer, name: ref, stream: true }),
      });

      if (!res.ok || !res.body) {
        toast(t("pullError", { name: ref }), "error");
        setActivePulls((prev) => {
          const next = new Map(prev);
          next.delete(ref);
          return next;
        });
        return;
      }

      toast(t("pullStarted", { name: ref }), "success");
      consumePullStream(res.body, ref);
    } catch {
      toast(t("pullError", { name: ref }), "error");
      setActivePulls((prev) => {
        const next = new Map(prev);
        next.delete(ref);
        return next;
      });
    }
  };

  const consumePullStream = async (body: ReadableStream, ref: string) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
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
              const progress = Math.round((json.completed / json.total) * 100);
              setActivePulls((prev) =>
                new Map(prev).set(ref, { modelRef: ref, progress })
              );
            }
          } catch {
            // skip
          }
        }
      }

      toast(t("pullComplete", { name: ref }), "success");
      if (selectedServer) fetchDownloaded(selectedServer);
    } catch {
      toast(t("pullError", { name: ref }), "error");
    } finally {
      setActivePulls((prev) => {
        const next = new Map(prev);
        next.delete(ref);
        return next;
      });
    }
  };

  const isModelTagDownloaded = (modelName: string, tag: string) => {
    const ref = `${modelName}:${tag}`;
    for (const name of downloadedModels) {
      if (name === ref || name.startsWith(`${ref}-`)) return true;
    }
    return false;
  };

  const getActivePull = (modelName: string, tag: string): ActivePull | undefined => {
    return activePulls.get(`${modelName}:${tag}`);
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
          {models.map((model) => {
            const sizeTags = getSizeTags(model.tags);
            const capTags = getCapabilityTags(model.tags);

            return (
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
                  {isAdmin && sizeTags.length === 0 && (
                    <Button
                      size="sm"
                      onClick={() => handlePull(model.name)}
                      disabled={
                        !!getActivePull(model.name, "latest") ||
                        isModelTagDownloaded(model.name, "latest") ||
                        !selectedServer
                      }
                      loading={!!getActivePull(model.name, "latest")}
                    >
                      {isModelTagDownloaded(model.name, "latest") ? (
                        <><Check className="mr-1 h-3 w-3" />{t("downloaded")}</>
                      ) : getActivePull(model.name, "latest") ? (
                        `${getActivePull(model.name, "latest")?.progress}%`
                      ) : (
                        t("pullModel")
                      )}
                    </Button>
                  )}
                </div>
                {model.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {model.description}
                  </p>
                )}
                {capTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {capTags.map((tag) => (
                      <Badge key={tag} variant="muted" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {sizeTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sizeTags.map((tag) => {
                      const downloaded = isModelTagDownloaded(model.name, tag);
                      const pull = getActivePull(model.name, tag);

                      if (downloaded) {
                        return (
                          <Badge key={tag} variant="success" className="text-[10px]">
                            <Check className="mr-0.5 h-2.5 w-2.5" />
                            {tag}
                          </Badge>
                        );
                      }

                      if (pull) {
                        return (
                          <Badge key={tag} variant="default" className="text-[10px]">
                            {tag} {pull.progress}%
                          </Badge>
                        );
                      }

                      if (isAdmin) {
                        return (
                          <button
                            key={tag}
                            onClick={() => handlePull(model.name, tag)}
                            disabled={!selectedServer}
                            className="inline-flex items-center rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                          >
                            <Download className="mr-0.5 h-2.5 w-2.5" />
                            {tag}
                          </button>
                        );
                      }

                      return (
                        <Badge key={tag} variant="muted" className="text-[10px]">
                          {tag}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {model.pullCount != null && model.pullCount > 0 && (
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {model.pullCount.toLocaleString()} {t("downloads")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
