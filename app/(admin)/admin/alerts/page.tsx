"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface Alert {
  id: string;
  type: string;
  threshold: number;
  enabled: boolean;
  createdAt: string;
}

interface AlertCheck {
  alertId: string;
  type: string;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  detail: string;
}

const ALERT_TYPES = [
  { value: "gpu_temperature", unit: "°C" },
  { value: "gpu_vram", unit: "%" },
  { value: "error_rate", unit: "%" },
  { value: "latency", unit: "ms" },
];

export default function AlertsPage() {
  const t = useTranslations("admin.alerts");
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [checks, setChecks] = useState<AlertCheck[]>([]);
  const [newType, setNewType] = useState("gpu_temperature");
  const [newThreshold, setNewThreshold] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    const res = await fetch("/api/alerts");
    setAlerts(await res.json());
    setLoading(false);
  };

  const fetchChecks = async () => {
    const res = await fetch("/api/alerts/check");
    setChecks(await res.json());
  };

  useEffect(() => {
    fetchAlerts();
    fetchChecks();
    const interval = setInterval(fetchChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  const createAlert = async () => {
    if (!newThreshold) return;
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, threshold: Number(newThreshold) }),
    });
    setNewThreshold("");
    fetchAlerts();
    fetchChecks();
    toast(t("created"), "success");
  };

  const toggleAlert = async (id: string, enabled: boolean) => {
    await fetch(`/api/alerts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    fetchAlerts();
  };

  const deleteAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    fetchAlerts();
    toast(t("deleted"), "success");
  };

  const getUnit = (type: string) =>
    ALERT_TYPES.find((a) => a.value === type)?.unit || "";

  const triggeredChecks = checks.filter((c) => c.triggered);

  if (loading) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {triggeredChecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--destructive))]">
              <AlertTriangle className="h-5 w-5" />
              {t("activeAlerts")} ({triggeredChecks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {triggeredChecks.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.05)] p-3"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(var(--destructive))]" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {t(c.type)}: {c.currentValue}
                      {getUnit(c.type)} (threshold: {c.threshold}
                      {getUnit(c.type)})
                    </span>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {c.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {triggeredChecks.length === 0 && checks.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.05)] p-3">
          <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
          <span className="text-sm">{t("allClear")}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("createAlert")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-auto"
              aria-label={t("alertType")}
            >
              {ALERT_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {t(a.value)}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              placeholder={t("thresholdPlaceholder")}
              className="w-32"
              onKeyDown={(e) => {
                if (e.key === "Enter") createAlert();
              }}
            />
            <Button onClick={createAlert} disabled={!newThreshold}>
              <Plus className="mr-1 h-4 w-4" />
              {t("add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("configuredAlerts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {t(alert.type)}
                      </span>
                      <Badge variant={alert.enabled ? "success" : "muted"}>
                        {alert.enabled ? t("enabled") : t("disabled")}
                      </Badge>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {t("threshold")}: {alert.threshold}
                      {getUnit(alert.type)}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAlert(alert.id, !alert.enabled)}
                    className="text-xs text-[hsl(var(--primary))] hover:underline"
                  >
                    {alert.enabled ? t("disable") : t("enable")}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="rounded p-1 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))]"
                    aria-label={t("deleteAlert")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
