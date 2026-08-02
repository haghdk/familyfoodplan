"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CookingPot, LogIn } from "lucide-react";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../lib/auth";
import { resolveLocale } from "../../lib/i18n/config";
import { useTranslations, writeLocaleCookie } from "../../lib/i18n/client";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setErrorMessage(t("login.invalidCredentials"));
        return;
      }

      const data = (await response.json()) as {
        token: string;
        user: { role: "ADMIN" | "VIEWER"; language?: string };
      };
      document.cookie = `${adminSessionCookieName}=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      document.cookie = `${userRoleCookieName}=${data.user.role}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;

      // Signing in on a new device is the moment the account's stored language
      // becomes known, so the cookie the rest of the app reads is seeded here.
      const accountLocale = resolveLocale(data.user.language);

      if (accountLocale) {
        writeLocaleCookie(accountLocale);
      }

      router.push("/");
      router.refresh();
    } catch (_error) {
      setErrorMessage(t("login.unavailable"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-md flex-col items-center py-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand text-brand-fg shadow-card">
        <CookingPot className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-fg">
        {t("login.title")}
      </h1>
      <p className="mt-2 text-center text-sm text-fg-muted">
        {t("login.subtitle")}
      </p>

      <Card className="mt-7 w-full">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <TextField
            autoComplete="email"
            label={t("common.email")}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("login.emailPlaceholder")}
            required
            type="email"
            value={email}
          />

          <div>
            <TextField
              autoComplete="current-password"
              label={t("common.password")}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
            <p className="mt-2 text-right">
              <Link
                className="text-sm font-medium text-fg-muted transition hover:text-brand"
                href="/forgot-password"
              >
                {t("login.forgotPassword")}
              </Link>
            </p>
          </div>

          {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

          <Button
            className="w-full"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            <LogIn className="h-4 w-4" />
            {isSubmitting ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>
      </Card>
    </section>
  );
}
