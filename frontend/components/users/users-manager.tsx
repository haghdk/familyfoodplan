"use client";

import { FormEvent, useState } from "react";
import { backendApiUrl } from "../../lib/auth";

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
    <section className="space-y-6">
      <form className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={createUser}>
        <h2 className="text-lg font-semibold text-slate-900">Add user</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={email}
          />
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            onChange={(event) => setRole(event.target.value as UserRole)}
            value={role}
          >
            <option value="VIEWER">Regular user (viewer)</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button
          className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          type="submit"
        >
          Add user
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        {users.map((user) => (
          <article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {editingId === user.id ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    onChange={(event) => setEditingEmail(event.target.value)}
                    type="email"
                    value={editingEmail}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    onChange={(event) => setEditingPassword(event.target.value)}
                    placeholder="Leave blank to keep current password"
                    type="password"
                    value={editingPassword}
                  />
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    onChange={(event) => setEditingRole(event.target.value as UserRole)}
                    value={editingRole}
                  >
                    <option value="VIEWER">Regular user (viewer)</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    onClick={() => updateUser(user.id)}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => setEditingId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{user.email}</p>
                  <p className="text-sm text-slate-600">{user.role === "ADMIN" ? "Admin" : "Regular viewer"}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => beginEdit(user)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                    onClick={() => deleteUser(user.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
