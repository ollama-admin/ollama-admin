"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ScanEye, Binary } from "lucide-react";
import { Card } from "@/components/ui/card";

const tools = [
  { href: "/tools/ocr", icon: ScanEye, key: "ocr" as const },
  { href: "/tools/embeddings", icon: Binary, key: "embeddings" as const },
];

export default function ToolsPage() {
  const t = useTranslations("tools");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        {t("description")}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map(({ href, icon: Icon, key }) => (
          <Link key={key} href={href}>
            <Card className="flex items-center gap-4 transition-colors hover:bg-[hsl(var(--accent))]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
                <Icon className="h-6 w-6 text-[hsl(var(--foreground))]" />
              </div>
              <div>
                <h2 className="font-medium">{t(`${key}.title`)}</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t(`${key}.description`)}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
