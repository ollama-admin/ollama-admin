"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import type { OllamaModel, OllamaRunningModel, OllamaShowResponse } from "@/lib/ollama";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface Server {
  id: string;
  name: string;
  url: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export default function ModelsPage() {
  const t = useTranslations("admin.models");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [running, setRunning] = useState<OllamaRunningModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullName, setPullName] = useState("");
  const [pullProgress, setPullProgress] = useState<number | null>(null);
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [inspecting, setInspecting] = useState<OllamaShowResponse | null>(null);
  const [inspectName, setInspectName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data);
        if (data.length > 0) setSelectedServer(data[0].id);
      });
  }, []);

  const fetchModels = useCallback(async () => {
    if (!selectedServer) return;
    setLoading(true);
    try {
      const [modelsRes, runningRes] = await Promise.all([
        fetch(`/api/admin/models?serverId=${selectedServer}`),
        fetch(`/api/admin/models/running?serverId=${selectedServer}`),
      ]);
      const modelsData = await modelsRes.json();
      const runningData = await runningRes.json();
      setModels(modelsData.models || []);
      setRunning(runningData.models || []);
    } catch {
      setModels([]);
      setRunning([]);
    } finally {
      setLoading(false);
    }
  }, [selectedServer]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handlePull = async () => {
    if (!pullName.trim() || !selectedServer) return;
    setPulling(true);
    setPullStatus("Starting...");
    setPullProgress(null);

    try {
      const res = await fetch("/api/admin/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selectedServer, name: pullName }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.total && json.completed) {
              const pct = Math.round((json.completed / json.total) * 100);
              setPullProgress(pct);
              setPullStatus(json.status || "Downloading...");
            } else {
              setPullStatus(json.status || "Downloading...");
            }
          } catch {
            // skip
          }
        }
      }

      toast(`Model '${pullName}' downloaded`, "success");
      setPullName("");
      fetchModels();
    } catch {
      toast("Pull failed", "error");
    } finally {
      setPulling(false);
      setPullProgress(null);
      setPullStatus(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch("/api/admin/models/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selectedServer, name: deleteTarget }),
      });
      toast(`Model '${deleteTarget}' deleted`, "success");
      fetchModels();
    } catch {
      toast("Error deleting model", "error");
    }
    setDeleteTarget(null);
  };

  const handleInspect = async (name: string) => {
    const res = await fetch("/api/admin/models/show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId: selectedServer, name }),
    });
    const data = await res.json();
    setInspecting(data);
    setInspectName(name);
  };

  const isRunning = (name: string) =>
    running.some((r) => r.name === name || r.model === name);

  const getVram = (name: string) => {
    const r = running.find((r) => r.name === name || r.model === name);
    return r ? formatBytes(r.size_vram) : null;
  };

  if (loading && models.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="row" className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  if (models.length === 0 && !loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="mt-4 w-auto"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <a href="/discover">
              <Button>{t("emptyAction")}</Button>
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="w-auto"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Input
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          placeholder={t("pullPlaceholder")}
          onKeyDown={(e) => e.key === "Enter" && handlePull()}
        />
        <Button onClick={handlePull} disabled={!pullName.trim() || pulling} loading={pulling}>
          {t("pullModel")}
        </Button>
      </div>

      {pullStatus && (
        <div className="mt-2 space-y-1" aria-live="polite">
          <p className="text-sm">{pullStatus}</p>
          {pullProgress !== null && <ProgressBar value={pullProgress} />}
        </div>
      )}

      <div className="mt-6">
        <Table caption="Installed models">
          <TableHeader>
            <tr>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("size")}</TableHead>
              <TableHead>{t("family")}</TableHead>
              <TableHead>{t("quantization")}</TableHead>
              <TableHead>{t("modified")}</TableHead>
              <TableHead />
            </tr>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {isRunning(model.name) && (
                      <Badge variant="success">
                        loaded {getVram(model.name) && `· ${getVram(model.name)}`}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatBytes(model.size)}</TableCell>
                <TableCell>{model.details?.family || "—"}</TableCell>
                <TableCell>{model.details?.quantization_level || "—"}</TableCell>
                <TableCell>
                  {new Date(model.modified_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" onClick={() => handleInspect(model.name)}>
                      {t("inspect")}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(model.name)}>
                      {tc("delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal open={!!inspecting} onClose={() => setInspecting(null)} title={inspectName}>
        {inspecting && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Family:</span>{" "}
              {inspecting.details?.family || "—"}
            </div>
            <div>
              <span className="font-medium">Parameters:</span>{" "}
              {inspecting.details?.parameter_size || "—"}
            </div>
            <div>
              <span className="font-medium">Quantization:</span>{" "}
              {inspecting.details?.quantization_level || "—"}
            </div>
            <div>
              <span className="font-medium">Format:</span>{" "}
              {inspecting.details?.format || "—"}
            </div>
            {inspecting.parameters && (
              <div>
                <span className="font-medium">Parameters:</span>
                <pre className="mt-1 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs">
                  {inspecting.parameters}
                </pre>
              </div>
            )}
            {inspecting.template && (
              <div>
                <span className="font-medium">Template:</span>
                <pre className="mt-1 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs">
                  {inspecting.template}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete model"
        description={`Are you sure you want to delete "${deleteTarget}"? This action cannot be undone.`}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
