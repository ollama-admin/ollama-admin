import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, ...props }, ref) => {
    const switchId = id || props.name;
    return (
      <label
        htmlFor={switchId}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2.5",
          props.disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <span className="relative inline-flex">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <span className="h-5 w-9 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] transition-colors duration-200 peer-checked:border-[hsl(var(--primary))] peer-checked:bg-[hsl(var(--primary))] peer-focus-visible:ring-2 peer-focus-visible:ring-[hsl(var(--ring))] peer-focus-visible:ring-offset-2" />
          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4" />
        </span>
        {label && <span className="text-sm font-medium select-none">{label}</span>}
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch, type SwitchProps };
