"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarIcon, UsersIcon, ShieldUserIcon, LogOutIcon } from "lucide-react";
import {
  adminSessionCookieName,
  backendApiUrl,
  userRoleCookieName,
} from "../../lib/auth";

type AuthNavProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
};

export default function AuthNav({ isAuthenticated, isAdmin }: AuthNavProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(`${backendApiUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      document.cookie = `${adminSessionCookieName}=; path=/; max-age=0; samesite=lax`;
      document.cookie = `${userRoleCookieName}=; path=/; max-age=0; samesite=lax`;
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
      {isAdmin ? (
        <>
          <Link
            className="hover:text-slate-900 inline-flex gap-1 items-center"
            href="/members"
          >
            <UsersIcon className="size-4" />
            Members
          </Link>
          <Link
            className="hover:text-slate-900 inline-flex gap-1 items-center"
            href="/users"
          >
            <ShieldUserIcon className="size-4" />
            Users
          </Link>
        </>
      ) : null}
      <button
        className="hover:text-slate-900 inline-flex gap-1 items-center"
        onClick={handleLogout}
        type="button"
      >
        <LogOutIcon className="size-4" />
        Logout
      </button>
    </nav>
  );
}
