import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { CookingPot } from "lucide-react";
import "./globals.css";
import AuthNav from "./components/auth-nav";
import { adminSessionCookieName, userRoleCookieName } from "../lib/auth";

export const metadata: Metadata = {
  title: "Family Food Planner",
  description: "Plan weekly meals for your family with confidence.",
  applicationName: "Family Food Planner",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Food Planner",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2c7a5b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isAuthenticated = Boolean(
    cookieStore.get(adminSessionCookieName)?.value,
  );
  const isAdmin = cookieStore.get(userRoleCookieName)?.value === "ADMIN";

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="app-shell flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
                <Link
                  className="group inline-flex items-center gap-3 self-start rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
                  href="/"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-brand-fg shadow-card transition group-hover:bg-brand-strong">
                    <CookingPot className="h-5 w-5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-base font-semibold tracking-tight text-fg">
                      Family Food Planner
                    </span>
                    <span className="block text-xs text-fg-subtle">
                      Meals, planned week by week
                    </span>
                  </span>
                </Link>
                <AuthNav isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>

          <footer className="border-t border-border/70">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-fg-subtle sm:px-6">
              Family Food Planner — plan the week, shop once, eat well.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
