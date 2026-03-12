"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { RealtimeChart, type DataPoint } from "@/components/ui/realtime-chart";

interface HourBucket {
  hour: string;
  count: number;
}

interface RequestsChartProps {
  data: HourBucket[];
  label: string;
}

function RequestsChart({ data, label }: RequestsChartProps) {
  const chartData: DataPoint[] = useMemo(
    () => data.map((d, i) => ({ time: i, value: d.count })),
    [data]
  );

  const hourLabels = useMemo(() => {
    if (data.length === 0) return [];
    const first = data[0].hour;
    const last = data[data.length - 1].hour;
    return [first.slice(11, 13) + ":00", last.slice(11, 13) + ":00"];
  }, [data]);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          {label}
        </p>
        {hourLabels.length === 2 && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {hourLabels[0]} – {hourLabels[1]}
          </span>
        )}
      </div>
      <RealtimeChart
        data={chartData}
        height={140}
        unit="req"
        label={label}
        color="hsl(var(--primary))"
        fillOpacity={0.12}
      />
    </Card>
  );
}

export { RequestsChart };
