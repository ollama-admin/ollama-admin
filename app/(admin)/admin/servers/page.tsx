"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Server as ServerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

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
  const { toast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
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

  const checkHealth = useCallback(async (server: Server) => {
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
  }, []);

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

    try {
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast(editingId ? "Server updated" : `Server '${form.name}' created`, "success");
      resetForm();
      fetchServers();
    } catch {
      toast(editingId ? "Error updating server" : "Error creating server", "error");
    }
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/servers/${deleteTarget}`, { method: "DELETE" });
      toast("Server deleted", "success");
      fetchServers();
    } catch {
      toast("Error deleting server", "error");
    }
    setDeleteTarget(null);
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`/api/servers/${id}/test`, { method: "POST" });
      const data = await res.json();
      setHealth((prev) => ({
        ...prev,
        [id]: { id, status: data.status, version: data.version },
      }));
      if (data.status === "online") {
        toast(`Connection successful (v${data.version || "?"})`, "success");
      } else {
        toast("Connection failed", "error");
      }
    } catch {
      toast("Connection failed", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="row" className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (servers.length === 0 && !showForm) {
    return (
      <EmptyState
        icon={ServerIcon}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <Button onClick={() => setShowForm(true)}>
            {t("emptyAction")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button
          variant={showForm ? "secondary" : "primary"}
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? tc("cancel") : t("addServer")}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border p-4">
          <Input
            label={t("serverName")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="My Ollama Server"
          />
          <Input
            label={t("serverUrl")}
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
            placeholder="http://localhost:11434"
          />
          <Input
            label={t("gpuAgentUrl")}
            type="url"
            value={form.gpuAgentUrl}
            onChange={(e) => setForm({ ...form, gpuAgentUrl: e.target.value })}
            placeholder="http://localhost:9999"
          />
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
          <Button type="submit">
            {editingId ? tc("save") : tc("create")}
          </Button>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {servers.map((server) => {
          const h = health[server.id];
          return (
            <Card key={server.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={h?.status === "online" ? "success" : "destructive"}>
                  {h?.status === "online" ? "Online" : "Offline"}
                </Badge>
                <div>
                  <div className="font-medium">{server.name}</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {server.url}
                    {h?.version && <span className="ml-2">v{h.version}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleTest(server.id)}>
                  {t("testConnection")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleEdit(server)}>
                  {tc("edit")}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(server.id)}>
                  {tc("delete")}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete server"
        description={t("deleteConfirm")}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
