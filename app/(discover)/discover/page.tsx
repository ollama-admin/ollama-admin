"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useRef } from "react";
import { Search, RefreshCw, Check, Download, Loader2 } from "lucide-react";
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
  description: string;
  capabilities: string[];
  sizes: string[];
  pulls: string;
  updated: string;
}

interface Server {
  id: string;
  name: string;
}

const CAPABILITY_OPTIONS = ["tools", "vision", "embedding", "thinking"];

export default function DiscoverPage() {
  const t = useTranslations("discover");
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [downloadingRefs, setDownloadingRefs] = useState<Set<string>>(new Set());
  const downloadingRefsRef = useRef(downloadingRefs);
  downloadingRefsRef.current = downloadingRefs;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Poll for download completion and errors
  useEffect(() => {
    if (downloadingRefs.size === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      if (!selectedServer) return;

      // Check pull status for errors
      try {
        const statusRes = await fetch(
          `/api/admin/models/pull/status?serverId=${selectedServer}`
        );
        if (statusRes.ok) {
          const jobs: { id: string; model: string; tag: string; status: string; error?: string }[] =
            await statusRes.json();

          for (const job of jobs) {
            const ref = job.tag ? `${job.model}:${job.tag}` : job.model;
            if (job.status === "error" && downloadingRefsRef.current.has(ref)) {
              const msg = job.error
                ? `${t("pullError", { name: ref })}: ${job.error}`
                : t("pullError", { name: ref });
              toast(msg, "error", 15000);
              setDownloadingRefs((prev) => {
                const next = new Set(prev);
                next.delete(ref);
                return next;
              });
            }
          }
        }
      } catch {
        // ignore polling errors
      }

      // Check if models appeared on server
      try {
        const modelsRes = await fetch(
          `/api/admin/models?serverId=${selectedServer}`
        );
        if (modelsRes.ok) {
          const data = await modelsRes.json();
          if (data.models) {
            const names = new Set<string>(
              data.models.map((m: { name: string }) => m.name)
            );
            setDownloadedModels(names);

            setDownloadingRefs((prev) => {
              const next = new Set(prev);
              let changed = false;
              const namesArr = Array.from(names);
              Array.from(prev).forEach((ref) => {
                const isNowDownloaded = namesArr.some(
                  (n) => n === ref || n.startsWith(`${ref}-`)
                );
                if (isNowDownloaded) {
                  next.delete(ref);
                  changed = true;
                  toast(t("pullComplete", { name: ref }), "success");
                }
              });
              return changed ? next : prev;
            });
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [downloadingRefs.size, selectedServer, t, toast]);

  const fetchCatalog = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (selectedCaps.length > 0) params.set("c", selectedCaps.join(","));

    setLoading(true);
    fetch(`/api/catalog?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setModels(data);
      })
      .finally(() => setLoading(false));
  }, [search, selectedCaps]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const toggleCap = (cap: string) => {
    setSelectedCaps((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const handlePull = async (modelName: string, tag?: string) => {
    if (!selectedServer) return;
    const ref = tag ? `${modelName}:${tag}` : modelName;

    if (downloadingRefs.has(ref)) return;

    setDownloadingRefs((prev) => new Set(prev).add(ref));

    try {
      const res = await fetch("/api/admin/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selectedServer, name: ref }),
      });

      if (!res.ok) {
        toast(t("pullError", { name: ref }), "error");
        setDownloadingRefs((prev) => {
          const next = new Set(prev);
          next.delete(ref);
          return next;
        });
        return;
      }

      toast(t("pullStarted", { name: ref }), "success");
    } catch {
      toast(t("pullError", { name: ref }), "error");
      setDownloadingRefs((prev) => {
        const next = new Set(prev);
        next.delete(ref);
        return next;
      });
    }
  };

  const isModelTagDownloaded = (modelName: string, tag: string) => {
    const ref = `${modelName}:${tag}`;
    return Array.from(downloadedModels).some(
      (name) => name === ref || name.startsWith(`${ref}-`)
    );
  };

  const isDownloading = (modelName: string, tag: string) => {
    return downloadingRefs.has(`${modelName}:${tag}`);
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchModels")}
          className="flex-1"
        />
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

      {/* Capability multi-select */}
      <div className="mt-3 flex flex-wrap gap-2">
        {CAPABILITY_OPTIONS.map((cap) => (
          <button
            key={cap}
            onClick={() => toggleCap(cap)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selectedCaps.includes(cap)
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
            }`}
          >
            {t(`capabilities.${cap}`)}
          </button>
        ))}
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
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{model.name}</h3>
                  {model.capabilities.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {model.capabilities.map((cap) => (
                        <Badge key={cap} variant="muted" className="text-[10px]">
                          {t(`capabilities.${cap}`)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {model.description && (
                <p className="mt-2 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {model.description}
                </p>
              )}
              {/* Size variant pull buttons */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {model.sizes.length > 0 ? (
                  model.sizes.map((size) => {
                    const downloaded = isModelTagDownloaded(model.name, size);
                    const pulling = isDownloading(model.name, size);

                    if (downloaded) {
                      return (
                        <Badge key={size} variant="success" className="text-[10px]">
                          <Check className="mr-0.5 h-2.5 w-2.5" />
                          {size}
                        </Badge>
                      );
                    }

                    if (pulling) {
                      return (
                        <Badge key={size} variant="default" className="text-[10px]">
                          <Loader2 className="mr-0.5 h-2.5 w-2.5 animate-spin" />
                          {size}
                        </Badge>
                      );
                    }

                    if (isAdmin) {
                      return (
                        <button
                          key={size}
                          onClick={() => handlePull(model.name, size)}
                          disabled={!selectedServer}
                          className="inline-flex items-center rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                        >
                          <Download className="mr-0.5 h-2.5 w-2.5" />
                          {size}
                        </button>
                      );
                    }

                    return (
                      <Badge key={size} variant="muted" className="text-[10px]">
                        {size}
                      </Badge>
                    );
                  })
                ) : isAdmin ? (
                  <button
                    onClick={() => handlePull(model.name)}
                    disabled={
                      isDownloading(model.name, "latest") ||
                      isModelTagDownloaded(model.name, "latest") ||
                      !selectedServer
                    }
                    className="inline-flex items-center rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                  >
                    {isModelTagDownloaded(model.name, "latest") ? (
                      <><Check className="mr-0.5 h-2.5 w-2.5" />{t("downloaded")}</>
                    ) : isDownloading(model.name, "latest") ? (
                      <><Loader2 className="mr-0.5 h-2.5 w-2.5 animate-spin" />{t("downloading")}</>
                    ) : (
                      <><Download className="mr-0.5 h-2.5 w-2.5" />{t("pullModel")}</>
                    )}
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
                {model.pulls && <span>{model.pulls} pulls</span>}
                {model.updated && <span>{model.updated}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
