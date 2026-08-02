"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  LogIn,
  LogOut,
  Settings,
  ShieldUser,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  adminSessionCookieName,
  backendApiUrl,
  userRoleCookieName,
} from "../../lib/auth";
import { cn } from "../../lib/cn";
import { useTranslations } from "../../lib/i18n/client";

type AuthNavProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
};

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navLinkClassName =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45";

export default function AuthNav({ isAuthenticated, isAdmin }: AuthNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslations();

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
      <nav className="flex items-center justify-end">
        <Link
          className={cn(
            navLinkClassName,
            "bg-brand text-brand-fg shadow-card hover:bg-brand-strong",
          )}
          href="/login"
        >
          <LogIn className="h-4 w-4" />
          {t("nav.login")}
        </Link>
      </nav>
    );
  }

  const navLinks: NavLink[] = [
    { href: "/plan", label: t("nav.plans"), icon: CalendarDays },
    ...(isAdmin
      ? [
          { href: "/members", label: t("nav.members"), icon: Users },
          { href: "/users", label: t("nav.users"), icon: ShieldUser },
        ]
      : []),
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  return (
    <nav className="flex items-center justify-between gap-2">
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 py-0.5">
        {navLinks.map((navLink) => {
          const isActive =
            pathname === navLink.href || pathname.startsWith(`${navLink.href}/`);
          const NavIcon = navLink.icon;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                navLinkClassName,
                isActive
                  ? "bg-brand-soft text-brand"
                  : "text-fg-muted hover:bg-surface-muted hover:text-fg",
              )}
              href={navLink.href}
              key={navLink.href}
            >
              <NavIcon className="h-4 w-4" />
              {navLink.label}
            </Link>
          );
        })}
      </div>

      <button
        aria-label={t("nav.logoutAriaLabel")}
        className={cn(
          navLinkClassName,
          "border border-border text-fg-muted hover:border-danger-border hover:bg-danger-soft hover:text-danger",
        )}
        onClick={handleLogout}
        type="button"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">{t("nav.logout")}</span>
      </button>
    </nav>
  );
}
