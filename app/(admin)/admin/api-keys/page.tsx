"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Key, Plus, Copy, Trash2, X, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  active: boolean;
  lastUsed: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const t = useTranslations("admin.apiKeys");
  const tc = useTranslations("common");
  const { toast } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) setKeys(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const resetForm = () => {
    setNewKeyName("");
    setShowForm(false);
  };

  const createKey = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNewKeyValue(data.key);
      resetForm();
      fetchKeys();
      toast(t("keyCreated"), "success");
    } catch {
      toast(t("createError"), "error");
    } finally {
      setCreating(false);
    }
  };

  const toggleKey = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error();
      fetchKeys();
    } catch {
      toast(t("toggleError"), "error");
    }
  };

  const deleteKey = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/api-keys/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      fetchKeys();
      toast(t("keyDeleted"), "success");
    } catch {
      toast(t("deleteError"), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(t("keyCopied"), "success");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6">
          <Skeleton variant="line" className="mb-2 h-8 w-32" />
          <Skeleton variant="line" className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="row" className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (keys.length === 0 && !showForm && !newKeyValue) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          icon={Key}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("createKey")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("subtitle", { count: keys.length })}
          </p>
        </div>
        {!showForm && !newKeyValue && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("createKey")}
          </Button>
        )}
      </div>

      {/* New key banner */}
      {newKeyValue && (
        <Card className="mb-6 border-[hsl(var(--success))] bg-[hsl(var(--success)/0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-3 text-sm font-medium">{t("keyNewWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-[hsl(var(--muted))] px-3 py-2 font-mono text-sm">
                  {newKeyValue}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(newKeyValue)}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  {t("keyCopy")}
                </Button>
              </div>
            </div>
            <button
              onClick={() => setNewKeyValue("")}
              className="shrink-0 rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              aria-label={tc("close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("createKey")}</h2>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              aria-label={tc("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={createKey} className="space-y-4">
            <Input
              label={t("nameLabel")}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
              autoFocus
            />
            <div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-4">
              <Button type="button" variant="secondary" onClick={resetForm}>
                {tc("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={!newKeyName.trim()}
                loading={creating}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t("createKey")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Keys list */}
      <div className="space-y-3">
        {keys.map((k) => (
          <Card
            key={k.id}
            className={`group transition-colors hover:border-[hsl(var(--primary)/0.3)] ${
              !k.active ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    k.active
                      ? "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  <Key className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{k.name}</span>
                    <Badge
                      variant={k.active ? "success" : "muted"}
                      className="shrink-0"
                    >
                      {k.active ? t("active") : t("revoked")}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <code className="font-mono">{k.key}</code>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {k.lastUsed
                        ? new Date(k.lastUsed).toLocaleDateString()
                        : t("never")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={k.active}
                  onChange={() => toggleKey(k.id, !k.active)}
                  aria-label={`${k.active ? t("revoke") : t("activate")} ${k.name}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(k)}
                  className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                  title={tc("delete")}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{tc("delete")}</span>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteTitle")}
        description={t("deleteDescription", { name: deleteTarget?.name || "" })}
        confirmLabel={tc("delete")}
        onConfirm={deleteKey}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
