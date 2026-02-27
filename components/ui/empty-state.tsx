import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { type LucideIcon } from "lucide-react";

/** Standardized empty state with icon, title, description, and optional CTA. */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <Icon className="h-12 w-12 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      {description && (
        <p className="mt-2 max-w-sm text-[hsl(var(--muted-foreground))]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { EmptyState, type EmptyStateProps };
