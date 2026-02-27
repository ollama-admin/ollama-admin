import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Inline status indicator / tag. */
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "destructive" | "warning" | "muted";
}

const variantStyles: Record<string, string> = {
  default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  success: "bg-[hsl(var(--success))] text-white",
  destructive: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
  warning: "bg-yellow-500 text-white dark:bg-yellow-600",
  muted: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, type BadgeProps };
