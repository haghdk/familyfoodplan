"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../ui/Alert";
import Button, { buttonClassName } from "../ui/Button";
import { TextField } from "../ui/Field";

const minimumPasswordLength = 6;

type ResetPasswordFormProps = {
  token: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { locale, t, plural } = useTranslations();
  const [password, setPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < minimumPasswordLength) {
      setErrorMessage(plural("resetPassword.tooShort", minimumPasswordLength));
      return;
    }

    if (password !== confirmedPassword) {
      setErrorMessage(t("resetPassword.mismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${backendApiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        body: JSON.stringify({ token, password })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setErrorMessage(data?.message ?? t("resetPassword.failed"));
        return;
      }

      // Deliberately no router.refresh() here: the token is spent, so
      // re-running the server component would flip the page to its
      // "link expired" branch and hide this success state.
      setIsComplete(true);
    } catch (_error) {
      setErrorMessage(t("resetPassword.failedNow"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{t("resetPassword.success")}</Alert>
        <Link className={buttonClassName({ className: "w-full", size: "lg" })} href="/login">
          <LogIn className="h-4 w-4" />
          {t("resetPassword.goToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <TextField
        autoComplete="new-password"
        hint={plural("resetPassword.minimumLength", minimumPasswordLength)}
        label={t("resetPassword.newPasswordLabel")}
        minLength={minimumPasswordLength}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••"
        required
        type="password"
        value={password}
      />

      <TextField
        autoComplete="new-password"
        label={t("resetPassword.confirmPasswordLabel")}
        minLength={minimumPasswordLength}
        onChange={(event) => setConfirmedPassword(event.target.value)}
        placeholder="••••••••"
        required
        type="password"
        value={confirmedPassword}
      />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
        {isSubmitting ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {isSubmitting ? t("common.saving") : t("resetPassword.submit")}
      </Button>
    </form>
  );
}
