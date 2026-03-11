import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface KpiCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  delta?: number;
  href?: string;
  className?: string;
}

function KpiCard({ label, value, subLabel, delta, href, className }: KpiCardProps) {
  const deltaSign = delta === undefined ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  const content = (
    <Card interactive={!!href} className={cn("flex flex-col gap-1", className)}>
      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        {label}
      </p>
      <p className="font-mono text-3xl font-bold tabular-nums leading-none">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {deltaSign && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              deltaSign === "up" && "text-[hsl(var(--success))]",
              deltaSign === "down" && "text-[hsl(var(--destructive))]",
              deltaSign === "flat" && "text-[hsl(var(--muted-foreground))]"
            )}
          >
            {deltaSign === "up" && <TrendingUp className="h-3 w-3" />}
            {deltaSign === "down" && <TrendingDown className="h-3 w-3" />}
            {deltaSign === "flat" && <Minus className="h-3 w-3" />}
            {delta !== undefined && Math.abs(delta) > 0 ? `${delta > 0 ? "+" : ""}${delta}%` : "—"}
          </span>
        )}
        {subLabel && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{subLabel}</span>
        )}
      </div>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export { KpiCard, type KpiCardProps };
