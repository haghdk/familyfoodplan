"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CookingPot, LogIn } from "lucide-react";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../lib/auth";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";

export default function LoginPage() {
  const router = useRouter();
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
        setErrorMessage("Invalid email or password.");
        return;
      }

      const data = (await response.json()) as { token: string; user: { role: "ADMIN" | "VIEWER" } };
      document.cookie = `${adminSessionCookieName}=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      document.cookie = `${userRoleCookieName}=${data.user.role}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      router.push("/");
      router.refresh();
    } catch (_error) {
      setErrorMessage("Unable to login right now. Please try again.");
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
        Welcome back
      </h1>
      <p className="mt-2 text-center text-sm text-fg-muted">
        Sign in to view and manage your family meal plans.
      </p>

      <Card className="mt-7 w-full">
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

          <TextField
            autoComplete="current-password"
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            type="password"
            value={password}
          />

          {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

          <Button
            className="w-full"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            <LogIn className="h-4 w-4" />
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </section>
  );
}
