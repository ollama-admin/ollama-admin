"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then(async (data: Server[]) => {
        setServers(data);
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
      });

    fetch("/api/logs?limit=10")
      .then((r) => r.json())
      .then((data) => setRecentLogs(data.logs || []));
  }, []);

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-5xl">◫</div>
        <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">{t("emptyDescription")}</p>
        <Link
          href="/admin/servers"
          className="mt-4 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
        >
          {t("emptyAction")}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Servers card */}
        <Link href="/admin/servers" className="rounded-lg border p-4 hover:bg-[hsl(var(--accent))]">
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
        </Link>

        {/* Models card */}
        <Link href="/admin/models" className="rounded-lg border p-4 hover:bg-[hsl(var(--accent))]">
          <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{t("models")}</h3>
          <p className="mt-1 text-2xl font-bold">{modelCount}</p>
        </Link>

        {/* Quick actions */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{t("quickActions")}</h3>
          <div className="mt-2 space-y-2">
            <Link
              href="/chat"
              className="block rounded-md border px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
            >
              {t("newChat")}
            </Link>
            <Link
              href="/discover"
              className="block rounded-md border px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
            >
              {t("pullModel")}
            </Link>
          </div>
        </div>
      </div>

      {/* Recent activity */}
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
                  <span
                    className={`h-2 w-2 rounded-full ${
                      log.statusCode < 400
                        ? "bg-[hsl(var(--success))]"
                        : "bg-[hsl(var(--destructive))]"
                    }`}
                  />
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
