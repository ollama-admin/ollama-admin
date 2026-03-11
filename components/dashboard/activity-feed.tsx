"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface LogEntry {
  id: string;
  model: string;
  endpoint: string;
  latencyMs: number;
  statusCode: number;
  createdAt: string;
  server: { name: string };
}

interface ActivityFeedProps {
  initialLogs: LogEntry[];
  label: string;
  labelNoActivity: string;
}

function ActivityFeed({ initialLogs, label, labelNoActivity }: ActivityFeedProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const seenIds = useRef(new Set(initialLogs.map((l) => l.id)));
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/logs?limit=8");
        if (!res.ok) return;
        const data = await res.json();
        const fresh: LogEntry[] = data.logs ?? [];
        const added = fresh.filter((l) => !seenIds.current.has(l.id));
        if (added.length > 0) {
          added.forEach((l) => seenIds.current.add(l.id));
          setNewIds(new Set(added.map((l) => l.id)));
          setLogs(fresh.slice(0, 8));
          setTimeout(() => setNewIds(new Set()), 800);
        }
      } catch {
        // silently skip on network error
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        {label}
      </p>
      {logs.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{labelNoActivity}</p>
      ) : (
        <div className="flex flex-col divide-y">
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "flex items-center justify-between py-2 text-sm transition-colors duration-700",
                newIds.has(log.id) && "bg-[hsl(var(--accent))] -mx-4 px-4 rounded"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant={log.statusCode < 400 ? "success" : "destructive"}>
                  {log.statusCode}
                </Badge>
                <span className="font-mono font-medium truncate">{log.model}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:inline truncate">
                  {log.server.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))] flex-shrink-0 ml-2">
                <span className="font-mono tabular-nums">{log.latencyMs}ms</span>
                <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export { ActivityFeed, type LogEntry };
