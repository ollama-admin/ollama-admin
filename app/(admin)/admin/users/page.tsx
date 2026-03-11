"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface User {
  id: string;
  username: string;
  role: string;
  active: boolean;
  createdAt: string;
}

function UserAvatar({ username, role }: { username: string; role: string }) {
  const initials = username.slice(0, 2).toUpperCase();
  const isAdmin = role === "admin";
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        isAdmin
          ? "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
      }`}
    >
      {initials}
    </div>
  );
}

export default function UsersPage() {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormPassword("");
    setFormRole("user");
    setFormActive(true);
    setFormError("");
    setShowPassword(false);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword("");
    setFormRole(user.role);
    setFormActive(user.active);
    setFormError("");
    setShowPassword(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (formUsername.length < 3) {
      setFormError(t("usernameTooShort"));
      return;
    }
    if (!editingUser && formPassword.length < 8) {
      setFormError(t("passwordTooShort"));
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          username: formUsername,
          role: formRole,
          active: formActive,
        };
        if (formPassword) body.password = formPassword;

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          setFormError(data.error);
          return;
        }

        toast(t("userUpdated"), "success");
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formUsername,
            password: formPassword,
            role: formRole,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setFormError(data.error);
          return;
        }

        toast(t("userCreated"), "success");
      }

      resetForm();
      fetchUsers();
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;

    const res = await fetch(`/api/users/${deleteUser.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      toast(data.error, "error");
    } else {
      toast(t("userDeleted"), "success");
      fetchUsers();
    }

    setDeleteUser(null);
  };

  const handleToggleActive = async (user: User) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      fetchUsers();
    }
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
            <Skeleton key={i} variant="row" className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0 && !showForm) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("createUser")}
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
            {t("subtitle", { count: users.length })}
          </p>
        </div>
        {!showForm && (
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("createUser")}
          </Button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingUser ? t("editUser") : t("createUser")}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              aria-label={tc("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("username")}
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              required
              placeholder={t("usernamePlaceholder")}
              autoFocus
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <Input
                  label={editingUser ? t("newPassword") : t("password")}
                  type={showPassword ? "text" : "password"}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? t("leaveBlank") : t("passwordPlaceholder")}
                  required={!editingUser}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-[2.05rem] rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Select
                label={t("role")}
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                <option value="user">{t("roleUser")}</option>
                <option value="admin">{t("roleAdmin")}</option>
              </Select>
            </div>

            {formError && (
              <p className="text-sm text-[hsl(var(--destructive))]" role="alert">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-4">
              {editingUser ? (
                <Switch
                  id="user-active"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  label={t("active")}
                />
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={saving}>
                  {editingUser ? tc("save") : tc("create")}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* User list */}
      <div className="space-y-3">
        {users.map((user) => {
          const isInitialUser = users.every(
            (u) => new Date(u.createdAt) >= new Date(user.createdAt)
          );
          return (
          <Card
            key={user.id}
            className={`group transition-colors hover:border-[hsl(var(--primary)/0.3)] ${
              !user.active ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Left: avatar + info */}
              <div className="flex min-w-0 items-center gap-4">
                <UserAvatar username={user.username} role={user.role} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{user.username}</span>
                    <Badge
                      variant={user.role === "admin" ? "default" : "muted"}
                      className="shrink-0"
                    >
                      {user.role === "admin" ? (
                        <ShieldCheck className="mr-1 h-3 w-3" />
                      ) : (
                        <Shield className="mr-1 h-3 w-3" />
                      )}
                      {user.role === "admin" ? t("roleAdmin") : t("roleUser")}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        user.active ? "text-emerald-500" : "text-[hsl(var(--destructive))]"
                      }`}
                    >
                      <span className="relative flex h-2 w-2">
                        {user.active && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        )}
                        <span
                          className={`relative inline-flex h-2 w-2 rounded-full ${
                            user.active ? "bg-emerald-500" : "bg-[hsl(var(--destructive))]"
                          }`}
                        />
                      </span>
                      {user.active ? t("active") : t("inactive")}
                    </span>
                    <span>{t("createdOn", { date: new Date(user.createdAt).toLocaleDateString() })}</span>
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={user.active}
                  onChange={() => handleToggleActive(user)}
                  aria-label={`${t("toggleActive")} ${user.username}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(user)}
                  title={tc("edit")}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">{tc("edit")}</span>
                </Button>
                {!isInitialUser && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteUser(user)}
                    className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                    title={tc("delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{tc("delete")}</span>
                  </Button>
                )}
              </div>
            </div>
          </Card>
          );
        })}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteUser}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { username: deleteUser?.username || "" })}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteUser(null)}
      />
    </div>
  );
}
