"use client";

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { accountApi, errorMessage, fieldError } from "@/lib/api";
import { AuthShell } from "@/modules/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = React.useState("");
  const [error, setError] = React.useState<unknown>(null);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState<{ devToken?: string } | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await accountApi.requestPasswordReset(identifier.trim());
      setSent(result);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="If an account exists for that email or handle, a reset link is on its way."
        footer={
          <Link href="/login" className="font-medium text-accent-ink hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          {sent.devToken && (
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-3 text-sm text-ink-2">
              <p className="font-medium text-ink">Development mode</p>
              <p className="mt-1 text-ink-3">No email service is connected yet.</p>
              <Link
                href={`/reset-password?token=${encodeURIComponent(sent.devToken)}`}
                className="mt-2 inline-flex font-medium text-accent-ink hover:underline"
              >
                Continue to password reset →
              </Link>
            </div>
          )}
          <Button variant="secondary" className="w-full" onClick={() => setSent(null)}>
            Send another link
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email or handle and we'll send you a reset link."
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
        <Field
          label="Email or handle"
          htmlFor="identifier"
          error={fieldError(error, "identifier")}
          required
        >
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={busy}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
