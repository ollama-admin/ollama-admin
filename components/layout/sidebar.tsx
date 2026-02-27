"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  MessageSquare,
  Search,
  Package,
  Server,
  ClipboardList,
  BarChart3,
  Zap,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "/", label: "dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "chat", icon: MessageSquare },
  { href: "/discover", label: "discover", icon: Search },
  { href: "/admin/models", label: "models", icon: Package },
  { href: "/admin/servers", label: "servers", icon: Server },
  { href: "/admin/logs", label: "logs", icon: ClipboardList },
  { href: "/admin/metrics", label: "metrics", icon: BarChart3 },
  { href: "/admin/gpu", label: "gpu", icon: Zap },
  { href: "/settings", label: "settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("sidebar");

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-14 items-center border-b px-4 font-semibold">
        Ollama Admin
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
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
              <Icon className="h-4 w-4" />
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
