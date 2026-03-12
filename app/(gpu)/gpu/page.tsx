"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Cpu,
  HardDrive,
  Thermometer,
  Zap,
  Activity,
  MemoryStick,
  Gauge,
  Layers,
} from "lucide-react";
import { gradeColor, gradeBg, type Grade } from "@/lib/model-scoring";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { RealtimeChart, type DataPoint } from "@/components/ui/realtime-chart";

interface RunningModel {
  name: string;
  size: number;
  size_vram: number;
  expires_at: string;
}

interface GpuInfo {
  name: string;
  memoryTotal: number;
  memoryUsed: number;
  memoryFree: number;
  temperature: number;
  utilization: number;
  powerDraw: number | null;
}

interface ModelCompatibility {
  name: string;
  sizeGB: number;
  tps: number;
  memPct: number;
  fits: boolean;
  grade: Grade;
  hasBandwidth: boolean;
}

interface ServerGpuData {
  serverId: string;
  serverName: string;
  runningModels: RunningModel[];
  gpuInfo: GpuInfo[] | null;
  modelCompatibility: ModelCompatibility[] | null;
  error?: string;
}

interface GpuHistory {
  vram: DataPoint[];
  utilization: DataPoint[];
  power: DataPoint[];
}

const MAX_HISTORY_POINTS = 60;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatBytesGB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

function tempColor(temp: number): string {
  if (temp > 80) return "hsl(var(--destructive))";
  if (temp > 65) return "hsl(var(--warning, 38 92% 50%))";
  return "hsl(var(--primary))";
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {label}
          </span>
        </div>
        <p
          className="mt-1 text-xl font-bold"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span
      className="inline-flex h-6 w-7 items-center justify-center rounded text-xs font-bold"
      style={{ color: gradeColor(grade), background: gradeBg(grade) }}
    >
      {grade}
    </span>
  );
}

