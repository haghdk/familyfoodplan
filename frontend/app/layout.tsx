import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import AuthNav from "./components/auth-nav";
import { adminSessionCookieName } from "../lib/auth";

export const metadata: Metadata = {
  title: "Family Food Planner",
  description: "Plan weekly meals for your family with confidence."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isAuthenticated = Boolean(cookieStore.get(adminSessionCookieName)?.value);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <span className="text-lg font-semibold text-slate-900">
                Family Food Planner
              </span>
              <AuthNav isAuthenticated={isAuthenticated} />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
