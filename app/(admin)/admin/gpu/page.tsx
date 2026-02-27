"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Cpu, HardDrive, Thermometer, Zap, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

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
}

interface ServerGpuData {
  serverId: string;
  serverName: string;
  runningModels: RunningModel[];
  gpuInfo: GpuInfo[] | null;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function GpuPage() {
  const t = useTranslations("admin.gpu");
  const [data, setData] = useState<ServerGpuData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/gpu");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton variant="line" className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="card" className="h-48" />
          ))}
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

  const hasAnyData = data.some(
    (s) => s.runningModels.length > 0 || s.gpuInfo
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-1 h-4 w-4" />
          {t("refresh")}
        </Button>
      </div>

      {!hasAnyData && (
        <EmptyState
          icon={Zap}
          title={t("noModelsLoaded")}
          description={t("noModelsLoadedDescription")}
          className="mt-8"
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {data.map((server) => (
          <Card key={server.serverId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                {server.serverName}
                {server.error && (
                  <Badge variant="destructive">{t("offline")}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {server.error && (
                <p className="text-sm text-[hsl(var(--destructive))]">
                  {server.error}
                </p>
              )}

              {server.runningModels.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    {t("runningModels")}
                  </h3>
                  <div className="space-y-3">
                    {server.runningModels.map((model) => {
                      const vramPct =
                        model.size > 0
                          ? Math.round((model.size_vram / model.size) * 100)
                          : 0;
                      return (
                        <div key={model.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-[hsl(var(--muted-foreground))]">
                              {formatBytes(model.size_vram)} VRAM
                            </span>
                          </div>
                          <ProgressBar
                            value={vramPct}
                            max={100}
                            label={`${vramPct}% in VRAM`}
                          />
                          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                            <HardDrive className="h-3 w-3" />
                            {t("totalSize")}: {formatBytes(model.size)}
                            <span className="ml-auto">
                              {t("expiresAt")}:{" "}
                              {new Date(model.expires_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {server.runningModels.length === 0 && !server.error && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("noModelsLoaded")}
                </p>
              )}

              {server.gpuInfo && server.gpuInfo.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    {t("gpuHardware")}
                  </h3>
                  <div className="space-y-3">
                    {server.gpuInfo.map((gpu, i) => {
                      const memPct =
                        gpu.memoryTotal > 0
                          ? Math.round(
                              (gpu.memoryUsed / gpu.memoryTotal) * 100
                            )
                          : 0;
                      return (
                        <div key={i} className="space-y-2 rounded border p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {gpu.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <Thermometer className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                              <span
                                className={`text-sm ${gpu.temperature > 80 ? "text-[hsl(var(--destructive))]" : ""}`}
                              >
                                {gpu.temperature}°C
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                              <span>{t("vramUsage")}</span>
                              <span>
                                {formatBytes(gpu.memoryUsed)} /{" "}
                                {formatBytes(gpu.memoryTotal)}
                              </span>
                            </div>
                            <ProgressBar
                              value={memPct}
                              max={100}
                              label={`VRAM ${memPct}%`}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                              <span>{t("utilization")}</span>
                              <span>{gpu.utilization}%</span>
                            </div>
                            <ProgressBar
                              value={gpu.utilization}
                              max={100}
                              label={`GPU ${gpu.utilization}%`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
