import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/cn";

interface GpuInfo {
  name: string;
  memoryTotal: number;
  memoryUsed: number;
  utilization: number;
}

interface ServerStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  version?: string;
  runningModels: { name: string; size_vram: number; expires_at: string }[];
  gpu: GpuInfo[] | null;
}

interface ServerStatusPanelProps {
  servers: ServerStatus[];
  labelOnline: string;
  labelOffline: string;
  labelVram: string;
  labelModels: string;
  labelGpuDetails?: string;
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function ServerStatusPanel({
  servers,
  labelOnline,
  labelOffline,
  labelVram,
  labelModels,
  labelGpuDetails,
}: ServerStatusPanelProps) {
  return (
    <Card className="flex flex-col gap-3">
      {servers.map((server) => {
        const gpu = server.gpu?.[0];
        const vramPct = gpu ? Math.round((gpu.memoryUsed / gpu.memoryTotal) * 100) : null;
        const vramColor =
          vramPct === null ? undefined : vramPct > 90 ? "destructive" : vramPct > 70 ? "warning" : undefined;

        return (
          <div key={server.id} className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    server.status === "online"
                      ? "bg-[hsl(var(--success))]"
                      : "bg-[hsl(var(--destructive))]"
                  )}
                  aria-label={server.status === "online" ? labelOnline : labelOffline}
                />
                <span className="text-sm font-medium truncate">{server.name}</span>
              </div>
              {server.version && (
                <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  v{server.version}
                </span>
              )}
            </div>

            {gpu && vramPct !== null && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{labelVram}</span>
                  <span className="font-mono">
                    {formatBytes(gpu.memoryUsed)} / {formatBytes(gpu.memoryTotal)}
                  </span>
                </div>
                <ProgressBar
                  value={vramPct}
                  className={cn(
                    vramColor === "destructive" && "[&>div>div]:bg-[hsl(var(--destructive))]",
                    vramColor === "warning" && "[&>div>div]:bg-yellow-500"
                  )}
                />
              </div>
            )}

            {server.runningModels.length > 0 && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {labelModels}: {server.runningModels.map((m) => m.name).join(", ")}
              </p>
            )}

            {gpu && labelGpuDetails && (
              <Link
                href="/gpu"
                className="text-xs text-[hsl(var(--primary))] hover:underline"
              >
                {labelGpuDetails} →
              </Link>
            )}
          </div>
        );
      })}

      {servers.length === 0 && (
        <Link href="/admin/servers" className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">
          No servers configured
        </Link>
      )}
    </Card>
  );
}

export { ServerStatusPanel, type ServerStatus };
