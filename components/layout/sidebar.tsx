"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navItems = [
  { href: "/", label: "dashboard", icon: "◫" },
  { href: "/chat", label: "chat", icon: "💬" },
  { href: "/discover", label: "discover", icon: "🔍" },
  { href: "/admin/models", label: "models", icon: "📦" },
  { href: "/admin/servers", label: "servers", icon: "🖥" },
  { href: "/admin/logs", label: "logs", icon: "📋" },
  { href: "/admin/metrics", label: "metrics", icon: "📊" },
  { href: "/admin/gpu", label: "gpu", icon: "⚡" },
  { href: "/settings", label: "settings", icon: "⚙" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("sidebar");

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-14 items-center border-b px-4 font-semibold">
        Ollama Admin
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ href, label, icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium"
                  : "hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              }`}
            >
              <span className="text-base">{icon}</span>
              <span>{t(label)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
