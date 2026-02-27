import { cn } from "@/lib/cn";

/** Determinate progress bar for model pulls and long operations. */
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

function ProgressBar({ value, max = 100, label, className }: ProgressBarProps) {
  const percentage = Math.min(100, Math.round((value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>{label}</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressBar, type ProgressBarProps };
