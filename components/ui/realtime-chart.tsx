import { cn } from "@/lib/cn";

interface DataPoint {
  time: number;
  value: number;
}

interface RealtimeChartProps {
  data: DataPoint[];
  maxPoints?: number;
  height?: number;
  min?: number;
  max?: number;
  unit?: string;
  color?: string;
  fillOpacity?: number;
  className?: string;
  label: string;
}

function RealtimeChart({
  data,
  height = 120,
  min = 0,
  max: maxProp,
  unit = "",
  color = "hsl(var(--primary))",
  fillOpacity = 0.15,
  className,
  label,
}: RealtimeChartProps) {
  const width = 400;
  const padding = { top: 8, right: 8, bottom: 20, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxVal = maxProp ?? Math.max(...data.map((d) => d.value), 1);
  const minVal = min;
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    padding.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const toY = (v: number) =>
    padding.top + innerH - ((v - minVal) / range) * innerH;

  const linePath =
    data.length > 1
      ? data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(" ")
      : "";

  const areaPath =
    data.length > 1
      ? `${linePath} L${toX(data.length - 1).toFixed(1)},${(padding.top + innerH).toFixed(1)} L${toX(0).toFixed(1)},${(padding.top + innerH).toFixed(1)} Z`
      : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const lastValue = data.length > 0 ? data[data.length - 1].value : 0;

  return (
    <div className={cn("w-full", className)} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {gridLines.map((pct) => {
          const y = padding.top + innerH * (1 - pct);
          const val = minVal + range * pct;
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="hsl(var(--border))"
                strokeDasharray="3"
                strokeWidth={0.5}
              />
              <text
                x={padding.left - 4}
                y={y + 3}
                textAnchor="end"
                className="fill-[hsl(var(--muted-foreground))] text-[8px]"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}
                {unit && pct === 1 ? unit : ""}
              </text>
            </g>
          );
        })}

        {data.length > 1 && (
          <>
            <path d={areaPath} fill={color} opacity={fillOpacity} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}

        {data.length === 1 && (
          <circle cx={toX(0)} cy={toY(data[0].value)} r={3} fill={color} />
        )}

        {data.length > 0 && (
          <circle
            cx={toX(data.length - 1)}
            cy={toY(lastValue)}
            r={3}
            fill={color}
            stroke="hsl(var(--background))"
            strokeWidth={1.5}
          />
        )}

        {data.length < 2 && (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            className="fill-[hsl(var(--muted-foreground))] text-[10px]"
          >
            Collecting data...
          </text>
        )}
      </svg>
    </div>
  );
}

export { RealtimeChart, type DataPoint, type RealtimeChartProps };
