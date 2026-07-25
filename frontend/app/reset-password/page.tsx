import Link from "next/link";
import { ArrowLeft, KeyRound, LinkIcon } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";
import Alert from "../../components/ui/Alert";
import { buttonClassName } from "../../components/ui/Button";
import Card from "../../components/ui/Card";

const isResetTokenValid = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `${backendApiUrl}/api/auth/reset-password/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { valid: boolean };
    return data.valid;
  } catch (_error) {
    return false;
  }
};

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const isValidToken = token ? await isResetTokenValid(token) : false;

  return (
    <section className="mx-auto flex max-w-md flex-col items-center py-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand text-brand-fg shadow-card">
        {isValidToken ? (
          <KeyRound className="h-7 w-7" />
        ) : (
          <LinkIcon className="h-7 w-7" />
        )}
      </span>
      <h1 className="mt-5 text-center text-3xl font-semibold tracking-tight text-fg">
        {isValidToken ? "Choose a new password" : "This link has expired"}
      </h1>
      <p className="mt-2 text-center text-sm text-fg-muted">
        {isValidToken
          ? "Choose a password you have not used on this account before."
          : "Password reset links can only be used once, and they expire after a short while."}
      </p>

      <Card className="mt-7 w-full">
        {isValidToken && token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <Alert tone="warning">
              This reset link is no longer valid. Request a new one to continue.
            </Alert>
            <Link
              className={buttonClassName({ className: "w-full", size: "lg" })}
              href="/forgot-password"
            >
              Request a new link
            </Link>
          </div>
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
