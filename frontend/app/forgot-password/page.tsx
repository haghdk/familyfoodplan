"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, KeyRound, MailCheck, Send } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";

export default function ForgotPasswordPage() {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
        expiresInMinutes?: number;
      } | null;

      if (!response.ok) {
        setErrorMessage(
          data?.message ?? "Could not send a reset link right now. Please try again."
        );
        return;
      }

      setExpiresInMinutes(data?.expiresInMinutes ?? null);
      setConfirmationMessage(
        data?.message ??
          "If that email address has an account, a password reset link is on its way."
      );
    } catch (_error) {
      setErrorMessage("Could not send a reset link right now. Please try again.");
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
        {confirmationMessage ? "Check your inbox" : "Forgot your password?"}
      </h1>
      <p className="mt-2 text-center text-sm text-fg-muted">
        {confirmationMessage
          ? "Follow the link in the email to choose a new password."
          : "Enter the email address on your account and we will send you a link to choose a new password."}
      </p>

      <Card className="mt-7 w-full">
        {confirmationMessage ? (
          <div className="space-y-4">
            <Alert tone="success">{confirmationMessage}</Alert>
            <p className="text-sm text-fg-muted">
              {expiresInMinutes
                ? `The link expires in ${expiresInMinutes} minutes and can only be used once.`
                : "The link expires shortly and can only be used once."}{" "}
              No email yet? Check your spam folder, or{" "}
              <button
                className="font-semibold text-brand underline underline-offset-2 hover:text-brand-strong"
                onClick={() => setConfirmationMessage("")}
                type="button"
              >
                try another address
              </button>
              .
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <TextField
              autoComplete="email"
              label="Email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />

            {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

            <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
              <Send className="h-4 w-4" />
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}
      </Card>

      <Link
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-brand"
        href="/login"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </section>
  );
}
