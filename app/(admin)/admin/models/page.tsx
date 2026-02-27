"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import type { OllamaModel, OllamaRunningModel, OllamaShowResponse } from "@/lib/ollama";
import { Package } from "lucide-react";

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
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [running, setRunning] = useState<OllamaRunningModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullName, setPullName] = useState("");
  const [pullProgress, setPullProgress] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [inspecting, setInspecting] = useState<OllamaShowResponse | null>(null);
  const [inspectName, setInspectName] = useState("");

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
    setPullProgress("Starting...");

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
              setPullProgress(`${json.status} — ${pct}%`);
            } else {
              setPullProgress(json.status || "Downloading...");
            }
          } catch {
            // skip
          }
        }
      }

      setPullProgress("Complete!");
      setPullName("");
      fetchModels();
    } catch {
      setPullProgress("Pull failed.");
    } finally {
      setPulling(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(t("deleteConfirm", { model: name }))) return;

    await fetch("/api/admin/models/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId: selectedServer, name }),
    });
    fetchModels();
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
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
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
          <select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="mt-4 rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <div className="mt-12 flex flex-col items-center text-center">
          <Package className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">{t("emptyDescription")}</p>
          <a
            href="/discover"
            className="mt-4 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
          >
            {t("emptyAction")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {servers.length > 1 && (
          <select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          placeholder={t("pullPlaceholder")}
          className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handlePull()}
        />
        <button
          onClick={handlePull}
          disabled={!pullName.trim() || pulling}
          className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
        >
          {t("pullModel")}
        </button>
      </div>

      {pullProgress && (
        <div className="mt-2 rounded-md border p-2 text-sm">{pullProgress}</div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-[hsl(var(--muted-foreground))]">
              <th className="pb-2 font-medium">{t("name")}</th>
              <th className="pb-2 font-medium">{t("size")}</th>
              <th className="pb-2 font-medium">{t("family")}</th>
              <th className="pb-2 font-medium">{t("quantization")}</th>
              <th className="pb-2 font-medium">{t("modified")}</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.name} className="border-b">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {isRunning(model.name) && (
                      <span className="rounded bg-[hsl(var(--success))] px-1.5 py-0.5 text-xs text-white">
                        loaded {getVram(model.name) && `· ${getVram(model.name)}`}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3">{formatBytes(model.size)}</td>
                <td className="py-3">{model.details?.family || "—"}</td>
                <td className="py-3">{model.details?.quantization_level || "—"}</td>
                <td className="py-3">
                  {new Date(model.modified_at).toLocaleDateString()}
                </td>
                <td className="py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleInspect(model.name)}
                      className="rounded border px-2 py-1 text-xs hover:bg-[hsl(var(--accent))]"
                    >
                      {t("inspect")}
                    </button>
                    <button
                      onClick={() => handleDelete(model.name)}
                      className="rounded border px-2 py-1 text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))]"
                    >
                      {tc("delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inspecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-[hsl(var(--card))] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{inspectName}</h2>
              <button
                onClick={() => setInspecting(null)}
                className="rounded-md border px-3 py-1 text-sm hover:bg-[hsl(var(--accent))]"
              >
                {tc("close")}
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
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
          </div>
        </div>
      )}
    </div>
  );
}
