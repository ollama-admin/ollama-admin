"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

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
  const { toast } = useToast();
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
    toast("Export downloaded", "success");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport("csv")}>
            {t("exportCsv")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport("json")}>
            {t("exportJson")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Select
          value={filterServer}
          onChange={(e) => { setFilterServer(e.target.value); setPage(1); }}
          className="w-auto"
        >
          <option value="">{t("filterByServer")}</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Input
          value={filterModel}
          onChange={(e) => { setFilterModel(e.target.value); setPage(1); }}
          placeholder={t("filterByModel")}
          className="w-auto"
        />
        <Select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="w-auto"
        >
          <option value="">{t("filterByStatus")}</option>
          <option value="success">Success (2xx)</option>
          <option value="error">Error (4xx/5xx)</option>
        </Select>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="row" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <div className="mt-6">
            <Table caption="API request logs">
              <TableHeader>
                <tr>
                  <TableHead>{t("timestamp")}</TableHead>
                  <TableHead>{t("server")}</TableHead>
                  <TableHead>{t("model")}</TableHead>
                  <TableHead>{t("endpoint")}</TableHead>
                  <TableHead>{t("promptTokens")}</TableHead>
                  <TableHead>{t("completionTokens")}</TableHead>
                  <TableHead>{t("latency")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.server.name}</TableCell>
                    <TableCell>{log.model}</TableCell>
                    <TableCell className="font-mono text-xs">{log.endpoint}</TableCell>
                    <TableCell>{log.promptTokens ?? "—"}</TableCell>
                    <TableCell>{log.completionTokens ?? "—"}</TableCell>
                    <TableCell>{log.latencyMs}ms</TableCell>
                    <TableCell>
                      <Badge variant={log.statusCode < 400 ? "success" : "destructive"}>
                        {log.statusCode}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">
              {total} total entries
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-2">Page {page}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={logs.length < 50}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
