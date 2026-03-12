"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sidebar } from "@/components/layout/sidebar";

const CHROMELESS_ROUTES = ["/setup", "/auth"];

function NoServerBanner() {
  const t = useTranslations("common");
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length === 0) setShow(true); })
      .catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <span className="flex-1">{t("noServerBanner")}</span>
      <Link
        href="/admin/servers"
        className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
      >
        {t("noServerBannerAction")} →
      </Link>
      <button
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-900/60"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChromeless = CHROMELESS_ROUTES.some((r) => pathname.startsWith(r));

  if (isChromeless) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main id="main-content" className="flex flex-1 flex-col overflow-hidden pt-14 md:pt-0">
        <NoServerBanner />
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
