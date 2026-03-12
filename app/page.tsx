"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, MessageSquarePlus, Download, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RequestsChart } from "@/components/dashboard/requests-chart";
import { ServerStatusPanel } from "@/components/dashboard/server-status-panel";
import { TopModelsChart } from "@/components/dashboard/top-models-chart";
import { RunningModelsPanel } from "@/components/dashboard/running-models-panel";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import type { ServerStatus } from "@/components/dashboard/server-status-panel";
import type { RunningModel } from "@/components/dashboard/running-models-panel";
import type { LogEntry } from "@/components/dashboard/activity-feed";

interface DashboardData {
  kpis: {
    serversOnline: number;
    serversTotal: number;
    requestsToday: number;
    requestsYesterday: number;
    tokensToday: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    errorCount: number;
    errorRate: string;
  };
  requestsPerHour: { hour: string; count: number }[];
  topModels: { model: string; count: number }[];
  servers: ServerStatus[];
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function calcDelta(today: number, yesterday: number) {
  if (yesterday === 0) return undefined;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton variant="card" className="h-48" />
        </div>
        <Skeleton variant="card" className="h-48" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton variant="card" className="h-40" />
        <Skeleton variant="card" className="h-40" />
      </div>
      <Skeleton variant="card" className="h-48" />
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [data, setData] = useState<DashboardData | null>(null);
  const [initialLogs, setInitialLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [noServers, setNoServers] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/logs?limit=8").then((r) => r.json()),
    ])
      .then(([dashboard, logsData]) => {
        if (dashboard.kpis?.serversTotal === 0) {
          setNoServers(true);
        } else {
          setData(dashboard);
          setInitialLogs(logsData.logs ?? []);
        }
      })
      .catch(() => setNoServers(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => {
      fetch("/api/dashboard")
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [data]);

  if (loading) return <DashboardSkeleton />;

  if (noServers) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          isAdmin ? (
            <Link href="/admin/servers">
              <Button>{t("emptyAction")}</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  if (!data) return null;

  const { kpis, requestsPerHour, topModels, servers } = data;

  const requestsDelta = calcDelta(kpis.requestsToday, kpis.requestsYesterday);

  const runningModels: RunningModel[] = servers.flatMap((s) =>
    s.runningModels.map((m) => ({
      ...m,
      serverName: s.name,
      serverId: s.id,
    }))
  );

  return (
    <div className="space-y-4 p-6">
      {/* Header with title, live indicator, and quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("live")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/chat">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("newChat")}</span>
            </Button>
          </Link>
          {isAdmin && (
            <>
              <Link href="/discover">
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("pullModel")}</span>
                </Button>
              </Link>
              <Link href="/admin/servers">
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Server className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("addServer")}</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label={t("servers")}
          value={`${kpis.serversOnline}/${kpis.serversTotal}`}
          subLabel={kpis.serversOnline === kpis.serversTotal ? t("online") : t("offline")}
          href={isAdmin ? "/admin/servers" : undefined}
        />
        <KpiCard
          label={t("requestsToday")}
          value={kpis.requestsToday.toLocaleString()}
          delta={requestsDelta}
          subLabel={t("vsYesterday")}
          href={isAdmin ? "/admin/logs" : undefined}
        />
        <KpiCard
          label={t("tokensToday")}
          value={formatTokens(kpis.tokensToday)}
          href={isAdmin ? "/admin/metrics" : undefined}
        />
        <KpiCard
          label={t("avgLatency")}
          value={`${kpis.avgLatencyMs}ms`}
          subLabel={`${t("p95Latency")}: ${kpis.p95LatencyMs}ms`}
          href={isAdmin ? "/admin/metrics" : undefined}
        />
        <KpiCard
          label={t("errorRate")}
          value={`${kpis.errorRate}%`}
          subLabel={`${kpis.errorCount} ${t("errors")}`}
          href={isAdmin ? "/admin/logs" : undefined}
        />
      </div>

      {/* Main bento: chart + server status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RequestsChart data={requestsPerHour} label={t("requestsLast24h")} labelNoData={t("noRequestsYet")} />
        <ServerStatusPanel
          servers={servers}
          labelOnline={t("online")}
          labelOffline={t("offline")}
          labelVram={t("vram")}
          labelModels={t("activeModels")}
          labelGpuDetails={t("gpuDetails")}
        />
      </div>

      {/* Second bento: top models + running models */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopModelsChart
          data={topModels}
          label={t("topModelsToday")}
          labelRequests={t("requests")}
          labelNoData={t("noData")}
        />
        <RunningModelsPanel
          models={runningModels}
          label={t("runningModels")}
          labelUnload={t("unload")}
          labelExpires={t("expires")}
          labelVram={t("vram")}
          labelNoModels={t("noModelsInVram")}
        />
      </div>

      {/* Activity feed */}
      <ActivityFeed
        initialLogs={initialLogs}
        label={t("recentActivity")}
        labelNoActivity={t("noActivity")}
      />
    </div>
  );
}
