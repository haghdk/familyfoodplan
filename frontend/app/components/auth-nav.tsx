"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import { CalendarIcon, UsersIcon, LogOutIcon } from "lucide-react";

type AuthNavProps = {
  isAuthenticated: boolean;
};

export default function AuthNav({ isAuthenticated }: AuthNavProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(`${backendApiUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      document.cookie = `${adminSessionCookieName}=; path=/; max-age=0; samesite=lax`;
      router.push("/login");
      router.refresh();
    }
  };

  if (!isAuthenticated) {
    return (
      <nav className="text-sm text-slate-600">
        <Link className="hover:text-slate-900" href="/login">
          Login
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-8 text-sm text-slate-600">
      <Link
        className="hover:text-slate-900 inline-flex gap-1 items-center"
        href="/plan"
      >
        <CalendarIcon className="size-4" />
        <span>Plans</span>
      </Link>
      <Link
        className="hover:text-slate-900 inline-flex gap-1 items-center"
        href="/members"
      >
        <UsersIcon className="size-4" />

        <span>Members</span>
      </Link>
      <button
        className="hover:text-slate-900 inline-flex gap-1 items-center"
        onClick={handleLogout}
        type="button"
      >
        <LogOutIcon className="size-4" />
        <span>Logout</span>
      </button>
    </nav>
  );
}
