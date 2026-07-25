"use client";

import { FormEvent, useState } from "react";
import { Pencil, ShieldUser, Trash2, UserPlus } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
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

export default function UsersManager({ initialUsers }: UsersManagerProps) {
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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, role })
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || "Unable to create user.");
      }

      const data = (await response.json()) as { user: User };
      setUsers((currentUsers) => [...currentUsers, data.user]);
      setEmail("");
      setPassword("");
      setRole("VIEWER");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create user.");
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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: editingEmail,
          password: editingPassword || undefined,
          role: editingRole
        })
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || "Unable to update user.");
      }

      const data = (await response.json()) as { user: User };
      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === userId ? data.user : user))
      );
      setEditingId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update user.");
    }
  };

  const deleteUser = async (userId: number) => {
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/users/${userId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || "Unable to delete user.");
      }

      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete user.");
    }
  };

  return (
    <section className="space-y-5">
      <SectionCard
        description="Admins can edit everything. Viewers can only read plans and grocery lists."
        icon={<UserPlus className="h-4 w-4" />}
        title="Add user"
      >
        <form onSubmit={createUser}>
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              autoComplete="off"
              label="Email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
            <TextField
              autoComplete="new-password"
              hint="At least 6 characters."
              label="Password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
            <SelectField
              label="Role"
              onChange={(event) => setRole(event.target.value as UserRole)}
              value={role}
            >
              <option value="VIEWER">Regular user (viewer)</option>
              <option value="ADMIN">Admin</option>
            </SelectField>
          </div>

          <Button className="mt-4" type="submit">
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        </form>
      </SectionCard>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {users.length === 0 ? (
        <EmptyState
          description="Create an account so other family members can sign in."
          icon={<ShieldUser className="h-5 w-5" />}
          title="No users yet"
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
                        label="Email"
                        onChange={(event) => setEditingEmail(event.target.value)}
                        type="email"
                        value={editingEmail}
                      />
                      <TextField
                        hint="Leave blank to keep the current password."
                        label="New password"
                        onChange={(event) => setEditingPassword(event.target.value)}
                        placeholder="••••••••"
                        type="password"
                        value={editingPassword}
                      />
                      <SelectField
                        label="Role"
                        onChange={(event) => setEditingRole(event.target.value as UserRole)}
                        value={editingRole}
                      >
                        <option value="VIEWER">Regular user (viewer)</option>
                        <option value="ADMIN">Admin</option>
                      </SelectField>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => updateUser(user.id)}>Save</Button>
                      <Button onClick={() => setEditingId(null)} variant="secondary">
                        Cancel
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
                          {user.role === "ADMIN" ? "Admin" : "Regular viewer"}
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
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteUser(user.id)}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
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
