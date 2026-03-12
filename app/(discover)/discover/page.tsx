"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect, useState, useRef, useMemo } from "react";
import { Search, Check, Download, Loader2, Wrench, Eye, Layers, Zap, Code } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  S: "≥50 t/s", A: "≥30 t/s", B: "≥15 t/s", C: "≥8 t/s", D: "≥3 t/s", F: "no fit",
};

const CAP_ICONS: Record<string, React.ReactNode> = {
  tools:     <Wrench className="h-3.5 w-3.5" />,
  vision:    <Eye    className="h-3.5 w-3.5" />,
  embedding: <Layers className="h-3.5 w-3.5" />,
  thinking:  <Zap    className="h-3.5 w-3.5" />,
  code:      <Code   className="h-3.5 w-3.5" />,
};

const CAP_COLORS: Record<string, string> = {
  tools:     "hsl(38 92% 50%)",
  vision:    "hsl(217 91% 60%)",
  embedding: "hsl(271 81% 56%)",
  thinking:  "hsl(142 71% 45%)",
  code:      "hsl(25 95% 53%)",
};

// Estimate model size in GB from a tag like "7b", "13b", "70b" using Q4 approximation.
function parseTagToSizeGB(tag: string): number | null {
  // Normalize: MoE "8x7b" → "7b", e-series "e2b" → "2b"
  const t = tag.toLowerCase().replace(/^\d+x/, "").replace(/^e(\d)/, "$1");
  const bMatch = t.match(/^(\d+(?:\.\d+)?)b$/);
  if (bMatch) return parseFloat(bMatch[1]) * 0.55;
  const mMatch = t.match(/^(\d+(?:\.\d+)?)m$/);
  if (mMatch) return (parseFloat(mMatch[1]) / 1000) * 0.55;
  return null;
}

