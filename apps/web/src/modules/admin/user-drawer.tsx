"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";

import type { AdminUserRow } from "./live-sections";
import { LedgerTable } from "./live-sections";
import { adminSend, LoadState, ROLE_OPTIONS, roleLabel, useAdminData, useAdminRole, type LedgerEntry } from "./live";

type Detail = { user: AdminUserRow; ledger: LedgerEntry[] };
const CREDIT_ROLES = ["super_admin", "billing_admin", "support_admin"];
const field = "h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none";

export function UserDrawer({ userId, onClose, onChanged }: { userId: string | null; onClose: () => void; onChanged: () => void }) {
  return (
    <Drawer open={userId != null} onClose={onClose} title="Manage user" className="sm:max-w-xl">
      {userId && <UserDetail userId={userId} onChanged={onChanged} />}
    </Drawer>
  );
}

function UserDetail({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const role = useAdminRole();
  const { data, error, reload } = useAdminData<Detail>(`users/${userId}`);
  const changed = () => {
    reload();
    onChanged();
  };
  if (!data) return <LoadState error={error} testId="admin-user-detail-state" />;
  const u = data.user;
  return (
    <div className="space-y-5" data-testid="admin-user-detail">
      <div>
        <p className="text-lg font-semibold text-ink">{u.displayName}</p>
        <p className="text-sm text-ink-3">
          @{u.handle} · {u.email ?? "no email"} {u.email && (u.emailVerified ? "(verified)" : "(unverified)")}
        </p>
        <p className="mt-1 text-sm text-ink-2" data-testid="admin-user-role">
          Admin role: <span className="font-medium text-ink">{roleLabel(u.role)}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Balance label="Available" value={u.available} testId="admin-user-available" />
        <Balance label="Held" value={u.reserved} testId="admin-user-reserved" />
      </div>
      {CREDIT_ROLES.includes(role) && <CreditForm userId={userId} onDone={changed} />}
      {role === "super_admin" && <RoleForm user={u} onDone={changed} />}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Credit history</h3>
        <LedgerTable rows={data.ledger} testId="admin-user-ledger" showUser={false} />
      </div>
    </div>
  );
}

function Balance({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p data-testid={testId} className="mt-1 text-xl font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}

function CreditForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"add" | "remove">("add");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const n = Number.parseInt(amount, 10);
  const valid = Number.isInteger(n) && n > 0 && n <= 10000 && reason.trim().length >= 5;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const body = { amount: mode === "add" ? n : -n, reason: reason.trim(), requestId: `adm-${crypto.randomUUID()}` };
      const res = await adminSend<{ balance: { available: number } }>(`users/${userId}/credits`, "POST", body);
      toast(`${mode === "add" ? "Added" : "Removed"} ${n} credits · now ${res.balance.available} available`);
      setAmount("");
      setReason("");
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-line p-4" data-testid="admin-credit-form">
      <h3 className="text-sm font-semibold text-ink">Adjust credits</h3>
      <div className="flex gap-2">
        <select data-testid="admin-credit-mode" value={mode} onChange={(e) => setMode(e.target.value as "add" | "remove")} className={`${field} w-32`}>
          <option value="add">Add</option>
          <option value="remove">Remove</option>
        </select>
        <input data-testid="admin-credit-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="Credits" className={`${field} w-28`} />
      </div>
      <input data-testid="admin-credit-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
        placeholder="Reason (required, at least 5 characters)" className={field} />
      <Button type="submit" size="sm" disabled={!valid || busy} data-testid="admin-credit-submit">
        {busy ? "Saving…" : mode === "add" ? "Add credits" : "Remove credits"}
      </Button>
    </form>
  );
}

function RoleForm({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const { toast } = useToast();
  const [role, setRole] = React.useState(user.role ?? "");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const locked = user.roleSource === "env";
  const valid = role !== (user.role ?? "") && reason.trim().length >= 5;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminSend(`users/${user.id}/role`, "PUT", { role: role || null, reason: reason.trim() });
      toast(role ? `${user.handle} is now ${roleLabel(role)}` : `Removed admin role from ${user.handle}`);
      setReason("");
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-line p-4" data-testid="admin-role-form">
      <h3 className="text-sm font-semibold text-ink">Admin role</h3>
      {locked ? (
        <p className="text-sm text-ink-3">This owner account&apos;s role is set by the server configuration.</p>
      ) : (
        <>
          <select data-testid="admin-role-select" value={role} onChange={(e) => setRole(e.target.value)} className={field}>
            <option value="">No admin role</option>
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input data-testid="admin-role-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
            placeholder="Reason (required)" className={field} />
          <Button type="submit" size="sm" variant="secondary" disabled={!valid || busy} data-testid="admin-role-submit">
            {busy ? "Saving…" : "Save role"}
          </Button>
        </>
      )}
    </form>
  );
}
