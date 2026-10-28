"use client";

import * as React from "react";

import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Status = { enabled: boolean; recoveryCodesRemaining: number };
type Setup = { secret: string; otpauthUrl: string };

const field =
  "h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none";

export function MfaCard() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<Status | null>(null);
  const [setup, setSetup] = React.useState<Setup | null>(null);
  const [code, setCode] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [password, setPassword] = React.useState("");
  const [disableCode, setDisableCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(() => {
    fetch("/api/v1/auth/mfa", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .then(setStatus)
      .catch(() => undefined);
  }, []);
  React.useEffect(load, [load]);
  const call = async (path: string, body?: unknown, method = "POST") => {
    const res = await fetch(`/api/v1/auth/mfa/${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    if (!res.ok) throw new Error(data.detail ?? "Request failed.");
    return data;
  };
  const startSetup = async () => {
    setBusy(true);
    try {
      setSetup((await call("setup")) as Setup);
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  const enable = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = (await call("enable", { code: code.trim() })) as { recoveryCodes: string[] };
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setCode("");
      load();
      toast("Two-factor authentication enabled", { tone: "success" });
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  const disable = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await call("disable", { password, code: disableCode.trim() });
      setPassword("");
      setDisableCode("");
      setRecoveryCodes(null);
      load();
      toast("Two-factor authentication disabled", { tone: "success" });
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  if (!status) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" data-testid="mfa-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
            Two-factor authentication
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            Protect your account with an authenticator app. Required for sensitive admin decisions when enabled.
          </p>
        </div>
        <span className={`text-xs font-medium ${status.enabled ? "text-success" : "text-ink-3"}`}>
          {status.enabled ? "On" : "Off"}
        </span>
      </header>
      {recoveryCodes && (
        <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Save these recovery codes now — they are shown once.</p>
          <div className="mt-2 grid grid-cols-2 gap-1 font-mono">
            {recoveryCodes.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      )}
      {!status.enabled && !setup && (
        <Button className="mt-3" size="sm" variant="secondary" loading={busy} onClick={() => void startSetup()}>
          Set up authenticator
        </Button>
      )}
      {setup && (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-xs text-ink-2">Add this secret to your authenticator app:</p>
          <code className="block break-all rounded-lg bg-bg px-3 py-2 text-sm tracking-wider">{setup.secret}</code>
          <p className="text-[11px] break-all text-ink-3">{setup.otpauthUrl}</p>
          <form onSubmit={enable} className="flex flex-wrap gap-2">
            <input
              className={`${field} max-w-40`}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              aria-label="Authenticator code"
            />
            <Button size="sm" variant="primary" loading={busy} disabled={code.length !== 6}>
              Verify and enable
            </Button>
          </form>
        </div>
      )}
      {status.enabled && (
        <form onSubmit={disable} className="mt-3 space-y-2 rounded-xl border border-line p-3">
          <p className="text-xs text-ink-3">
            {status.recoveryCodesRemaining} recovery code(s) remaining. Disable with your password and a current code.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={field} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" aria-label="Password" />
            <input className={field} value={disableCode} onChange={(event) => setDisableCode(event.target.value)} placeholder="Authenticator or recovery code" aria-label="MFA code" />
          </div>
          <Button size="sm" variant="danger" loading={busy} disabled={!password || disableCode.length < 6}>
            Disable two-factor
          </Button>
        </form>
      )}
    </section>
  );
}
