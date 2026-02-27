"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const pathLabels: Record<string, string> = {
  admin: "Admin",
  models: "Models",
  servers: "Servers",
  logs: "Logs",
  metrics: "Metrics",
  gpu: "GPU",
  chat: "Chat",
  discover: "Discover",
  settings: "Settings",
  setup: "Setup",
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = pathLabels[seg] || seg;
    const isLast = i === segments.length - 1;

    return (
      <li key={href} className="flex items-center gap-1.5">
        {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />}
        {isLast ? (
          <span className="text-sm font-medium">{label}</span>
        ) : (
          <Link href={href} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            {label}
          </Link>
        )}
      </li>
    );
  });

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5">{crumbs}</ol>
    </nav>
  );
}

export { Breadcrumb };
