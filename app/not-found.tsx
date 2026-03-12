"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-6 text-center md:min-h-screen">
      <p className="text-8xl font-bold tracking-tight text-[hsl(var(--muted-foreground)/0.2)]">
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">
        {t("description")}
      </p>
      <div className="mt-8 flex gap-3">
        <Button variant="secondary" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
        <Link href="/">
          <Button>
            <Home className="mr-2 h-4 w-4" />
            {t("home")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
