import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { CookingPot } from "lucide-react";
import "./globals.css";
import AuthNav from "./components/auth-nav";
import { adminSessionCookieName, userRoleCookieName } from "../lib/auth";
import { I18nProvider } from "../lib/i18n/client";
import { getDictionary } from "../lib/i18n/dictionaries";
import { getLocale, getTranslations } from "../lib/i18n/server";

export const viewport: Viewport = {
  themeColor: "#2c7a5b",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();

  return {
    title: t("app.name"),
    description: t("app.description"),
    applicationName: t("app.name"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: t("app.shortName"),
      statusBarStyle: "default",
    },
  };
}

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
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const { t } = await getTranslations();

  return (
    <html lang={locale}>
      <body className="antialiased">
        <I18nProvider dictionary={dictionary} locale={locale}>
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
                        {t("app.name")}
                      </span>
                      <span className="block text-xs text-fg-subtle">
                        {t("app.tagline")}
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
                {t("app.footer")}
              </div>
            </footer>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
