"use client";

import * as React from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { accountApi, errorMessage, fieldError } from "@/lib/api";
import { useAuth } from "@/modules/auth/auth-context";
import { AuthShell } from "@/modules/auth/auth-shell";

type Phase = "idle" | "working" | "done" | "error";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";
  const { refresh } = useAuth();
  const [token, setToken] = React.useState(tokenFromUrl);
  const [phase, setPhase] = React.useState<Phase>(tokenFromUrl ? "working" : "idle");
  const [error, setError] = React.useState<unknown>(null);

  const confirm = React.useCallback(
    async (value: string) => {
      setPhase("working");
      setError(null);
      try {
        await accountApi.confirmEmailVerification(value);
        await refresh();
        setPhase("done");
      } catch (caught) {
        setError(caught);
        setPhase("error");
      }
    },
    [refresh],
  );

  React.useEffect(() => {
    if (tokenFromUrl) {
      void confirm(tokenFromUrl);
    }
  }, [tokenFromUrl, confirm]);

  if (phase === "working") {
    return (
      <AuthShell title="Verifying your email" subtitle="One moment…">
        <div className="grid place-items-center py-4">
          <div
            className="size-7 animate-spin rounded-full border-2 border-line border-t-accent"
            role="status"
            aria-label="Verifying"
          />
        </div>
      </AuthShell>
    );
  }

  if (phase === "done") {
    return (
      <AuthShell
        title="Email verified"
        subtitle="Your email address is confirmed on your account."
        footer={
          <Link href="/today" className="font-medium text-accent-ink hover:underline">
            Continue to your OS →
          </Link>
        }
      >
        <div className="grid place-items-center py-2 text-success">
          <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Paste the token from your verification email to confirm your address."
      footer={
        <Link href="/today" className="font-medium text-accent-ink hover:underline">
          Skip for now
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm(token.trim());
        }}
        noValidate
      >
        {phase === "error" && error !== null && (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {errorMessage(error)}
          </p>
        )}
        <Field label="Verification token" htmlFor="token" error={fieldError(error, "token")} required>
          <Input
            id="token"
            name="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste your verification token"
            required
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full">
          Verify email
        </Button>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense>
      <VerifyEmailForm />
    </React.Suspense>
  );
}
