"use client";

import { FormEvent, useState } from "react";
import { Pencil, ShieldUser, Trash2, UserPlus } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card, { SectionCard } from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import { SelectField, TextField } from "../ui/Field";

type UserRole = "ADMIN" | "VIEWER";

type User = {
  id: number;
  email: string;
  role: UserRole;
};

type UsersManagerProps = {
  initialUsers: User[];
};

const minimumPasswordLength = 6;

export default function UsersManager({ initialUsers }: UsersManagerProps) {
  const { locale, t, plural } = useTranslations();
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingEmail, setEditingEmail] = useState("");
  const [editingPassword, setEditingPassword] = useState("");
  const [editingRole, setEditingRole] = useState<UserRole>("VIEWER");
  const [errorMessage, setErrorMessage] = useState("");

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ email, password, role })
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || t("users.createFailed"));
      }

      const data = (await response.json()) as { user: User };
      setUsers((currentUsers) => [...currentUsers, data.user]);
      setEmail("");
      setPassword("");
      setRole("VIEWER");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("users.createFailed")
      );
    }
  };

  const beginEdit = (user: User) => {
    setEditingId(user.id);
    setEditingEmail(user.email);
    setEditingPassword("");
    setEditingRole(user.role);
  };

  const updateUser = async (userId: number) => {
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({
          email: editingEmail,
          password: editingPassword || undefined,
          role: editingRole
        })
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || t("users.updateFailed"));
      }

      const data = (await response.json()) as { user: User };
      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === userId ? data.user : user))
      );
      setEditingId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("users.updateFailed")
      );
    }
  };

  const deleteUser = async (userId: number) => {
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/users/${userId}`, {
        method: "DELETE",
        headers: localeHeader(locale),
        credentials: "include"
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || t("users.deleteFailed"));
      }

      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("users.deleteFailed")
      );
    }
  };

  return (
    <section className="space-y-5">
      <SectionCard
        description={t("users.addDescription")}
        icon={<UserPlus className="h-4 w-4" />}
        title={t("users.addTitle")}
      >
        <form onSubmit={createUser}>
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              autoComplete="off"
              label={t("common.email")}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("users.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
            <TextField
              autoComplete="new-password"
              hint={plural("users.passwordHint", minimumPasswordLength)}
              label={t("common.password")}
              minLength={minimumPasswordLength}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
            <SelectField
              label={t("users.roleLabel")}
              onChange={(event) => setRole(event.target.value as UserRole)}
              value={role}
            >
              <option value="VIEWER">{t("users.roleViewerOption")}</option>
              <option value="ADMIN">{t("users.roleAdminOption")}</option>
            </SelectField>
          </div>

          <Button className="mt-4" type="submit">
            <UserPlus className="h-4 w-4" />
            {t("users.addSubmit")}
          </Button>
        </form>
      </SectionCard>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {users.length === 0 ? (
        <EmptyState
          description={t("users.emptyDescription")}
          icon={<ShieldUser className="h-5 w-5" />}
          title={t("users.emptyTitle")}
        />
      ) : (
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.id}>
              <Card className="p-4 sm:p-4">
                {editingId === user.id ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <TextField
                        label={t("common.email")}
                        onChange={(event) => setEditingEmail(event.target.value)}
                        type="email"
                        value={editingEmail}
                      />
                      <TextField
                        hint={t("users.newPasswordHint")}
                        label={t("users.newPasswordLabel")}
                        onChange={(event) => setEditingPassword(event.target.value)}
                        placeholder="••••••••"
                        type="password"
                        value={editingPassword}
                      />
                      <SelectField
                        label={t("users.roleLabel")}
                        onChange={(event) => setEditingRole(event.target.value as UserRole)}
                        value={editingRole}
                      >
                        <option value="VIEWER">{t("users.roleViewerOption")}</option>
                        <option value="ADMIN">{t("users.roleAdminOption")}</option>
                      </SelectField>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => updateUser(user.id)}>
                        {t("common.save")}
                      </Button>
                      <Button onClick={() => setEditingId(null)} variant="secondary">
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          user.role === "ADMIN"
                            ? "flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent"
                            : "flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-muted text-fg-subtle"
                        }
                      >
                        <ShieldUser className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-fg">{user.email}</p>
                        <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>
                          {user.role === "ADMIN"
                            ? t("users.badgeAdmin")
                            : t("users.badgeViewer")}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => beginEdit(user)}
                        size="sm"
                        variant="secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        onClick={() => deleteUser(user.id)}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
