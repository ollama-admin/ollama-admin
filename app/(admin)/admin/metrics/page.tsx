"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Activity,
  Clock,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface MetricsData {
  totalRequests: number;
  errorCount: number;
  errorRate: string;
  requestsByDay: Record<string, number>;
  tokensByDay: Record<string, number>;
  tokensByModel: Record<string, number>;
  avgLatencyByModel: Record<string, number>;
  topModels: Array<{ model: string; count: number }>;
  apiKeyUsage?: Array<{ id: string; name: string; requests: number; tokens: number }>;
}

/* ── Sparkline mini chart for stat cards ── */
function Sparkline({
  data,
  color,
  height = 32,
  width = 100,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={areaPoints}
        fill={color}
        opacity={0.1}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Interactive SVG bar chart with hover tooltip ── */
function BarChartInteractive({
  data,
  label,
  color = "hsl(210 80% 60%)",
  formatValue,
}: {
  data: Array<{ label: string; value: number }>;
  label: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(20, Math.min(44, 500 / data.length));
  const chartWidth = Math.max(400, data.length * (barWidth + 8) + 60);
  const chartHeight = 160;
  const padding = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  return (
    <div className="relative w-full overflow-x-auto" role="img" aria-label={label}>
      {/* Floating tooltip */}
      {hoveredIndex !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded border bg-[hsl(var(--card))] px-2 py-1 text-[11px] shadow-md"
          style={{
            left: `${((hoveredIndex + 0.5) / data.length) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-medium">{data[hoveredIndex].label}</p>
          <p className="tabular-nums text-[hsl(var(--muted-foreground))]">
            {formatValue ? formatValue(data[hoveredIndex].value) : data[hoveredIndex].value.toLocaleString()}
          </p>
        </div>
      )}

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ maxHeight: 200 }}>
        {/* Grid lines */}
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
                opacity={0.4}
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-[hsl(var(--muted-foreground))] text-[10px]"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + (i * innerWidth) / data.length + barWidth * 0.1;
          const h = (d.value / maxValue) * innerHeight;
          const y = padding.top + innerHeight - h;
          const isHovered = hoveredIndex === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Invisible larger hit area */}
              <rect
                x={padding.left + (i * innerWidth) / data.length}
                y={padding.top}
                width={innerWidth / data.length}
                height={innerHeight}
                fill="transparent"
              />
              <rect
                x={x}
                y={y}
                width={barWidth * 0.8}
                height={h}
                fill={color}
                rx={3}
                opacity={isHovered ? 1 : 0.75}
                className="transition-opacity duration-150"
              />
              {/* Value label */}
              {h > 16 && (
                <text
                  x={x + barWidth * 0.4}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-[hsl(var(--foreground))] text-[9px] font-medium"
                >
                  {formatValue ? formatValue(d.value) : d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
                </text>
              )}
              {/* X label */}
              <text
                x={x + barWidth * 0.4}
                y={chartHeight - padding.bottom + 16}
                textAnchor="middle"
                className="fill-[hsl(var(--muted-foreground))] text-[10px]"
              >
                {d.label.length > 5 ? d.label.slice(5, 10) : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Horizontal bar chart with hover state ── */
function RankedBarChart({
  data,
  label,
  color,
  formatValue,
}: {
  data: Array<{ label: string; value: number }>;
  label: string;
  color: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const fmt = formatValue || ((v: number) => v.toLocaleString());

  return (
    <div className="space-y-1" role="list" aria-label={label}>
      {data.map((d, i) => {
        const pct = (d.value / maxValue) * 100;
        return (
          <div
            key={d.label}
            className="group relative flex items-center gap-2 rounded px-2 py-0.5 transition-colors hover:bg-[hsl(var(--muted)/.5)]"
            role="listitem"
          >
            {/* Rank */}
            <span className="w-4 text-right text-xs font-bold text-[hsl(var(--muted-foreground))]">
              {i + 1}
            </span>
            {/* Name */}
            <span
              className="w-32 truncate text-sm"
              title={d.label}
            >
              {d.label}
            </span>
            {/* Bar */}
            <div className="flex-1">
              <div className="h-6 w-full overflow-hidden rounded bg-[hsl(var(--muted)/.3)]">
                <div
                  className="flex h-6 items-center rounded pl-2 text-[11px] font-medium text-white transition-all duration-300"
                  style={{
                    width: `${Math.max(pct, 4)}%`,
                    backgroundColor: color,
                    opacity: 0.65 + (pct / 100) * 0.35,
                  }}
                >
                  {pct > 20 && (
                    <span className="truncate drop-shadow-sm">
                      {fmt(d.value)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Value (outside bar for small bars) */}
            {pct <= 20 && (
              <span className="w-16 text-right font-mono text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                {fmt(d.value)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Stat card with sparkline ── */
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  iconColor,
  sparkData,
  sparkColor,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  subtext?: string;
  iconColor: string;
  sparkData?: number[];
  sparkColor?: string;
}) {
  return (
    <Card>
      <CardContent className="relative overflow-hidden py-2.5">
        {/* Sparkline background */}
        {sparkData && sparkData.length > 1 && (
          <div className="absolute bottom-0 right-2 opacity-50">
            <Sparkline
              data={sparkData}
              color={sparkColor || iconColor}
              width={64}
              height={28}
            />
          </div>
        )}
        <div className="relative">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in srgb, ${iconColor} 15%, transparent)` }}
            >
              <Icon className="h-4 w-4" style={{ color: iconColor }} />
            </div>
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {label}
            </span>
          </div>
          <p className="mt-1.5 truncate text-xl font-bold tabular-nums">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {subtext}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetricsPage() {
  const t = useTranslations("admin.metrics");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("7");

  const changeDays = (newDays: string) => {
    setLoading(true);
    setDays(newDays);
  };

  const fetchMetrics = () => {
    setLoading(true);
    fetch(`/api/metrics?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/metrics?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton variant="line" className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton variant="card" className="h-64" />
          <Skeleton variant="card" className="h-64" />
        </div>
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

  const tokensByDayData = Object.entries(data.tokensByDay || {}).map(
    ([day, tokens]) => ({ label: day, value: tokens })
  );

  const tokensByModelData = Object.entries(data.tokensByModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([model, tokens]) => ({ label: model, value: tokens }));

  const latencyData = Object.entries(data.avgLatencyByModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([model, ms]) => ({ label: model, value: ms }));

  const avgLatency =
    latencyData.length > 0
      ? Math.round(
          latencyData.reduce((s, d) => s + d.value, 0) / latencyData.length
        )
      : 0;

  const totalTokens = Object.values(data.tokensByModel).reduce(
    (s, v) => s + v,
    0
  );

  const sparkValues = requestsByDayData.map((d) => d.value);

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select
            value={days}
            onChange={(e) => changeDays(e.target.value)}
            className="w-auto"
            aria-label={t("dateRange")}
          >
            <option value="7">{t("last7days")}</option>
            <option value="30">{t("last30days")}</option>
            <option value="90">{t("last90days")}</option>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={Activity}
          label={t("totalRequests")}
          value={data.totalRequests.toLocaleString()}
          subtext={`${requestsByDayData.length} ${t("daysWithData")}`}
          iconColor="hsl(210 80% 60%)"
          sparkData={sparkValues}
          sparkColor="hsl(210 80% 60%)"
        />
        <StatCard
          icon={TrendingUp}
          label={t("topModel")}
          value={data.topModels[0]?.model || "-"}
          subtext={
            data.topModels[0]
              ? `${data.topModels[0].count} ${t("requests")}`
              : undefined
          }
          iconColor="hsl(170 70% 45%)"
        />
        <StatCard
          icon={Clock}
          label={t("avgLatency")}
          value={avgLatency > 0 ? `${avgLatency.toLocaleString()}ms` : "-"}
          subtext={
            latencyData.length > 0
              ? `${t("fastest")}: ${Math.min(...latencyData.map((d) => d.value)).toLocaleString()}ms`
              : undefined
          }
          iconColor="hsl(30 85% 55%)"
        />
        <StatCard
          icon={AlertTriangle}
          label={t("errorRate")}
          value={`${data.errorRate}%`}
          subtext={`${data.errorCount} ${t("errors")} / ${data.totalRequests}`}
          iconColor={
            parseFloat(data.errorRate) > 5
              ? "hsl(0 70% 55%)"
              : "hsl(145 60% 45%)"
          }
        />
      </div>

      {/* Charts row 1: Requests + Tokens over time */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("requestsOverTime")}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <BarChartInteractive
              data={requestsByDayData}
              label={t("requestsOverTime")}
              color="hsl(210 80% 60%)"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{t("tokensOverTime")}</CardTitle>
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                {t("total")}: <span className="font-bold tabular-nums text-[hsl(var(--foreground))]">{totalTokens.toLocaleString()}</span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <BarChartInteractive
              data={tokensByDayData}
              label={t("tokensOverTime")}
              color="hsl(170 70% 45%)"
              formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("tokensByModel")}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <RankedBarChart
              data={tokensByModelData}
              label={t("tokensByModel")}
              color="hsl(170 70% 45%)"
              formatValue={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("mostUsedModels")}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <RankedBarChart
              data={data.topModels.slice(0, 8).map((m) => ({
                label: m.model,
                value: m.count,
              }))}
              label={t("mostUsedModels")}
              color="hsl(280 65% 60%)"
            />
          </CardContent>
        </Card>
      </div>

      {/* Latency full width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("avgLatencyByModel")}</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <RankedBarChart
            data={latencyData}
            label={t("avgLatencyByModel")}
            color="hsl(30 85% 55%)"
            formatValue={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`
            }
          />
        </CardContent>
      </Card>

      {/* API Key usage */}
      {data.apiKeyUsage && data.apiKeyUsage.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("apiKeyUsage")}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <RankedBarChart
              data={data.apiKeyUsage.map((k) => ({
                label: k.name,
                value: k.requests,
              }))}
              label={t("apiKeyUsage")}
              color="hsl(45 90% 50%)"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
