"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import type {
  OllamaModel,
  OllamaRunningModel,
  OllamaShowResponse,
} from "@/lib/ollama";
import { Package, Trash2, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  const [search, setSearch] = useState("");
  const [pullName, setPullName] = useState("");
  const [pullProgress, setPullProgress] = useState<number | null>(null);
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [inspecting, setInspecting] = useState<OllamaShowResponse | null>(
    null
  );
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

      if (!res.ok) {
        toast("Pull failed", "error");
        return;
      }

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
            if (json.error) {
              toast(json.error, "error");
              return;
            }
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

  const filteredModels = search
    ? models.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : models;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1"
        />
        {servers.length > 1 && (
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="w-auto"
          >
            {servers.map((s) => (
              <option
                key={s.id}
                value={s.id}
                className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              >
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Pull model input */}
      <div className="mt-3 flex gap-2">
        <Input
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          placeholder={t("pullPlaceholder")}
          onKeyDown={(e) => e.key === "Enter" && handlePull()}
          className="flex-1"
        />
        <Button
          onClick={handlePull}
          disabled={!pullName.trim() || pulling}
          loading={pulling}
        >
          <Download className="mr-1 h-4 w-4" />
          {t("pullModel")}
        </Button>
      </div>

      {pullStatus && (
        <div className="mt-2 space-y-1" aria-live="polite">
          <p className="text-sm">{pullStatus}</p>
          {pullProgress !== null && <ProgressBar value={pullProgress} />}
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      ) : filteredModels.length === 0 ? (
        <EmptyState
          icon={search ? Search : Package}
          title={search ? t("noResults") : t("emptyTitle")}
          description={search ? t("noResultsDescription") : t("emptyDescription")}
          action={
            !search ? (
              <a href="/discover">
                <Button>{t("emptyAction")}</Button>
              </a>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredModels.map((model) => (
            <Card key={model.name}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">{model.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {isRunning(model.name) && (
                      <Badge variant="success">
                        loaded
                        {getVram(model.name) && ` · ${getVram(model.name)}`}
                      </Badge>
                    )}
                    {model.details?.family && (
                      <Badge variant="muted" className="text-[10px]">
                        {model.details.family}
                      </Badge>
                    )}
                    {model.details?.quantization_level && (
                      <Badge variant="muted" className="text-[10px]">
                        {model.details.quantization_level}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
                <span>{formatBytes(model.size)}</span>
                <span>
                  {new Date(model.modified_at).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-3 flex gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleInspect(model.name)}
                  className="text-xs"
                >
                  {t("inspect")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteTarget(model.name)}
                  className="text-xs"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {tc("delete")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!inspecting}
        onClose={() => setInspecting(null)}
        title={inspectName}
      >
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
