"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, KeyRound, MailCheck, Send } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";

export default function ForgotPasswordPage() {
  const { locale, t, plural } = useTranslations();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        body: JSON.stringify({ email })
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
        expiresInMinutes?: number;
      } | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? t("forgotPassword.failed"));
        return;
      }

      setExpiresInMinutes(data?.expiresInMinutes ?? null);
      setConfirmationMessage(
        data?.message ?? t("forgotPassword.confirmationFallback")
      );
    } catch (_error) {
      setErrorMessage(t("forgotPassword.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-md flex-col items-center py-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand text-brand-fg shadow-card">
        {confirmationMessage ? (
          <MailCheck className="h-7 w-7" />
        ) : (
          <KeyRound className="h-7 w-7" />
        )}
      </span>
      <h1 className="mt-5 text-center text-3xl font-semibold tracking-tight text-fg">
        {confirmationMessage
          ? t("forgotPassword.sentTitle")
          : t("forgotPassword.title")}
      </h1>
      <p className="mt-2 text-center text-sm text-fg-muted">
        {confirmationMessage
          ? t("forgotPassword.sentSubtitle")
          : t("forgotPassword.subtitle")}
      </p>

      <Card className="mt-7 w-full">
        {confirmationMessage ? (
          <div className="space-y-4">
            <Alert tone="success">{confirmationMessage}</Alert>
            <p className="text-sm text-fg-muted">
              {expiresInMinutes
                ? plural("forgotPassword.expiresIn", expiresInMinutes)
                : t("forgotPassword.expiresSoon")}{" "}
              {t("forgotPassword.noEmailYet")}{" "}
              <button
                className="font-semibold text-brand underline underline-offset-2 hover:text-brand-strong"
                onClick={() => setConfirmationMessage("")}
                type="button"
              >
                {t("forgotPassword.tryAnotherAddress")}
              </button>
              .
            </p>
          </div>
        ) : (
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

            {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

            <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
              <Send className="h-4 w-4" />
              {isSubmitting
                ? t("forgotPassword.submitting")
                : t("forgotPassword.submit")}
            </Button>
          </form>
        )}
      </Card>

      <Link
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-brand"
        href="/login"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("forgotPassword.backToSignIn")}
      </Link>
    </section>
  );
}
