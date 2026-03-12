"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { Search, Check, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useServers } from "@/lib/hooks/use-servers";
import { scoreModel, gradeColor, gradeBg, type Grade } from "@/lib/model-scoring";

interface CatalogModel {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  sizes: string[];
  pulls: string;
  updated: string;
}

interface GpuSpecs {
  gpuName: string;
  vramGB: number;
  bandwidthGBs: number | null;
}

const CAPABILITY_OPTIONS = ["tools", "vision", "embedding", "thinking"];

const GRADE_LABELS: Record<Grade, string> = {
  S: "≥50 t/s",
  A: "≥30 t/s",
  B: "≥15 t/s",
  C: "≥8 t/s",
  D: "≥3 t/s",
  F: "no fit",
};

// Estimate model size in GB from a tag like "7b", "13b", "70b" using Q4 approximation.
function parseTagToSizeGB(tag: string): number | null {
  const match = tag.toLowerCase().match(/^(\d+(?:\.\d+)?)b$/);
  if (!match) return null;
  return parseFloat(match[1]) * 0.55;
}

export default function DiscoverPage() {
  const t = useTranslations("discover");
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { toast } = useToast();
  const { servers, selectedServer, setSelectedServer } = useServers();
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [downloadingRefs, setDownloadingRefs] = useState<Set<string>>(new Set());
  const [gpuSpecs, setGpuSpecs] = useState<GpuSpecs | null>(null);
  const [fitsGpuOnly, setFitsGpuOnly] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!selectedServer) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/models?serverId=${selectedServer}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.models && !cancelled) {
          setDownloadedModels(new Set(data.models.map((m: { name: string }) => m.name)));
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [selectedServer]);

  useEffect(() => {
    if (!selectedServer) return;
    fetch(`/api/gpu/specs?serverId=${selectedServer}`)
      .then((r) => r.json())
      .then((data: GpuSpecs | null) => setGpuSpecs(data))
      .catch(() => {});
  }, [selectedServer]);

  // Poll for download status
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

      try {
        const [statusRes, modelsRes] = await Promise.all([
          fetch(`/api/admin/models/pull/status?serverId=${selectedServer}`),
          fetch(`/api/admin/models?serverId=${selectedServer}`),
        ]);

        if (statusRes.ok) {
          const jobs: { model: string; tag: string; status: string; error?: string }[] = await statusRes.json();
          for (const job of jobs) {
            const ref = job.tag ? `${job.model}:${job.tag}` : job.model;
            if (job.status === "error") {
              setDownloadingRefs((prev) => {
                if (!prev.has(ref)) return prev;
                const next = new Set(prev);
                next.delete(ref);
                toast(job.error ? `${t("pullError", { name: ref })}: ${job.error}` : t("pullError", { name: ref }), "error");
                return next;
              });
            }
          }
        }

        if (modelsRes.ok) {
          const data = await modelsRes.json();
          if (data.models) {
            const names = new Set<string>(data.models.map((m: { name: string }) => m.name));
            setDownloadedModels(names);

            setDownloadingRefs((prev) => {
              const next = new Set(prev);
              let changed = false;
              for (const ref of prev) {
                if (names.has(ref) || [...names].some((n) => n.startsWith(`${ref}-`))) {
                  next.delete(ref);
                  changed = true;
                  toast(t("pullComplete", { name: ref }), "success");
                }
              }
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

  useEffect(() => {
    const loadCatalog = async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (selectedCaps.length > 0) params.set("c", selectedCaps.join(","));

      const r = await fetch(`/api/catalog?${params}`);
      const data = await r.json();
      if (Array.isArray(data)) setModels(data);
      setLoading(false);
    };
    void loadCatalog();
  }, [search, selectedCaps]);

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
        setDownloadingRefs((prev) => { const next = new Set(prev); next.delete(ref); return next; });
        return;
      }
      toast(t("pullStarted", { name: ref }), "success");
    } catch {
      toast(t("pullError", { name: ref }), "error");
      setDownloadingRefs((prev) => { const next = new Set(prev); next.delete(ref); return next; });
    }
  };

  const isModelTagDownloaded = (modelName: string, tag: string) => {
    const ref = `${modelName}:${tag}`;
    for (const name of downloadedModels) {
      if (name === ref || name.startsWith(`${ref}-`)) return true;
    }
    return false;
  };

  const isDownloading = (modelName: string, tag: string) =>
    downloadingRefs.has(`${modelName}:${tag}`);

  const getTagScore = (tag: string) => {
    if (!gpuSpecs) return null;
    const sizeGB = parseTagToSizeGB(tag);
    if (sizeGB === null) return null;
    return scoreModel(sizeGB, gpuSpecs.vramGB, gpuSpecs.bandwidthGBs ?? undefined);
  };

  const displayedModels = fitsGpuOnly && gpuSpecs
    ? models.filter((model) =>
        model.sizes.length === 0 ||
        model.sizes.some((size) => {
          const sizeGB = parseTagToSizeGB(size);
          return sizeGB === null || sizeGB <= gpuSpecs.vramGB;
        })
      )
    : models;

  const gpuLabel = gpuSpecs
    ? `${gpuSpecs.gpuName.replace(/NVIDIA GeForce /i, "").replace(/NVIDIA /i, "")} · ${Math.round(gpuSpecs.vramGB)}GB`
    : null;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {gpuLabel && (
          <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {gpuLabel}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchModels")} className="flex-1" />
        {servers.length > 1 && (
          <Select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} className="w-auto">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by capability">
        {CAPABILITY_OPTIONS.map((cap) => (
          <button
            key={cap}
            onClick={() => toggleCap(cap)}
            aria-pressed={selectedCaps.includes(cap)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selectedCaps.includes(cap)
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
            }`}
          >
            {t(`capabilities.${cap}`)}
          </button>
        ))}
        {gpuSpecs && (
          <button
            onClick={() => setFitsGpuOnly((v) => !v)}
            aria-pressed={fitsGpuOnly}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              fitsGpuOnly
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
            }`}
          >
            {t("fitsGpu")}
          </button>
        )}
      </div>

      {gpuSpecs && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="font-semibold text-[hsl(var(--foreground))]">GPU:</span>
          {(["S", "A", "B", "C", "D", "F"] as Grade[]).map((g) => (
            <span key={g} className="flex items-center gap-1.5">
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: gradeColor(g), background: gradeBg(g) }}>
                {g}
              </span>
              <span>{GRADE_LABELS[g]}</span>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="card" />)}
        </div>
      ) : displayedModels.length === 0 ? (
        <EmptyState icon={Search} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {displayedModels.map((model) => (
            <Card key={model.id} className="flex flex-col">
              <div>
                <h3 className="font-semibold">{model.name}</h3>
                {model.capabilities.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {model.capabilities.map((cap) => (
                      <Badge key={cap} variant="muted" className="text-[10px]">{t(`capabilities.${cap}`)}</Badge>
                    ))}
                  </div>
                )}
                {model.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{model.description}</p>
                )}
              </div>

              {(model.sizes.length > 0 || isAdmin) && (
                <>
                  <div className="my-3 border-t border-[hsl(var(--border))]" />
                  <div className="space-y-0.5">
                    {model.sizes.length > 0 ? (
                      model.sizes.map((size) => {
                        const downloaded = isModelTagDownloaded(model.name, size);
                        const pulling = isDownloading(model.name, size);
                        const score = getTagScore(size);
                        const sizeGB = parseTagToSizeGB(size);
                        const gbLabel = sizeGB != null
                          ? sizeGB < 10 ? `${sizeGB.toFixed(1)} GB` : `${Math.round(sizeGB)} GB`
                          : null;

                        const rowInner = (
                          <div className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors${score && !score.fits ? " opacity-50" : ""}${isAdmin && !downloaded && !pulling ? " hover:bg-[hsl(var(--muted))]" : ""}`}>
                            <span className="w-10 shrink-0 font-mono font-semibold">{size}</span>
                            <span className="w-14 shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{gbLabel ?? ""}</span>
                            {gpuSpecs && (
                              <span className="w-16 shrink-0 text-xs tabular-nums" style={{ color: score?.fits && score.tps > 0 ? gradeColor(score.grade) : undefined }}>
                                {score?.fits && score.tps > 0 ? `~${Math.round(score.tps)} t/s` : ""}
                              </span>
                            )}
                            {gpuSpecs && score && (
                              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: gradeColor(score.grade), background: gradeBg(score.grade) }}>
                                {score.grade}
                              </span>
                            )}
                            <div className="ml-auto shrink-0">
                              {downloaded ? (
                                <Check className="h-4 w-4 text-[hsl(142_71%_45%)]" />
                              ) : pulling ? (
                                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                              ) : isAdmin ? (
                                <Download className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                              ) : null}
                            </div>
                          </div>
                        );

                        if (!isAdmin || downloaded || pulling) {
                          return <div key={size}>{rowInner}</div>;
                        }
                        return (
                          <button
                            key={size}
                            onClick={() => handlePull(model.name, size)}
                            disabled={!selectedServer}
                            aria-label={`${t("pullModel")} ${model.name}:${size}`}
                            className="w-full text-left disabled:opacity-50"
                          >
                            {rowInner}
                          </button>
                        );
                      })
                    ) : (
                      <button
                        onClick={() => handlePull(model.name)}
                        disabled={isDownloading(model.name, "latest") || isModelTagDownloaded(model.name, "latest") || !selectedServer}
                        aria-label={`${t("pullModel")} ${model.name}`}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                      >
                        <span className="w-10 shrink-0 font-mono font-semibold text-[hsl(var(--muted-foreground))]">latest</span>
                        <div className="ml-auto shrink-0">
                          {isModelTagDownloaded(model.name, "latest") ? (
                            <Check className="h-4 w-4 text-[hsl(142_71%_45%)]" />
                          ) : isDownloading(model.name, "latest") ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                          ) : (
                            <Download className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className="mt-auto pt-3 flex items-center gap-3 text-[11px] text-[hsl(var(--muted-foreground))]">
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
