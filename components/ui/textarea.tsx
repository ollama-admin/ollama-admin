import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Textarea with optional label, error, and character counter. */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, showCount, maxLength, value, id, ...props }, ref) => {
    const textareaId = id || props.name;
    const charCount = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="mb-1 block text-sm font-medium">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          maxLength={maxLength}
          className={cn(
            "flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[hsl(var(--destructive))]",
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        <div className="flex justify-between">
          {error && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{error}</p>
          )}
          {showCount && maxLength && (
            <p className="mt-1 ml-auto text-xs text-[hsl(var(--muted-foreground))]">
              {charCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea, type TextareaProps };
