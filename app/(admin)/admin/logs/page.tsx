"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";

interface LogEntry {
  id: string;
  serverId: string;
  server: { name: string };
  model: string;
  endpoint: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  statusCode: number;
  userId: string | null;
  ip: string | null;
  createdAt: string;
}

interface Server {
  id: string;
  name: string;
}

export default function LogsPage() {
  const t = useTranslations("admin.logs");
  const tc = useTranslations("common");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<Server[]>([]);
  const [filterServer, setFilterServer] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then(setServers);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filterServer) params.set("serverId", filterServer);
    if (filterModel) params.set("model", filterModel);
    if (filterStatus) params.set("status", filterStatus);

    try {
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, filterServer, filterModel, filterStatus]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = (format: "csv" | "json") => {
    const params = new URLSearchParams({ format });
    if (filterServer) params.set("serverId", filterServer);
    window.open(`/api/logs/export?${params}`, "_blank");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-[hsl(var(--accent))]"
          >
            {t("exportCsv")}
          </button>
          <button
            onClick={() => handleExport("json")}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-[hsl(var(--accent))]"
          >
            {t("exportJson")}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={filterServer}
          onChange={(e) => { setFilterServer(e.target.value); setPage(1); }}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">{t("filterByServer")}</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={filterModel}
          onChange={(e) => { setFilterModel(e.target.value); setPage(1); }}
          placeholder={t("filterByModel")}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">{t("filterByStatus")}</option>
          <option value="success">Success (2xx)</option>
          <option value="error">Error (4xx/5xx)</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-[hsl(var(--muted))]" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">{t("emptyDescription")}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-[hsl(var(--muted-foreground))]">
                  <th className="pb-2 font-medium">{t("timestamp")}</th>
                  <th className="pb-2 font-medium">{t("server")}</th>
                  <th className="pb-2 font-medium">{t("model")}</th>
                  <th className="pb-2 font-medium">{t("endpoint")}</th>
                  <th className="pb-2 font-medium">{t("promptTokens")}</th>
                  <th className="pb-2 font-medium">{t("completionTokens")}</th>
                  <th className="pb-2 font-medium">{t("latency")}</th>
                  <th className="pb-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2">{log.server.name}</td>
                    <td className="py-2">{log.model}</td>
                    <td className="py-2 font-mono text-xs">{log.endpoint}</td>
                    <td className="py-2">{log.promptTokens ?? "—"}</td>
                    <td className="py-2">{log.completionTokens ?? "—"}</td>
                    <td className="py-2">{log.latencyMs}ms</td>
                    <td className="py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          log.statusCode < 400
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">
              {total} total entries
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 py-1">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={logs.length < 50}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
