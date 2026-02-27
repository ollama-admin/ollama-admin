"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-[hsl(var(--success))] bg-[hsl(var(--card))]",
  error: "border-[hsl(var(--destructive))] bg-[hsl(var(--card))]",
  info: "border-[hsl(var(--primary))] bg-[hsl(var(--card))]",
  warning: "border-yellow-500 bg-[hsl(var(--card))]",
};

const variantIcons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const variantIconColors: Record<ToastVariant, string> = {
  success: "text-[hsl(var(--success))]",
  error: "text-[hsl(var(--destructive))]",
  info: "text-[hsl(var(--primary))]",
  warning: "text-yellow-500",
};

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info", duration?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const dur = duration ?? (variant === "error" ? 8000 : 4000);
      setToasts((prev) => [...prev, { id, message, variant, duration: dur }]);
      setTimeout(() => removeToast(id), dur);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => {
          const Icon = variantIcons[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md animate-in slide-in-from-right",
                variantStyles[t.variant]
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", variantIconColors[t.variant])} aria-hidden="true" />
              <span className="text-sm">{t.message}</span>
              {t.variant === "error" && (
                <button
                  onClick={() => removeToast(t.id)}
                  className="ml-2 shrink-0 rounded p-0.5 hover:bg-[hsl(var(--accent))]"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export { ToastProvider, useToast };
