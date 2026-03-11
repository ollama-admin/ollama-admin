"use client";

import { useTranslations } from "next-intl";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ClipboardList,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Activity,
  AlertTriangle,
  Clock,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
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

interface ServerItem {
  id: string;
  name: string;
}

function formatLatency(ms: number) {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function LatencyBadge({ ms }: { ms: number }) {
  const level =
    ms < 1000 ? "success" : ms < 5000 ? "warning" : "destructive";
  return (
    <Badge variant={level} className="font-mono tabular-nums">
      {formatLatency(ms)}
    </Badge>
  );
}

function LogDetailPanel({ log }: { log: LogEntry }) {
  const t = useTranslations("admin.logs");
  const totalTokens =
    (log.promptTokens || 0) + (log.completionTokens || 0);
  return (
    <tr>
      <td
        colSpan={8}
        className="border-b bg-[hsl(var(--muted)/.3)] px-4 py-3"
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("server")}
            </span>
            <p className="font-medium">{log.server.name}</p>
          </div>
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("model")}
            </span>
            <p className="font-mono font-medium">{log.model}</p>
          </div>
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("endpoint")}
            </span>
            <p className="font-mono">{log.endpoint}</p>
          </div>
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("status")}
            </span>
            <p>
              <Badge
                variant={log.statusCode < 400 ? "success" : "destructive"}
              >
                {log.statusCode}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("promptTokens")}
            </span>
            <p className="font-mono tabular-nums">
              {log.promptTokens?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("completionTokens")}
            </span>
            <p className="font-mono tabular-nums">
              {log.completionTokens?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("totalTokens")}
            </span>
            <p className="font-mono tabular-nums">
              {totalTokens > 0 ? totalTokens.toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("latency")}
            </span>
            <p>
              <LatencyBadge ms={log.latencyMs} />
            </p>
          </div>
          {log.userId && (
            <div>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                User ID
              </span>
              <p className="font-mono text-xs">{log.userId}</p>
            </div>
          )}
          {log.ip && (
            <div>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                IP
              </span>
              <p className="font-mono text-xs">{log.ip}</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function LogsPage() {
  const t = useTranslations("admin.logs");
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Search & filters
  const [search, setSearch] = useState("");
  const [filterServer, setFilterServer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const hasFilters = filterServer || filterStatus || dateFrom || dateTo;
  const totalPages = Math.ceil(total / 50);

  useEffect(() => {
    fetch("/api/servers?all=true")
      .then((r) => r.json())
      .then(setServers);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("model", search);
    if (filterServer) params.set("serverId", filterServer);
    if (filterStatus) params.set("status", filterStatus);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    try {
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterServer, filterStatus, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  const clearAll = () => {
    setSearch("");
    setFilterServer("");
    setFilterStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleExport = (format: "csv" | "json") => {
    const params = new URLSearchParams({ format });
    if (filterServer) params.set("serverId", filterServer);
    window.open(`/api/logs/export?${params}`, "_blank");
    toast("Export downloaded", "success");
  };

  // Quick stats from current page data
  const pageStats = {
    avgLatency:
      logs.length > 0
        ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / logs.length)
        : 0,
    errorCount: logs.filter((l) => l.statusCode >= 400).length,
    totalTokens: logs.reduce(
      (s, l) => s + (l.promptTokens || 0) + (l.completionTokens || 0),
      0
    ),
  };

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchLogs} aria-label={t("refresh")}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport("csv")}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport("json")}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full rounded-lg border bg-[hsl(var(--background))] pl-10 pr-4 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        />
        {search && (
          <button
            onClick={() => { setSearch(""); setPage(1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Advanced filters toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
          />
          {t("advancedFilters")}
        </button>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))] hover:underline"
          >
            <X className="h-3 w-3" />
            {t("clearFilters")}
          </button>
        )}
      </div>

      {/* Collapsible filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label={t("server")}
              value={filterServer}
              onChange={(e) => { setFilterServer(e.target.value); setPage(1); }}
            >
              <option value="">{t("allServers")}</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select
              label={t("status")}
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            >
              <option value="">{t("allStatuses")}</option>
              <option value="success">Success (2xx)</option>
              <option value="error">Error (4xx/5xx)</option>
            </Select>
            <Input
              type="date"
              label={t("dateFrom")}
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <Input
              type="date"
              label={t("dateTo")}
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
        </Card>
      )}

      {/* Quick stats */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)]">
                <Activity className="h-4 w-4 text-[hsl(var(--primary))]" />
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("totalEntries", { count: total })}</p>
                <p className="text-lg font-bold tabular-nums">{total.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(30_85%_55%/.1)]">
                <Clock className="h-4 w-4 text-[hsl(30_85%_55%)]" />
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("avgLatencyPage")}</p>
                <p className="text-lg font-bold tabular-nums">{formatLatency(pageStats.avgLatency)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${pageStats.errorCount > 0 ? "bg-[hsl(var(--destructive)/.1)]" : "bg-[hsl(var(--success)/.1)]"}`}>
                <AlertTriangle className={`h-4 w-4 ${pageStats.errorCount > 0 ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--success))]"}`} />
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("errorsOnPage")}</p>
                <p className="text-lg font-bold tabular-nums">{pageStats.errorCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(170_70%_45%/.1)]">
                <Server className="h-4 w-4 text-[hsl(170_70%_45%)]" />
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("tokensOnPage")}</p>
                <p className="text-lg font-bold tabular-nums">{pageStats.totalTokens.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
          <Table caption="API request logs">
            <TableHeader>
              <tr>
                <TableHead className="w-8" />
                <TableHead className="whitespace-nowrap">{t("timestamp")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("server")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("model")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("endpoint")}</TableHead>
                <TableHead className="whitespace-nowrap text-right">{t("totalTokens")}</TableHead>
                <TableHead className="whitespace-nowrap text-right">{t("latency")}</TableHead>
                <TableHead className="whitespace-nowrap text-center">{t("status")}</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const totalTok = (log.promptTokens || 0) + (log.completionTokens || 0);
                return (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <TableCell className="w-8 pr-0">
                        <ChevronDown
                          className={`h-3 w-3 text-[hsl(var(--muted-foreground))] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-[hsl(var(--muted-foreground))]">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{log.server.name}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs" title={log.model}>
                        {log.model}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-[hsl(var(--muted-foreground))]">
                        {log.endpoint}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular-nums">
                        {totalTok > 0 ? totalTok.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <LatencyBadge ms={log.latencyMs} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge
                          variant={log.statusCode < 400 ? "success" : "destructive"}
                        >
                          {log.statusCode}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {isExpanded && <LogDetailPanel log={log} />}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">
              {t("totalEntries", { count: total })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label={t("previous")}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("previous")}</span>
              </Button>
              <span className="min-w-[80px] text-center text-[hsl(var(--muted-foreground))]">
                {t("pageOf", { page, total: totalPages || 1 })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={logs.length < 50}
                aria-label={t("next")}
              >
                <span className="hidden sm:inline">{t("next")}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
