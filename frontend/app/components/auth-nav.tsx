"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../lib/auth";

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
        credentials: "include"
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
    <nav className="flex items-center gap-4 text-sm text-slate-600">
      <Link className="hover:text-slate-900" href="/plan">
        Plans
      </Link>
      {isAdmin ? (
        <>
          <Link className="hover:text-slate-900" href="/members">
            Members
          </Link>
          <Link className="hover:text-slate-900" href="/users">
            Users
          </Link>
        </>
      ) : null}
      <button className="hover:text-slate-900" onClick={handleLogout} type="button">
        Logout
      </button>
    </nav>
  );
}
