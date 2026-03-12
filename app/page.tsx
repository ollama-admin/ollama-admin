"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, MessageSquarePlus, Download } from "lucide-react";
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
          <Link href="/admin/servers">
            <Button>{t("emptyAction")}</Button>
          </Link>
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
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* KPI strip */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label={t("servers")}
          value={`${kpis.serversOnline}/${kpis.serversTotal}`}
          subLabel={kpis.serversOnline === kpis.serversTotal ? t("online") : t("offline")}
          href="/admin/servers"
        />
        <KpiCard
          label={t("requestsToday")}
          value={kpis.requestsToday.toLocaleString()}
          delta={requestsDelta}
          subLabel={t("vsYesterday")}
          href="/admin/logs"
        />
        <KpiCard
          label={t("tokensToday")}
          value={formatTokens(kpis.tokensToday)}
          href="/admin/metrics"
        />
        <KpiCard
          label={t("avgLatency")}
          value={`${kpis.avgLatencyMs}ms`}
          subLabel={`${t("p95Latency")}: ${kpis.p95LatencyMs}ms`}
          href="/admin/metrics"
        />
        <KpiCard
          label={t("errorRate")}
          value={`${kpis.errorRate}%`}
          subLabel={`${kpis.errorCount} errors`}
          href="/admin/logs"
        />
      </div>

      {/* Main bento: chart + server status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RequestsChart data={requestsPerHour} label={t("requestsLast24h")} />
        </div>
        <ServerStatusPanel
          servers={servers}
          labelOnline={t("online")}
          labelOffline={t("offline")}
          labelVram={t("vram")}
          labelModels={t("activeModels")}
        />
      </div>

      {/* Second bento: top models + running models */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopModelsChart
          data={topModels}
          label={t("topModelsToday")}
          labelRequests={t("requests")}
        />
        <RunningModelsPanel
          models={runningModels}
          label={t("runningModels")}
          labelUnload={t("unload")}
          labelExpires={t("expires")}
          labelVram={t("vram")}
        />
      </div>

      {/* Activity feed + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed
            initialLogs={initialLogs}
            label={t("recentActivity")}
            labelNoActivity={t("noActivity")}
          />
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/chat">
            <Button variant="secondary" className="w-full justify-start gap-2">
              <MessageSquarePlus className="h-4 w-4" />
              {t("newChat")}
            </Button>
          </Link>
          <Link href="/discover">
            <Button variant="secondary" className="w-full justify-start gap-2">
              <Download className="h-4 w-4" />
              {t("pullModel")}
            </Button>
          </Link>
          <Link href="/admin/servers">
            <Button variant="secondary" className="w-full justify-start gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {t("addServer")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
