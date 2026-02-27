import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Styled select dropdown matching the Input visual style. */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1 block text-sm font-medium">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[hsl(var(--destructive))]",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error && selectId ? `${selectId}-error` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={selectId ? `${selectId}-error` : undefined} className="mt-1 text-xs text-[hsl(var(--destructive))]">{error}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select, type SelectProps };
