import { cn } from "@/lib/cn";

/** Skeleton placeholder for loading states. */
interface SkeletonProps {
  className?: string;
  variant?: "line" | "card" | "row" | "circle";
}

const variantStyles: Record<string, string> = {
  line: "h-4 w-full rounded",
  card: "h-32 w-full rounded-lg",
  row: "h-12 w-full rounded",
  circle: "h-10 w-10 rounded-full",
};

function Skeleton({ className, variant = "line" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[hsl(var(--muted))]",
        variantStyles[variant],
        className
      )}
    />
  );
}

export { Skeleton, type SkeletonProps };
