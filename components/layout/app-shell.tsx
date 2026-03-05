"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

const CHROMELESS_ROUTES = ["/setup", "/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChromeless = CHROMELESS_ROUTES.some((r) => pathname.startsWith(r));

  if (isChromeless) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main id="main-content" className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
