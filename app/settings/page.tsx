"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Database, Shield, Trash2, Gauge } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useDensity } from "@/components/providers/density-provider";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();
  const { toast } = useToast();

  const [logRetentionDays, setLogRetentionDays] = useState("90");
  const [logStorePrompts, setLogStorePrompts] = useState("true");
  const [rateLimitMax, setRateLimitMax] = useState("60");
  const [rateLimitWindow, setRateLimitWindow] = useState("60");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.logRetentionDays) setLogRetentionDays(data.logRetentionDays);
        if (data.logStorePrompts) setLogStorePrompts(data.logStorePrompts);
        if (data.rateLimitMax) setRateLimitMax(data.rateLimitMax);
        if (data.rateLimitWindow) setRateLimitWindow(data.rateLimitWindow);
      });
  }, []);

  const saveSettings = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logRetentionDays, logStorePrompts, rateLimitMax, rateLimitWindow }),
    });
    toast(t("saved"), "success");
  };

  const purgeOldLogs = async () => {
    const days = parseInt(logRetentionDays, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    await fetch(`/api/logs?purge=true&before=${cutoff.toISOString()}`, {
      method: "DELETE",
    });
    toast(t("logsPurged"), "success");
  };

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("appearance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {t("theme")}
            </label>
            <div className="flex gap-2" role="radiogroup" aria-label={t("theme")}>
              {[
                { value: "light", icon: Sun, label: t("themeLight") },
                { value: "dark", icon: Moon, label: t("themeDark") },
                { value: "system", icon: Monitor, label: t("themeAuto") },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${
                    theme === value
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "hover:bg-[hsl(var(--accent))]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {t("density")}
            </label>
            <div className="flex gap-2" role="radiogroup" aria-label={t("density")}>
              {(["compact", "normal", "spacious"] as const).map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={density === d}
                  onClick={() => setDensity(d)}
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    density === d
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "hover:bg-[hsl(var(--accent))]"
                  }`}
                >
                  {t(d)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("loggingPrivacy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t("logRetentionDays")}
            type="number"
            min={1}
            value={logRetentionDays}
            onChange={(e) => setLogRetentionDays(e.target.value)}
          />

          <Select
            label={t("storePrompts")}
            value={logStorePrompts}
            onChange={(e) => setLogStorePrompts(e.target.value)}
          >
            <option value="true">{t("storePromptsYes")}</option>
            <option value="false">{t("storePromptsNo")}</option>
          </Select>

          <div className="flex gap-2">
            <Button onClick={saveSettings}>{t("saveChanges")}</Button>
            <Button variant="destructive" onClick={purgeOldLogs}>
              <Trash2 className="mr-1 h-4 w-4" />
              {t("purgeLogs")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            {t("rateLimit")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t("rateLimitMax")}
            type="number"
            min={1}
            value={rateLimitMax}
            onChange={(e) => setRateLimitMax(e.target.value)}
          />
          <Input
            label={t("rateLimitWindow")}
            type="number"
            min={1}
            value={rateLimitWindow}
            onChange={(e) => setRateLimitWindow(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("rateLimitDescription")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t("database")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="success">{t("connected")}</Badge>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("databaseType")}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