function ModelCompatibilityCard({
  models,
  t,
}: {
  models: ModelCompatibility[];
  t: ReturnType<typeof useTranslations<"admin.gpu">>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" />
          {t("modelCompatibility")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("noModelsOnServer")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-[hsl(var(--muted-foreground))]">
                  <th className="pb-2 text-left font-medium">{t("model")}</th>
                  <th className="pb-2 text-right font-medium">{t("modelSize")}</th>
                  <th className="pb-2 text-right font-medium">{t("estimatedTps")}</th>
                  <th className="pb-2 text-right font-medium">{t("vramPct")}</th>
                  <th className="pb-2 text-center font-medium">{t("grade")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {models.map((m) => (
                  <tr
                    key={m.name}
                    className={
                      m.fits
                        ? "hover:bg-[hsl(var(--muted)/0.4)]"
                        : "opacity-50 hover:bg-[hsl(var(--muted)/0.4)]"
                    }
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{m.name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                      {m.sizeGB.toFixed(1)} GB
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {m.hasBandwidth && m.fits
                        ? `${m.tps.toFixed(1)} t/s`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      <span
                        className="font-medium"
                        style={{ color: m.memPct > 95 ? "hsl(var(--destructive))" : undefined }}
                      >
                        {Math.min(m.memPct, 999).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <GradeBadge grade={m.grade} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GpuPage() {
  const t = useTranslations("admin.gpu");
  const [data, setData] = useState<ServerGpuData[]>([]);
  const [loading, setLoading] = useState(true);
  const historyRef = useRef<Record<string, GpuHistory>>({});
  const [historyVersion, setHistoryVersion] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/gpu");
      const newData: ServerGpuData[] = await res.json();
      setData(newData);

      const now = Date.now();
      const updated = { ...historyRef.current };

      for (const server of newData) {
        if (!server.gpuInfo) continue;
        for (let gi = 0; gi < server.gpuInfo.length; gi++) {
          const gpu = server.gpuInfo[gi];
          const key = `${server.serverId}-${gi}`;
          if (!updated[key]) {
            updated[key] = { vram: [], utilization: [], power: [] };
          }
          const h = updated[key];

          const addPoint = (arr: DataPoint[], value: number) => {
            const next = [...arr, { time: now, value }];
            return next.length > MAX_HISTORY_POINTS
              ? next.slice(-MAX_HISTORY_POINTS)
              : next;
          };

          h.vram = addPoint(h.vram, formatBytesGB(gpu.memoryUsed));
          h.utilization = addPoint(h.utilization, gpu.utilization);
          if (gpu.powerDraw != null) {
            h.power = addPoint(h.power, gpu.powerDraw);
          }
        }
      }

      historyRef.current = updated;
      setHistoryVersion((v) => v + 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Suppress unused var warning — historyVersion triggers re-renders
  void historyVersion;

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton variant="line" className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="card" className="h-20" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton variant="card" className="h-48" />
          <Skeleton variant="card" className="h-48" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <EmptyState
          icon={Zap}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="mt-12"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("liveUpdating")}
          </span>
        </div>
      </div>

      {data.map((server) => {
        const gpus = server.gpuInfo || [];

        return (
          <div key={server.serverId} className="space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              <h2 className="text-lg font-semibold">{server.serverName}</h2>
              {server.error && (
                <Badge variant="destructive">{t("offline")}</Badge>
              )}
            </div>

            {server.error && (
              <p className="text-sm text-[hsl(var(--destructive))]">
                {server.error}
              </p>
            )}

            {gpus.map((gpu, gi) => {
              const key = `${server.serverId}-${gi}`;
              const history = historyRef.current[key];
              const memPct =
                gpu.memoryTotal > 0
                  ? Math.round((gpu.memoryUsed / gpu.memoryTotal) * 100)
                  : 0;
              const totalGB = formatBytesGB(gpu.memoryTotal);

              return (
                <div key={gi} className="space-y-4">
                  {/* Stat cards row */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatCard
                      icon={Cpu}
                      label={t("gpuName")}
                      value={gpu.name}
                    />
                    <StatCard
                      icon={Thermometer}
                      label={t("temperature")}
                      value={gpu.temperature >= 0 ? `${gpu.temperature}°C` : "N/A"}
                      valueColor={gpu.temperature >= 0 ? tempColor(gpu.temperature) : undefined}
                      sub={
                        gpu.temperature > 80
                          ? t("tempHigh")
                          : gpu.temperature > 65
                            ? t("tempWarm")
                            : gpu.temperature >= 0
                              ? t("tempNormal")
                              : undefined
                      }
                    />
                    <StatCard
                      icon={Gauge}
                      label={t("utilization")}
                      value={`${gpu.utilization}%`}
                    />
                    <StatCard
                      icon={Zap}
                      label={t("powerDraw")}
                      value={
                        gpu.powerDraw != null ? `${gpu.powerDraw}W` : "N/A"
                      }
                    />
                  </div>

                  {/* Charts grid */}
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* VRAM Usage chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <MemoryStick className="h-4 w-4" />
                          {t("vramUsage")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <ProgressBar
                          value={memPct}
                          max={100}
                          label={`${formatBytes(gpu.memoryUsed)} / ${formatBytes(gpu.memoryTotal)}`}
                        />
                        <RealtimeChart
                          data={history?.vram || []}
                          max={totalGB}
                          min={0}
                          unit="GB"
                          color="hsl(var(--primary))"
                          label={t("vramUsage")}
                          height={100}
                        />
                      </CardContent>
                    </Card>

                    {/* GPU Utilization chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Activity className="h-4 w-4" />
                          {t("utilization")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RealtimeChart
                          data={history?.utilization || []}
                          max={100}
                          min={0}
                          unit="%"
                          color="hsl(142 71% 45%)"
                          label={t("utilization")}
                          height={130}
                        />
                      </CardContent>
                    </Card>

                    {/* Power Draw chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Zap className="h-4 w-4" />
                          {t("powerDraw")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RealtimeChart
                          data={history?.power || []}
                          min={0}
                          unit="W"
                          color="hsl(38 92% 50%)"
                          label={t("powerDraw")}
                          height={130}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}

            {/* Running Models card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <HardDrive className="h-4 w-4" />
                  {t("runningModels")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {server.runningModels.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {t("noModelsLoaded")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {server.runningModels.map((model) => {
                      const vramPct =
                        model.size > 0
                          ? Math.round((model.size_vram / model.size) * 100)
                          : 0;
                      return (
                        <div
                          key={model.name}
                          className="flex items-center gap-4 rounded-lg border p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="truncate text-sm font-medium">
                                {model.name}
                              </span>
                              <Badge variant="muted" className="ml-2 shrink-0">
                                {formatBytes(model.size_vram)} VRAM
                              </Badge>
                            </div>
                            <ProgressBar
                              value={vramPct}
                              max={100}
                              className="mt-1.5"
                            />
                            <div className="mt-1 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                              <span>
                                {t("totalSize")}: {formatBytes(model.size)}
                              </span>
                              <span>
                                {t("expiresAt")}:{" "}
                                {new Date(model.expires_at).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Compatibility card */}
            {server.modelCompatibility && server.modelCompatibility.length > 0 && (
              <ModelCompatibilityCard models={server.modelCompatibility} t={t} />
            )}
          </div>
        );
      })}
    </div>
  );
}
