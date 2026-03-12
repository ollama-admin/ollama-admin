"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RealtimeChart, type DataPoint } from "@/components/ui/realtime-chart";

interface HourBucket {
  hour: string;
  count: number;
}

interface RequestsChartProps {
  data: HourBucket[];
  label: string;
  labelNoData?: string;
}

function RequestsChart({ data, label, labelNoData }: RequestsChartProps) {
  const chartData: DataPoint[] = useMemo(
    () => data.map((d, i) => ({ time: i, value: d.count })),
    [data]
  );

  const totalRequests = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  const hourLabels = useMemo(() => {
    if (data.length === 0) return [];
    const first = data[0].hour;
    const last = data[data.length - 1].hour;
    return [first.slice(11, 13) + ":00", last.slice(11, 13) + ":00"];
  }, [data]);

  const isEmpty = data.length === 0 || totalRequests === 0;

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          {label}
        </p>
        {!isEmpty && hourLabels.length === 2 && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {hourLabels[0]} – {hourLabels[1]}
          </span>
        )}
      </div>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 className="h-10 w-10 text-[hsl(var(--muted-foreground)/0.5)]" />
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {labelNoData ?? "No requests yet"}
          </p>
        </div>
      ) : (
        <div className="min-h-[120px] flex-1">
          <RealtimeChart
            data={chartData}
            height={160}
            unit="req"
            label={label}
            color="hsl(var(--primary))"
            fillOpacity={0.12}
            className="h-full"
          />
        </div>
      )}
    </Card>
  );
}

export { RequestsChart };