function vramStyle(memPct: number): React.CSSProperties {
  if (memPct >= 100) return { color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))" };
  if (memPct >= 80)  return { color: "hsl(0 84% 60%)",    background: "hsl(0 84% 60% / 0.15)" };
  if (memPct >= 60)  return { color: "hsl(38 92% 50%)",   background: "hsl(38 92% 50% / 0.15)" };
  return               { color: "hsl(142 71% 45%)",  background: "hsl(142 71% 45% / 0.15)" };
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
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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
                const next = new Set(prev); next.delete(ref);
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
              const next = new Set(prev); let changed = false;
              for (const ref of prev) {
                if (names.has(ref) || [...names].some((n) => n.startsWith(`${ref}-`))) {
                  next.delete(ref); changed = true;
                  toast(t("pullComplete", { name: ref }), "success");
                }
              }
              return changed ? next : prev;
            });
          }
        }
      } catch { /* ignore polling errors */ }
    }, 5000);

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
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
    setSelectedCaps((prev) => prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]);
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

  // Flatten models × sizes into individual rows; apply GPU filter and sort by grade.
  const flatRows = useMemo(() => {
    const GRADE_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 };

    const rows = models.flatMap((model) => {
      const sizes = model.sizes.length > 0 ? model.sizes : ["latest"];
      const all = sizes.map((size) => ({ ...model, size }));
      if (fitsGpuOnly && gpuSpecs) {
        return all.filter(({ size }) => {
          const sizeGB = parseTagToSizeGB(size);
          return sizeGB === null || sizeGB <= gpuSpecs.vramGB;
        });
      }
      return all;
    });

    if (!gpuSpecs) return rows;

    return [...rows].sort((a, b) => {
      const scoreA = getTagScore(a.size);
      const scoreB = getTagScore(b.size);
      const gradeA = scoreA ? GRADE_ORDER[scoreA.grade] ?? 6 : 6;
      const gradeB = scoreB ? GRADE_ORDER[scoreB.grade] ?? 6 : 6;
      if (gradeA !== gradeB) return gradeA - gradeB;
      // Within same grade, sort by tps descending
      return (scoreB?.tps ?? 0) - (scoreA?.tps ?? 0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, fitsGpuOnly, gpuSpecs]);

  const gpuLabel = gpuSpecs
    ? `${gpuSpecs.gpuName.replace(/NVIDIA GeForce /i, "").replace(/NVIDIA /i, "")} · ${Math.round(gpuSpecs.vramGB)}GB`
    : null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {gpuLabel && (
          <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {gpuLabel}
          </span>
        )}
      </div>

      {/* Search + Server */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchModels")} className="flex-1" />
        {servers.length > 1 && (
          <Select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} className="w-auto">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
      </div>

      {/* Capability filters + Fits GPU */}
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

      {/* GPU grade legend */}
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

      {/* Model list */}
      {loading ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-[hsl(var(--border))]">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-6 border-b border-[hsl(var(--border))] px-4 py-3 last:border-0">
              <div className="h-4 w-40 animate-pulse rounded bg-[hsl(var(--muted))]" />
              <div className="h-4 flex-1 animate-pulse rounded bg-[hsl(var(--muted))] opacity-30" />
              <div className="h-4 w-20 animate-pulse rounded bg-[hsl(var(--muted))]" />
              <div className="h-6 w-6 animate-pulse rounded bg-[hsl(var(--muted))]" />
            </div>
          ))}
        </div>
      ) : flatRows.length === 0 ? (
        <EmptyState icon={Search} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-[hsl(var(--border))]">
          {/* Column headers */}
          <div className="flex items-center gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.6)] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <span className="flex-1">Model</span>
            <span className="w-24 shrink-0 text-right hidden sm:block">Updated</span>
            <span className="w-28 shrink-0 text-right">Size</span>
            {gpuSpecs && <span className="w-24 shrink-0 text-right hidden md:block">Speed</span>}
            {gpuSpecs && <span className="w-10 shrink-0 text-center">Grade</span>}
            <span className="w-8 shrink-0" />
          </div>

          {flatRows.map((row, idx) => {
            const downloaded = isModelTagDownloaded(row.name, row.size);
            const pulling = isDownloading(row.name, row.size);
            const score = getTagScore(row.size);
            const sizeGB = parseTagToSizeGB(row.size);
            const gbLabel = sizeGB != null
              ? sizeGB < 10 ? `${sizeGB.toFixed(1)} GB` : `${Math.round(sizeGB)} GB`
              : null;
            const noFit = score && !score.fits;
            const isLast = idx === flatRows.length - 1;

            const rowInner = (
              <div className={[
                "flex items-center gap-4 px-4 py-3 text-sm",
                noFit ? "opacity-40" : "",
                !isLast ? "border-b border-[hsl(var(--border))]" : "",
              ].join(" ")}>
                {/* Name + size tag + capability icons */}
                <div className="min-w-0 flex-1 flex items-center gap-3">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{row.name}</span>
                    <span className="shrink-0 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                      {row.size}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {row.capabilities.map((cap) => (
                      <span key={cap} title={cap} style={{ color: CAP_COLORS[cap] ?? "hsl(var(--muted-foreground))" }}>
                        {CAP_ICONS[cap] ?? null}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Updated */}
                <span className="w-24 shrink-0 text-right text-xs text-[hsl(var(--muted-foreground))] hidden sm:block">
                  {row.updated}
                </span>

                {/* GB + VRAM% */}
                <div className="w-28 shrink-0 flex items-center justify-end gap-1.5">
                  {gbLabel && <span className="tabular-nums">{gbLabel}</span>}
                  {score && gpuSpecs && (
                    <span className="rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums" style={vramStyle(score.memPct)}>
                      {Math.round(score.memPct)}%
                    </span>
                  )}
                </div>

                {/* Speed */}
                {gpuSpecs && (
                  <div className="w-24 shrink-0 text-right text-sm tabular-nums hidden md:block">
                    {score?.fits && score.tps > 0 ? (
                      <span style={{ color: gradeColor(score.grade) }}>~{Math.round(score.tps)} t/s</span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </div>
                )}

                {/* Grade */}
                {gpuSpecs && (
                  <div className="w-10 shrink-0 flex justify-center">
                    {score ? (
                      <span className="text-xl font-bold leading-none" style={{ color: gradeColor(score.grade) }}>
                        {score.grade}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </div>
                )}

                {/* Action */}
                <div className="w-8 shrink-0 flex justify-end">
                  {downloaded ? (
                    <Check className="h-4 w-4 text-[hsl(142_71%_45%)]" />
                  ) : pulling ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                  ) : isAdmin ? (
                    <button
                      onClick={() => handlePull(row.name, row.size !== "latest" ? row.size : undefined)}
                      disabled={!selectedServer}
                      aria-label={`${t("pullModel")} ${row.name}:${row.size}`}
                      className="rounded p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            );

            return <div key={`${row.id}-${row.size}`}>{rowInner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
