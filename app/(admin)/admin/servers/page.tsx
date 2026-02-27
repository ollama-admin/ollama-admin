"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Server as ServerIcon } from "lucide-react";

interface Server {
  id: string;
  name: string;
  url: string;
  gpuAgentUrl: string | null;
  active: boolean;
  createdAt: string;
}

interface HealthStatus {
  id: string;
  status: "online" | "offline";
  version?: string;
}

export default function ServersPage() {
  const t = useTranslations("admin.servers");
  const tc = useTranslations("common");
  const [servers, setServers] = useState<Server[]>([]);
  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    url: "",
    gpuAgentUrl: "",
    active: true,
  });

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/servers");
      const data = await res.json();
      setServers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(
    async (server: Server) => {
      try {
        const res = await fetch(`/api/servers/${server.id}/health`);
        const data: HealthStatus = await res.json();
        setHealth((prev) => ({ ...prev, [server.id]: data }));
      } catch {
        setHealth((prev) => ({
          ...prev,
          [server.id]: { id: server.id, status: "offline" },
        }));
      }
    },
    []
  );

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    servers.forEach((s) => {
      if (s.active) checkHealth(s);
    });
  }, [servers, checkHealth]);

  const resetForm = () => {
    setForm({ name: "", url: "", gpuAgentUrl: "", active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/servers/${editingId}` : "/api/servers";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    resetForm();
    fetchServers();
  };

  const handleEdit = (server: Server) => {
    setForm({
      name: server.name,
      url: server.url,
      gpuAgentUrl: server.gpuAgentUrl || "",
      active: server.active,
    });
    setEditingId(server.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    await fetch(`/api/servers/${id}`, { method: "DELETE" });
    fetchServers();
  };

  const handleTest = async (id: string) => {
    const res = await fetch(`/api/servers/${id}/test`, { method: "POST" });
    const data = await res.json();
    setHealth((prev) => ({
      ...prev,
      [id]: { id, status: data.status, version: data.version },
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-[hsl(var(--muted))]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (servers.length === 0 && !showForm) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ServerIcon className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
        <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          {t("emptyDescription")}
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
        >
          {t("emptyAction")}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
        >
          {showForm ? tc("cancel") : t("addServer")}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-3 rounded-lg border p-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("serverName")}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              placeholder="My Ollama Server"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("serverUrl")}
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              placeholder="http://localhost:11434"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("gpuAgentUrl")}
            </label>
            <input
              type="url"
              value={form.gpuAgentUrl}
              onChange={(e) =>
                setForm({ ...form, gpuAgentUrl: e.target.value })
              }
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              placeholder="http://localhost:9999"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <label htmlFor="active" className="text-sm">
              {t("active")}
            </label>
          </div>
          <button
            type="submit"
            className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
          >
            {editingId ? tc("save") : tc("create")}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {servers.map((server) => {
          const h = health[server.id];
          return (
            <div
              key={server.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    h?.status === "online"
                      ? "bg-[hsl(var(--success))]"
                      : "bg-[hsl(var(--destructive))]"
                  }`}
                  aria-label={h?.status === "online" ? t("online") : t("offline")}
                />
                <div>
                  <div className="font-medium">{server.name}</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {server.url}
                    {h?.version && (
                      <span className="ml-2">v{h.version}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTest(server.id)}
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-[hsl(var(--accent))]"
                >
                  {t("testConnection")}
                </button>
                <button
                  onClick={() => handleEdit(server)}
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-[hsl(var(--accent))]"
                >
                  {tc("edit")}
                </button>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="rounded-md border px-3 py-1.5 text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))]"
                >
                  {tc("delete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
