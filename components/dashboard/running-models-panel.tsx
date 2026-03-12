"use client";

import { useState, useEffect } from "react";
import { Cpu } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface RunningModel {
  name: string;
  size_vram: number;
  expires_at: string;
  serverName: string;
  serverId: string;
}

interface RunningModelsPanelProps {
  models: RunningModel[];
  label: string;
  labelUnload: string;
  labelExpires: string;
  labelVram: string;
  labelNoModels?: string;
  onUnload?: (serverUrl: string, model: string) => Promise<void>;
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / (1024 * 1024))} MB`;
}

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("expired");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, "0")}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

function RunningModelCard({
  model,
  labelUnload,
  labelExpires,
  labelVram,
  onUnload,
}: {
  model: RunningModel;
  labelUnload: string;
  labelExpires: string;
  labelVram: string;
  onUnload?: (serverUrl: string, modelName: string) => Promise<void>;
}) {
  const countdown = useCountdown(model.expires_at);
  const [unloading, setUnloading] = useState(false);

  async function handleUnload() {
    if (!onUnload) return;
    setUnloading(true);
    try {
      await onUnload(model.serverId, model.name);
    } finally {
      setUnloading(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-md border p-3">
      <div className="flex items-start gap-2 min-w-0">
        <Cpu className="h-4 w-4 mt-0.5 flex-shrink-0 text-[hsl(var(--primary))]" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-sm font-medium truncate" title={model.name}>
            {model.name}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{model.serverName}</span>
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{labelVram}: {formatBytes(model.size_vram)}</span>
            <span
              className={cn(
                "font-mono",
                countdown === "expired" && "text-[hsl(var(--destructive))]"
              )}
            >
              {labelExpires}: {countdown}
            </span>
          </div>
        </div>
      </div>
      {onUnload && (
        <Button
          variant="secondary"
          className="flex-shrink-0 h-7 px-2 text-xs"
          onClick={handleUnload}
          disabled={unloading}
        >
          {labelUnload}
        </Button>
      )}
    </div>
  );
}

function RunningModelsPanel({
  models,
  label,
  labelUnload,
  labelExpires,
  labelVram,
  labelNoModels,
  onUnload,
}: RunningModelsPanelProps) {
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        {label}
      </p>
      {models.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{labelNoModels ?? "No models in VRAM"}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {models.map((m) => (
            <RunningModelCard
              key={`${m.serverId}-${m.name}`}
              model={m}
              labelUnload={labelUnload}
              labelExpires={labelExpires}
              labelVram={labelVram}
              onUnload={onUnload}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export { RunningModelsPanel, type RunningModel };
