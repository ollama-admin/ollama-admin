import { Card } from "@/components/ui/card";

interface ModelEntry {
  model: string;
  count: number;
}

interface TopModelsChartProps {
  data: ModelEntry[];
  label: string;
  labelRequests: string;
}

function TopModelsChart({ data, label, labelRequests }: TopModelsChartProps) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="flex flex-col gap-3" role="img" aria-label={label}>
      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        {label}
      </p>

      {data.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No data yet</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.map((entry) => {
            const pct = Math.round((entry.count / max) * 100);
            const shortName =
              entry.model.length > 22 ? entry.model.slice(0, 20) + "…" : entry.model;
            return (
              <div key={entry.model} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="font-mono font-medium truncate" title={entry.model}>
                    {shortName}
                  </span>
                  <span className="text-[hsl(var(--muted-foreground))] tabular-nums ml-2 flex-shrink-0">
                    {entry.count} {labelRequests}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
                  <div
                    className="h-1.5 rounded-full bg-[hsl(var(--primary))] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                    aria-valuenow={entry.count}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    role="progressbar"
                    aria-label={entry.model}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export { TopModelsChart, type ModelEntry };
