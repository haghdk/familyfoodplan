"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import Alert from "../ui/Alert";
import Button, { buttonClassName } from "../ui/Button";
import { TextField } from "../ui/Field";

const minimumPasswordLength = 6;

type ResetPasswordFormProps = {
  token: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < minimumPasswordLength) {
      setErrorMessage(
        `Password must be at least ${minimumPasswordLength} characters.`
      );
      return;
    }

    if (password !== confirmedPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${backendApiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setErrorMessage(data?.message ?? "Could not reset your password.");
        return;
      }

      // Deliberately no router.refresh() here: the token is spent, so
      // re-running the server component would flip the page to its
      // "link expired" branch and hide this success state.
      setIsComplete(true);
    } catch (_error) {
      setErrorMessage("Could not reset your password right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          Your password has been updated. You can sign in with it now.
        </Alert>
        <Link className={buttonClassName({ className: "w-full", size: "lg" })} href="/login">
          <LogIn className="h-4 w-4" />
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <TextField
        autoComplete="new-password"
        hint={`At least ${minimumPasswordLength} characters.`}
        label="New password"
        minLength={minimumPasswordLength}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••"
        required
        type="password"
        value={password}
      />

      <TextField
        autoComplete="new-password"
        label="Confirm new password"
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
        {isSubmitting ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}
