"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Activity,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface MetricsData {
  totalRequests: number;
  errorCount: number;
  errorRate: string;
  requestsByDay: Record<string, number>;
  tokensByModel: Record<string, number>;
  avgLatencyByModel: Record<string, number>;
  topModels: Array<{ model: string; count: number }>;
}

function BarChartSVG({
  data,
  label,
  color = "hsl(var(--primary))",
}: {
  data: Array<{ label: string; value: number }>;
  label: string;
  color?: string;
}) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(20, Math.min(60, 500 / data.length));
  const chartWidth = Math.max(400, data.length * (barWidth + 8) + 60);
  const chartHeight = 200;
  const padding = { top: 10, right: 20, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="min-w-[400px]"
      >
        {data.map((d, i) => {
          const x =
            padding.left + (i * innerWidth) / data.length + barWidth * 0.1;
          const h = (d.value / maxValue) * innerHeight;
          const y = padding.top + innerHeight - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth * 0.8}
                height={h}
                fill={color}
                rx={2}
              >
                <title>
                  {d.label}: {d.value.toLocaleString()}
                </title>
              </rect>
              <text
                x={x + barWidth * 0.4}
                y={chartHeight - padding.bottom + 14}
                textAnchor="middle"
                className="fill-[hsl(var(--muted-foreground))] text-[9px]"
              >
                {d.label.length > 8 ? d.label.slice(-5) : d.label}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padding.top + innerHeight * (1 - pct);
          const val = Math.round(maxValue * pct);
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="hsl(var(--border))"
                strokeDasharray="4"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[hsl(var(--muted-foreground))] text-[9px]"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HorizontalBarChart({
  data,
  label,
}: {
  data: Array<{ label: string; value: number; unit?: string }>;
  label: string;
}) {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2" role="list" aria-label={label}>
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2" role="listitem">
          <span className="w-28 truncate text-xs" title={d.label}>
            {d.label}
          </span>
          <div className="flex-1">
            <div className="h-5 w-full rounded bg-[hsl(var(--muted))]">
              <div
                className="h-5 rounded bg-[hsl(var(--primary))] transition-all"
                style={{ width: `${(d.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
          <span className="w-20 text-right text-xs text-[hsl(var(--muted-foreground))]">
            {d.value.toLocaleString()}
            {d.unit ? ` ${d.unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MetricsPage() {
  const t = useTranslations("admin.metrics");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("7");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton variant="line" className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    );
  }

  if (!data || data.totalRequests === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <EmptyState
          icon={BarChart3}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="mt-12"
        />
      </div>
    );
  }

  const requestsByDayData = Object.entries(data.requestsByDay).map(
    ([day, count]) => ({ label: day, value: count })
  );

  const tokensByModelData = Object.entries(data.tokensByModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([model, tokens]) => ({ label: model, value: tokens }));

  const latencyData = Object.entries(data.avgLatencyByModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([model, ms]) => ({ label: model, value: ms, unit: "ms" }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-auto"
          aria-label={t("dateRange")}
        >
          <option value="7">{t("last7days")}</option>
          <option value="30">{t("last30days")}</option>
          <option value="90">{t("last90days")}</option>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("totalRequests")}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {data.totalRequests.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("topModel")}
              </span>
            </div>
            <p className="mt-1 truncate text-lg font-bold">
              {data.topModels[0]?.model || "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("avgLatency")}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {latencyData.length > 0
                ? `${Math.round(latencyData.reduce((s, d) => s + d.value, 0) / latencyData.length)}ms`
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${parseFloat(data.errorRate) > 5 ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--primary))]"}`}
              />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("errorRate")}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold">{data.errorRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("requestsOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartSVG
              data={requestsByDayData}
              label={t("requestsOverTime")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("tokensByModel")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={tokensByModelData}
              label={t("tokensByModel")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("avgLatencyByModel")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={latencyData}
              label={t("avgLatencyByModel")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("mostUsedModels")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={data.topModels.map((m) => ({
                label: m.model,
                value: m.count,
              }))}
              label={t("mostUsedModels")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
