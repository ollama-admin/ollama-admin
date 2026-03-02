"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Database, Shield, Trash2, Gauge, Key, Plus, Copy, X, Globe } from "lucide-react";
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
  const [apiKeys, setApiKeys] = useState<Array<{
    id: string;
    name: string;
    key: string;
    active: boolean;
    lastUsed: string | null;
    createdAt: string;
  }>>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
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
    fetchApiKeys();
  }, []);

  const saveSettings = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logRetentionDays, logStorePrompts, rateLimitMax, rateLimitWindow }),
    });
    toast(t("saved"), "success");
  };

  const fetchApiKeys = async () => {
    const res = await fetch("/api/api-keys");
    setApiKeys(await res.json());
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();
    setNewKeyValue(data.key);
    setNewKeyName("");
    fetchApiKeys();
    toast(t("apiKeyCreated"), "success");
  };

  const toggleApiKey = async (id: string, active: boolean) => {
    await fetch(`/api/api-keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    fetchApiKeys();
  };

  const deleteApiKey = async (id: string) => {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    fetchApiKeys();
    toast(t("apiKeyDeleted"), "success");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(t("apiKeyCopied"), "success");
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

          <div>
            <label className="mb-2 block text-sm font-medium">
              <Globe className="mr-1 inline h-4 w-4" />
              {t("language")}
            </label>
            <Select
              value={typeof document !== "undefined" ? (document.cookie.match(/locale=(\w+)/)?.[1] || "en") : "en"}
              onChange={async (e) => {
                await fetch("/api/locale", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ locale: e.target.value }),
                });
                window.location.reload();
              }}
              className="w-auto"
              aria-label={t("language")}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </Select>
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
            <Key className="h-5 w-5" />
            {t("apiKeys")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newKeyValue && (
            <div className="rounded-md border border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] p-3">
              <p className="mb-1 text-sm font-medium">{t("apiKeyNewWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-[hsl(var(--muted))] px-2 py-1 text-xs">
                  {newKeyValue}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyValue)}
                  className="rounded p-1 hover:bg-[hsl(var(--accent))]"
                  aria-label={t("apiKeyCopy")}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("apiKeyNamePlaceholder")}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") createApiKey();
              }}
            />
            <Button onClick={createApiKey} disabled={!newKeyName.trim()}>
              <Plus className="mr-1 h-4 w-4" />
              {t("apiKeyCreate")}
            </Button>
          </div>

          {apiKeys.length > 0 && (
            <div className="divide-y rounded-md border">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{k.name}</span>
                      <Badge variant={k.active ? "success" : "muted"}>
                        {k.active ? t("apiKeyActive") : t("apiKeyRevoked")}
                      </Badge>
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      <code>{k.key}</code>
                      {k.lastUsed && (
                        <span className="ml-2">
                          {t("apiKeyLastUsed")}: {new Date(k.lastUsed).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleApiKey(k.id, !k.active)}
                    className="text-xs text-[hsl(var(--primary))] hover:underline"
                  >
                    {k.active ? t("apiKeyRevoke") : t("apiKeyActivate")}
                  </button>
                  <button
                    onClick={() => deleteApiKey(k.id)}
                    className="rounded p-1 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))]"
                    aria-label={t("apiKeyDelete")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
