"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface User {
  id: string;
  username: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const t = useTranslations("admin.users");
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
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

  const openCreate = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormPassword("");
    setFormRole("user");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword("");
    setFormRole(user.role);
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
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

        toast(t("userUpdated"));
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

        toast(t("userCreated"));
      }

      setModalOpen(false);
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
      toast(data.error);
    } else {
      toast(t("userDeleted"));
      fetchUsers();
    }

    setDeleteUser(null);
  };

  const handleToggleActive = async (user: User) => {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createUser")}
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("username")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("created")}</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "muted"}>
                    {user.role === "admin" ? t("roleAdmin") : t("roleUser")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleActive(user)}
                    className="cursor-pointer"
                  >
                    <Badge variant={user.active ? "default" : "destructive"}>
                      {user.active ? t("active") : t("inactive")}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteUser(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? t("editUser") : t("createUser")}
      >
        <div className="space-y-4">
          <Input
            label={t("username")}
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
          />
          <Input
            label={
              editingUser
                ? t("newPassword")
                : t("password")
            }
            type="password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            placeholder={editingUser ? t("leaveBlank") : ""}
          />
          <Select
            label={t("role")}
            value={formRole}
            onChange={(e) => setFormRole(e.target.value)}
          >
            <option value="user">{t("roleUser")}</option>
            <option value="admin">{t("roleAdmin")}</option>
          </Select>

          {formError && (
            <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteUser}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { username: deleteUser?.username || "" })}
        confirmLabel={t("delete")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteUser(null)}
      />
    </div>
  );
}
