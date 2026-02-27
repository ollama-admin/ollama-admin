"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  GitCompareArrows,
  Search,
  Package,
  Server,
  ClipboardList,
  BarChart3,
  Zap,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Tooltip } from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "main",
    items: [
      { href: "/", label: "dashboard", icon: LayoutDashboard },
      { href: "/chat", label: "chat", icon: MessageSquare },
      { href: "/compare", label: "compare", icon: GitCompareArrows },
      { href: "/discover", label: "discover", icon: Search },
    ],
  },
  {
    title: "admin",
    items: [
      { href: "/admin/models", label: "models", icon: Package },
      { href: "/admin/servers", label: "servers", icon: Server },
      { href: "/admin/logs", label: "logs", icon: ClipboardList },
      { href: "/admin/metrics", label: "metrics", icon: BarChart3 },
      { href: "/admin/gpu", label: "gpu", icon: Zap },
      { href: "/admin/alerts", label: "alerts", icon: Bell },
    ],
  },
  {
    title: "system",
    items: [
      { href: "/settings", label: "settings", icon: Settings },
    ],
  },
];

const COLLAPSED_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, String(!prev));
      return !prev;
    });
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  const renderNavLink = (item: NavItem) => {
    const { href, label, icon: Icon } = item;
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

    const link = (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium"
            : "hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{t(label)}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={href} content={t(label)} side="right">
          {link}
        </Tooltip>
      );
    }

    return <div key={href}>{link}</div>;
  };

  const sidebarContent = (
    <>
      <div className={cn("flex h-14 items-center gap-2.5 border-b px-4 font-semibold", collapsed && "justify-center px-2")}>
        <Image
          src="/logo-32.png"
          alt="Ollama Admin"
          width={24}
          height={24}
          className="shrink-0 rounded"
        />
        {!collapsed && <span>Ollama Admin</span>}
      </div>

      <div className="flex items-center justify-end border-b px-2 py-1">
        <button
          onClick={toggleCollapsed}
          className="rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--accent))]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-auto p-2">
        {navGroups.map((group, i) => (
          <div key={group.title}>
            {i > 0 && (
              <div className="my-2 flex items-center gap-2 px-3">
                <div className="h-px flex-1 bg-[hsl(var(--border))]" />
                {!collapsed && (
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {group.title}
                  </span>
                )}
                <div className="h-px flex-1 bg-[hsl(var(--border))]" />
              </div>
            )}
            <div className="space-y-1">
              {group.items.map(renderNavLink)}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        {collapsed ? null : <ThemeToggle />}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden h-full flex-col border-r bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-md border bg-[hsl(var(--card))] p-2 shadow-md md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="flex h-full w-64 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2.5">
                <Image src="/logo-32.png" alt="Ollama Admin" width={24} height={24} className="rounded" />
                <span className="font-semibold">Ollama Admin</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 hover:bg-[hsl(var(--accent))]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-auto p-2">
              {navGroups.map((group, i) => (
                <div key={group.title}>
                  {i > 0 && (
                    <div className="my-2 flex items-center gap-2 px-3">
                      <div className="h-px flex-1 bg-[hsl(var(--border))]" />
                      <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        {group.title}
                      </span>
                      <div className="h-px flex-1 bg-[hsl(var(--border))]" />
                    </div>
                  )}
                  <div className="space-y-1">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium"
                              : "hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{t(label)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t p-3">
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
