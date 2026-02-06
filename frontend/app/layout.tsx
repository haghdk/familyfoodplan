import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Food Planner",
  description: "Plan weekly meals for your family with confidence."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <span className="text-lg font-semibold text-slate-900">
                Family Food Planner
              </span>
              <nav className="text-sm text-slate-600">
                <a className="hover:text-slate-900" href="/login">
                  Login
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
