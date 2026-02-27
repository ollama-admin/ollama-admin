"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface Server {
  id: string;
  name: string;
  url: string;
  active: boolean;
}

interface HealthStatus {
  status: "online" | "offline";
  version?: string;
}

interface LogEntry {
  id: string;
  model: string;
  endpoint: string;
  latencyMs: number;
  statusCode: number;
  createdAt: string;
  server: { name: string };
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const [servers, setServers] = useState<Server[]>([]);
  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [modelCount, setModelCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then(async (data: Server[]) => {
        setServers(data);
        setLoading(false);
        for (const s of data) {
          try {
            const res = await fetch(`/api/servers/${s.id}/health`);
            const h = await res.json();
            setHealth((prev) => ({ ...prev, [s.id]: h }));
          } catch {
            setHealth((prev) => ({ ...prev, [s.id]: { status: "offline" } }));
          }
        }
        if (data.length > 0) {
          try {
            const modelsRes = await fetch(`/api/admin/models?serverId=${data[0].id}`);
            const modelsData = await modelsRes.json();
            setModelCount(modelsData.models?.length || 0);
          } catch {
            // server may be offline
          }
        }
      })
      .catch(() => setLoading(false));

    fetch("/api/logs?limit=10")
      .then((r) => r.json())
      .then((data) => setRecentLogs(data.logs || []));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (servers.length === 0) {
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/servers">
          <Card interactive>
            <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{t("servers")}</h3>
            <p className="mt-1 text-2xl font-bold">
              {Object.values(health).filter((h) => h.status === "online").length}/{servers.length}
            </p>
            <div className="mt-2 flex gap-1">
              {servers.map((s) => (
                <span
                  key={s.id}
                  className={`h-2 w-2 rounded-full ${
                    health[s.id]?.status === "online"
                      ? "bg-[hsl(var(--success))]"
                      : "bg-[hsl(var(--destructive))]"
                  }`}
                  title={s.name}
                />
              ))}
            </div>
          </Card>
        </Link>

        <Link href="/admin/models">
          <Card interactive>
            <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{t("models")}</h3>
            <p className="mt-1 text-2xl font-bold">{modelCount}</p>
          </Card>
        </Link>

        <Card>
          <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{t("quickActions")}</h3>
          <div className="mt-2 space-y-2">
            <Link href="/chat">
              <Button variant="secondary" className="w-full justify-start">
                {t("newChat")}
              </Button>
            </Link>
            <Link href="/discover">
              <Button variant="secondary" className="w-full justify-start">
                {t("pullModel")}
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">{t("recentActivity")}</h2>
        {recentLogs.length === 0 ? (
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            No recent activity
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <Badge variant={log.statusCode < 400 ? "success" : "destructive"}>
                    {log.statusCode}
                  </Badge>
                  <span className="font-medium">{log.model}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{log.endpoint}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{log.latencyMs}ms</span>
                  <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
