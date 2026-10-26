"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { accountApi, errorMessage, fieldError } from "@/lib/api";
import { AuthShell } from "@/modules/auth/auth-shell";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get("token") ?? "";
  const [token, setToken] = React.useState(tokenFromUrl);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<unknown>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accountApi.confirmPasswordReset({ token: token.trim(), password });
      setDone(true);
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Sign in with your new password.">
        <p className="text-center text-sm text-ink-3">
          Redirecting you to sign in…
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your reset link is single-use and expires shortly."
      footer={
        <Link href="/login" className="font-medium text-accent-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {error !== null && (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {errorMessage(error)}
          </p>
        )}
        {!tokenFromUrl && (
          <Field label="Reset token" htmlFor="token" error={fieldError(error, "token")} required>
            <Input
              id="token"
              name="token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your reset token"
              required
            />
          </Field>
        )}
        <Field
          label="New password"
          htmlFor="password"
          error={fieldError(error, "password")}
          required
          hint="At least 10 characters."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Choose a passphrase"
            minLength={10}
            required
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetPasswordForm />
    </React.Suspense>
  );
}
