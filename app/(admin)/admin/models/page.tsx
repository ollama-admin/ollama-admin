"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import type { OllamaModel, OllamaRunningModel, OllamaShowResponse } from "@/lib/ollama";
import { Package, Search, Cpu, Eye, Trash2, AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useServers } from "@/lib/hooks/use-servers";
import { useUnloadModel } from "@/lib/hooks/use-unload-model";

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export default function ModelsPage() {
  const t = useTranslations("admin.models");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const { servers, selectedServer, setSelectedServer } = useServers();
  const unloadModel = useUnloadModel(tc);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [running, setRunning] = useState<OllamaRunningModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [search, setSearch] = useState("");
  const [inspecting, setInspecting] = useState<OllamaShowResponse | null>(null);
  const [inspectName, setInspectName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    if (!selectedServer) return;
    setLoading(true);
    setConnectionError(false);
    try {
      const [modelsRes, runningRes] = await Promise.all([
        fetch(`/api/admin/models?serverId=${selectedServer}`),
        fetch(`/api/admin/models/running?serverId=${selectedServer}`),
      ]);
      if (!modelsRes.ok) {
        setConnectionError(true);
        setModels([]);
        setRunning([]);
        return;
      }
      const modelsData = await modelsRes.json();
      const runningData = runningRes.ok ? await runningRes.json() : { models: [] };
      setModels(modelsData.models || []);
      setRunning(runningData.models || []);
    } catch {
      setConnectionError(true);
      setModels([]);
      setRunning([]);
    } finally {
      setLoading(false);
    }
  }, [selectedServer]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchModels();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchModels]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch("/api/admin/models/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selectedServer, name: deleteTarget }),
      });
      toast(t("deleteSuccess", { model: deleteTarget }), "success");
      fetchModels();
    } catch {
      toast(t("deleteError"), "error");
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

  const handleUnload = async (name: string) => {
    await unloadModel(name, selectedServer);
    fetchModels();
  };

  const isRunning = (name: string) =>
    running.some((r) => r.name === name || r.model === name);

  const getVram = (name: string) => {
    const r = running.find((r) => r.name === name || r.model === name);
    return r ? formatBytes(r.size_vram) : null;
  };

  const filtered = models.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && models.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      </div>
    );
  }

  if (connectionError && !loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <Select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} className="mt-4 w-auto">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
        <EmptyState
          icon={AlertTriangle}
          title={tc("connectionError")}
          description={tc("connectionErrorDescription")}
          action={<Button onClick={fetchModels}>{tc("retry")}</Button>}
        />
      </div>
    );
  }

  if (models.length === 0 && !loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <Select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} className="mt-4 w-auto">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={<a href="/discover"><Button>{t("emptyAction")}</Button></a>}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <Select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} className="w-auto">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
      </div>

      <div className="mt-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title={t("noResults")} description={t("noResultsDescription")} />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((model) => (
            <Card key={model.name}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium" title={model.name}>{model.name}</h3>
                    {isRunning(model.name) && (
                      <Badge variant="success" className="shrink-0">
                        <Cpu className="mr-1 h-3 w-3" />
                        {t("loaded")} {getVram(model.name) && `· ${getVram(model.name)}`}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(model.size)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {model.details?.family && <Badge variant="muted" className="text-[10px]">{model.details.family}</Badge>}
                    {model.details?.parameter_size && <Badge variant="muted" className="text-[10px]">{model.details.parameter_size}</Badge>}
                    {model.details?.quantization_level && <Badge variant="muted" className="text-[10px]">{model.details.quantization_level}</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {t("modified")}: {new Date(model.modified_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {isRunning(model.name) && (
                    <Button variant="secondary" size="sm" onClick={() => handleUnload(model.name)} title={t("unload")}>
                      <Upload className="h-4 w-4" />
                      {t("unload")}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => handleInspect(model.name)} title={t("inspect")}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(model.name)} title={tc("delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!inspecting} onClose={() => setInspecting(null)} title={inspectName}>
        {inspecting && (
          <div className="space-y-3 text-sm">
            <div><span className="font-medium">Family:</span> {inspecting.details?.family || "—"}</div>
            <div><span className="font-medium">Parameters:</span> {inspecting.details?.parameter_size || "—"}</div>
            <div><span className="font-medium">Quantization:</span> {inspecting.details?.quantization_level || "—"}</div>
            <div><span className="font-medium">Format:</span> {inspecting.details?.format || "—"}</div>
            {inspecting.parameters && (
              <div>
                <span className="font-medium">Parameters:</span>
                <pre className="mt-1 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs">{inspecting.parameters}</pre>
              </div>
            )}
            {inspecting.template && (
              <div>
                <span className="font-medium">Template:</span>
                <pre className="mt-1 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs">{inspecting.template}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteTitle")}
        description={t("deleteDescription", { model: deleteTarget || "" })}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
