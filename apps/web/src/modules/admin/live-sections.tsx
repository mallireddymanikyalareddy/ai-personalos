"use client";

import * as React from "react";

import Link from "next/link";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";

import {
  adminSend,
  dateTime,
  downloadAdminCsv,
  LiveNotice,
  LoadState,
  ROLE_OPTIONS,
  signed,
  useAdminData,
  useAdminRole,
  type ActionInsight,
  type AuditRow,
  type LedgerEntry,
  type UsageInsights,
  type TrendPoint,
  type UsageRow,
  type UsageTotals,
} from "./live";
import { inr } from "./format";
import { DataTable, PageHeader, Panel, Stat, StatusBadge } from "./ui";
import { UserDrawer } from "./user-drawer";

const axis = { fontSize: 11, fill: "var(--ink-3)" };

function LivePage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <LiveNotice text="LIVE RECORDS — loaded from the database." />
      {children}
    </div>
  );
}

function RangePicker({
  days,
  setDays,
}: {
  days: number;
  setDays: (d: number) => void;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Date range">
      {[7, 30, 90].map((value) => (
        <button
          key={value}
          type="button"
          data-testid={`admin-range-${value}d`}
          aria-pressed={days === value}
          onClick={() => setDays(value)}
          className={
            days === value
              ? "rounded-full bg-ink px-3 py-1 text-xs font-medium text-bg"
              : "rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2"
          }
        >
          Last {value}d
        </button>
      ))}
    </div>
  );
}

function TrendChart({ data, testId }: { data: TrendPoint[]; testId: string }) {
  return (
    <Panel title="AI requests & credits charged" testId={testId}>
      <div className="h-56">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="day" tick={axis} />
            <YAxis tick={axis} allowDecimals={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="credits"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.15}
            />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="#059669"
              fill="#059669"
              fillOpacity={0.1}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

type CreditSummary = {
  accounts: number;
  available: number;
  reserved: number;
  consumed: number;
  granted: number;
  removed: number;
};
type Overview = {
  users: number;
  newUsers: number;
  admins: number;
  usage: UsageTotals;
  trend: TrendPoint[];
  pendingHolds: number;
  staleHolds: number;
  subscriptions: { active: number; trialing: number; pastDue: number; total: number };
  promotions: { active: number; grants: number };
  spend: { month: string; chargedCredits: number; estimatedPaise: number; thresholdPaise: number };
  alerts: { type: string; level: string; count: number; title: string; detail: string; href: string }[];
  credits: CreditSummary;
  recentAudit: AuditRow[];
};

export function AdminDashboard() {
  const [days, setDays] = React.useState(7);
  const { data, error } = useAdminData<Overview>(`overview?days=${days}`);
  return (
    <LivePage
      title="Dashboard"
      description="Accounts, AI usage and credits at a glance."
    >
      <RangePicker days={days} setDays={setDays} />
      {!data ? (
        <LoadState error={error} testId="admin-overview-state" />
      ) : (
        <>
          <Panel title="Needs attention" testId="admin-alerts">
            {(data.alerts ?? []).length === 0 ? (
              <p className="text-sm text-ink-3" data-testid="admin-alerts-clear">
                All clear — no past-due renewals, stale holds or ledger mismatches.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {(data.alerts ?? []).map((alert) => (
                  <li key={alert.type} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0" data-testid={`admin-alert-${alert.type}`}>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        <span
                          className={
                            alert.level === "danger"
                              ? "size-2 rounded-full bg-red-500"
                              : "size-2 rounded-full bg-amber-500"
                          }
                          aria-hidden="true"
                        />
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-3">{alert.detail}</p>
                    </div>
                    <Link href={alert.href} className="text-xs font-medium text-accent-ink hover:underline">
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              testId="stat-users"
              label="Registered users"
              value={data.users.toLocaleString()}
              hint={`${data.newUsers} new in ${days}d`}
            />
            <Stat
              testId="stat-admins"
              label="Admins"
              value={String(data.admins)}
            />
            <Stat
              testId="stat-ai-requests"
              label={`AI requests (${days}d)`}
              value={String(data.usage.requests)}
              hint={`${data.usage.succeeded} succeeded · ${data.usage.failed} failed · ${data.usage.cancelled} cancelled`}
            />
            <Stat
              testId="stat-credits-charged"
              label={`Credits charged (${days}d)`}
              value={String(data.usage.creditsCharged)}
            />
            <Stat
              testId="stat-credits-available"
              label="Credits available"
              value={data.credits.available.toLocaleString()}
              hint="Across all accounts"
            />
            <Stat
              testId="stat-pending"
              label="Pending holds"
              value={String(data.pendingHolds)}
              hint={`${data.staleHolds} older than 10 min`}
            />
            <Stat
              testId="stat-subscribers"
              label="Active subscribers"
              value={(data.subscriptions.active + data.subscriptions.trialing).toLocaleString()}
              hint={`${data.subscriptions.trialing} trialing · ${data.subscriptions.total} total`}
            />
            <Stat
              testId="stat-promotion-grants"
              label="Promotion grants"
              value={data.promotions.grants.toLocaleString()}
              hint={`${data.promotions.active} active campaign${data.promotions.active === 1 ? "" : "s"}`}
            />
            <Stat
              testId="stat-ai-spend"
              label="Estimated AI spend (month)"
              value={inr(data.spend.estimatedPaise)}
              hint={`${data.spend.chargedCredits} credits · alert at ${inr(data.spend.thresholdPaise)}`}
            />
          </div>
          <TrendChart data={data.trend} testId="chart-usage" />
          <Panel
            title="Recent administrative actions"
            testId="admin-recent-audit"
          >
            <ul className="space-y-1.5 text-sm text-ink-2">
              {data.recentAudit.map((row) => (
                <li key={row.id}>
                  <span className="font-medium text-ink">{row.actor}</span> ·{" "}
                  {row.action} · {row.target_label} · {dateTime(row.created_at)}
                </li>
              ))}
              {data.recentAudit.length === 0 && (
                <li className="text-ink-3">No actions yet.</li>
              )}
            </ul>
          </Panel>
        </>
      )}
    </LivePage>
  );
}

export type AdminUserRow = {
  id: string;
  handle: string;
  email: string | null;
  displayName: string;
  joined: string;
  emailVerified: boolean;
  role: string | null;
  roleSource: string | null;
  available: number;
  reserved: number;
  included: number;
  promotional: number;
  purchased: number;
};

const CREDIT_ADMIN_ROLES = ["super_admin", "billing_admin", "support_admin"];

export function AdminUsers() {
  const { role } = useAdminRole();
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState<string[]>([]);
  const { data, error, reload } = useAdminData<{
    users: AdminUserRow[];
    total: number;
  }>(`users?q=${encodeURIComponent(query)}&limit=200`);
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const exportCsv = async (path: string, filename: string) => {
    try {
      await downloadAdminCsv(path, filename);
      toast("Export downloaded", { tone: "success" });
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    }
  };
  const canCredit = CREDIT_ADMIN_ROLES.includes(role);
  return (
    <LivePage
      title="Users"
      description="Accounts, roles and credit balances. Private content (journal, notes, documents) is never shown here."
    >
      <div className="flex flex-wrap items-end gap-2">
        <input
          data-testid="admin-users-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by handle or email..."
          className="h-9 w-full max-w-xs rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <Button size="sm" onClick={() => void exportCsv(`exports/users.csv?q=${encodeURIComponent(query)}`, "users.csv")}>
          Export users
        </Button>
        <Button size="sm" onClick={() => void exportCsv("exports/ledger.csv", "credit-ledger.csv")}>
          Export ledger
        </Button>
        <Button size="sm" onClick={() => void exportCsv("exports/audit.csv", "admin-audit.csv")}>
          Export audit
        </Button>
      </div>
      {!data ? (
        <LoadState error={error} testId="admin-users-state" />
      ) : (
        <>
          <p className="text-xs text-ink-3" data-testid="admin-users-count">
            Showing {data.users.length} of {data.total} accounts - click a row to manage
          </p>
          <DataTable
            testId="admin-users-table"
            rows={data.users}
            onRowClick={(row) => setSelected(row.id)}
            selectable
            selectedIds={checked}
            onSelectionChange={setChecked}
            columns={[
              {
                key: "handle",
                label: "User",
                render: (r) => <span className="font-medium text-ink">{r.handle}</span>,
              },
              { key: "email", label: "Email", render: (r) => r.email ?? "—" },
              {
                key: "role",
                label: "Admin role",
                render: (r) => (r.role ? <StatusBadge value={r.role} /> : "—"),
              },
              { key: "available", label: "Available", align: "right" },
              { key: "reserved", label: "Reserved", align: "right" },
              {
                key: "joined",
                label: "Joined",
                render: (r) => new Date(r.joined).toLocaleDateString("en-IN"),
              },
            ]}
          />
          {checked.length > 0 && (
            <section className="space-y-4 rounded-2xl border border-accent/30 bg-accent-soft/30 p-4" data-testid="admin-users-bulk">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{checked.length} selected</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void exportCsv(`exports/users.csv?ids=${encodeURIComponent(checked.join(","))}`, "users-selected.csv")
                    }
                  >
                    Export selected
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setChecked([])}>
                    Clear
                  </Button>
                </div>
              </div>
              {canCredit && (
                <BulkCredits
                  ids={checked}
                  onDone={() => {
                    setChecked([]);
                    reload();
                  }}
                />
              )}
              {role === "super_admin" && (
                <BulkRoles
                  ids={checked}
                  onDone={() => {
                    setChecked([]);
                    reload();
                  }}
                />
              )}
            </section>
          )}
        </>
      )}
      <UserDrawer userId={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </LivePage>
  );
}

const bulkField =
  "h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none";

function BulkCredits({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"add" | "remove">("add");
  const [amount, setAmount] = React.useState("10");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const n = Number.parseInt(amount, 10);
  const valid = Number.isInteger(n) && n > 0 && n <= 10000 && reason.trim().length >= 5;
  const submit = async () => {
    setBusy(true);
    try {
      const result = await adminSend<{ applied?: number; failed?: number; skipped?: number; approval_required?: boolean }>(
        "users/bulk-credits", "POST",
        {
          user_ids: ids,
          amount: mode === "add" ? n : -n,
          reason: reason.trim(),
          requestId: `bulk-${crypto.randomUUID()}`,
        });
      if (result.approval_required) {
        toast("Sent for approval by a second admin", { tone: "success" });
      } else {
        toast(`${result.applied ?? 0} updated - ${result.failed ?? 0} failed - ${result.skipped ?? 0} skipped`, {
          tone: result.failed ? "danger" : "success",
        });
      }
      setReason("");
      onDone();
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-3" data-testid="admin-users-bulk-credits">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Credits for selected users</p>
      <div className="grid gap-2 sm:grid-cols-[110px_110px_1fr_auto]">
        <select className={bulkField} value={mode} onChange={(e) => setMode(e.target.value as "add" | "remove")}>
          <option value="add">Add</option>
          <option value="remove">Remove</option>
        </select>
        <input className={bulkField} type="number" min={1} max={10000} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Credit amount" />
        <input className={bulkField} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (min 5 characters)" aria-label="Reason" />
        <Button size="sm" variant="primary" loading={busy} disabled={!valid} onClick={() => void submit()}>
          Apply to {ids.length}
        </Button>
      </div>
    </div>
  );
}

function BulkRoles({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { toast } = useToast();
  const [role, setRole] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const valid = role !== "" && reason.trim().length >= 5;
  const submit = async () => {
    setBusy(true);
    try {
      const result = await adminSend<{ changed?: number; skipped?: number; approval_required?: boolean }>("users/bulk-role", "PUT", {
        user_ids: ids,
        role: role === "__none__" ? null : role,
        reason: reason.trim(),
      });
      if (result.approval_required) {
        toast("Sent for approval by a second admin", { tone: "success" });
      } else {
        toast(`${result.changed ?? 0} roles updated - ${result.skipped ?? 0} skipped`, {
          tone: result.skipped ? "danger" : "success",
        });
      }
      setReason("");
      onDone();
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-3" data-testid="admin-users-bulk-role">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Admin role for selected users</p>
      <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
        <select className={bulkField} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Choose role...</option>
          {ROLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
          <option value="__none__">Remove admin role</option>
        </select>
        <input className={bulkField} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (min 5 characters)" aria-label="Reason" />
        <Button size="sm" variant="primary" loading={busy} disabled={!valid} onClick={() => void submit()}>
          Apply to {ids.length}
        </Button>
      </div>
    </div>
  );
}

export function LedgerTable({
  rows,
  testId,
  showUser = true,
}: {
  rows: LedgerEntry[];
  testId: string;
  showUser?: boolean;
}) {
  return (
    <DataTable
      testId={testId}
      rows={rows}
      search={(row) => `${row.handle ?? ""} ${row.type} ${row.reason}`}
      columns={[
        {
          key: "created_at",
          label: "When",
          render: (r) => dateTime(r.created_at),
        },
        ...(showUser ? [{ key: "handle", label: "User" }] : []),
        {
          key: "type",
          label: "Type",
          render: (r: LedgerEntry) => <StatusBadge value={r.type} />,
        },
        {
          key: "available_delta",
          label: "Available",
          align: "right" as const,
          render: (r: LedgerEntry) => signed(r.available_delta),
        },
        {
          key: "reserved_delta",
          label: "Held",
          align: "right" as const,
          render: (r: LedgerEntry) => signed(r.reserved_delta),
        },
        { key: "reason", label: "Reason" },
        { key: "actor", label: "By" },
      ]}
    />
  );
}

export function AdminCredits() {
  const summary = useAdminData<CreditSummary>("credits/summary");
  const ledger = useAdminData<{ entries: LedgerEntry[] }>(
    "credits/ledger?limit=300",
  );
  const s = summary.data;
  return (
    <LivePage
      title="Credit Management"
      description="Append-only credit history. Balances change only through grants, holds, charges and returns, never by direct edits."
    >
      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            testId="stat-available"
            label="Available"
            value={s.available.toLocaleString()}
            hint={`${s.accounts} accounts`}
          />
          <Stat
            testId="stat-reserved"
            label="Held"
            value={String(s.reserved)}
          />
          <Stat
            testId="stat-consumed"
            label="Charged"
            value={String(s.consumed)}
          />
          <Stat
            testId="stat-granted"
            label="Granted"
            value={s.granted.toLocaleString()}
            hint={`${s.removed} removed by admins`}
          />
        </div>
      )}
      {!ledger.data ? (
        <LoadState error={ledger.error} testId="admin-ledger-state" />
      ) : (
        <LedgerTable rows={ledger.data.entries} testId="admin-ledger-table" />
      )}
    </LivePage>
  );
}

export function AdminUsage() {
  const [days, setDays] = React.useState(7);
  const { data, error } = useAdminData<{
    totals: UsageTotals;
    trend: TrendPoint[];
    requests: UsageRow[];
  }>(`usage?days=${days}&limit=200`);
  const insights = useAdminData<UsageInsights>(`usage/insights?days=${days}`);
  return (
    <LivePage
      title="AI Usage & Costs"
      description="Requests, credits, provider-cost estimates and plan margins. Set token costs in Platform Settings."
    >
      <RangePicker days={days} setDays={setDays} />
      {!data ? (
        <LoadState error={error} testId="admin-usage-state" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              testId="stat-usage-requests"
              label="Requests"
              value={String(data.totals.requests)}
            />
            <Stat
              testId="stat-usage-succeeded"
              label="Succeeded"
              value={String(data.totals.succeeded)}
            />
            <Stat
              testId="stat-usage-failed"
              label="Failed / cancelled"
              value={`${data.totals.failed} / ${data.totals.cancelled}`}
            />
            <Stat
              testId="stat-usage-credits"
              label="Credits charged"
              value={String(data.totals.creditsCharged)}
            />
          </div>
          {insights.data && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat testId="stat-cost-mtd" label="Estimated AI spend (MTD)"
                      value={inr(insights.data.month.spendPaise)}
                      hint={`Projected ${inr(insights.data.month.projectedPaise)} this month`} />
                <Stat testId="stat-cost-credit" label="Estimated cost / credit"
                      value={inr(insights.data.costPerCreditPaise)} />
                <Stat testId="stat-month-credits" label="Credits charged (MTD)"
                      value={insights.data.month.credits.toLocaleString()} />
                <Stat testId="stat-cost-tokens" label="Tokens (range)"
                      value={`${(insights.data.totals.inputTokens / 1000).toFixed(1)}k / ${(insights.data.totals.outputTokens / 1000).toFixed(1)}k`}
                      hint="Input / output, estimated" />
              </div>
              <DataTable
                testId="admin-usage-actions"
                rows={insights.data.byAction.map((item) => ({ ...item, id: item.action }))}
                columns={[
                  { key: "action", label: "Action", render: (r) => <code className="text-xs">{r.action}</code> },
                  { key: "calls", label: "Calls", align: "right" },
                  { key: "credits", label: "Credits", align: "right" },
                  { key: "costPaise", label: "Est. cost", align: "right", render: (r) => inr(r.costPaise) },
                  { key: "avgMs", label: "Avg ms", align: "right" },
                  { key: "priceCredits", label: "Current price", align: "right" },
                ]}
              />
              <DataTable
                testId="admin-plan-margins"
                rows={insights.data.plans.map((item) => ({ ...item, id: item.planId }))}
                columns={[
                  { key: "name", label: "Plan" },
                  { key: "subscribers", label: "Subscribers", align: "right" },
                  { key: "monthlyRevenuePaise", label: "Monthly revenue", align: "right", render: (r) => inr(r.monthlyRevenuePaise) },
                  { key: "monthlyCredits", label: "Credits / month", align: "right" },
                  { key: "costPerSubscriberPaise", label: "Est. cost / sub", align: "right", render: (r) => inr(r.costPerSubscriberPaise) },
                  { key: "marginPaise", label: "Est. margin", align: "right", render: (r) => inr(r.marginPaise) },
                ]}
              />
              <PricingSimulator key={days} actions={insights.data.byAction} />
            </>
          )}
          <TrendChart data={data.trend} testId="chart-cost" />
          <DataTable
            testId="admin-usage-table"
            rows={data.requests}
            search={(row) => `${row.handle ?? ""} ${row.action} ${row.status}`}
            columns={[
              {
                key: "created_at",
                label: "When",
                render: (r) => dateTime(r.created_at),
              },
              { key: "handle", label: "User" },
              {
                key: "action",
                label: "Action",
                render: (r) => <code className="text-xs">{r.action}</code>,
              },
              { key: "model", label: "Model" },
              {
                key: "est_output_tokens",
                label: "Out tok (est.)",
                align: "right",
              },
              { key: "reserved", label: "Held", align: "right" },
              { key: "charged", label: "Charged", align: "right" },
              { key: "ms", label: "ms", align: "right" },
              {
                key: "status",
                label: "Status",
                render: (r) => <StatusBadge value={r.status} />,
              },
            ]}
          />
        </>
      )}
    </LivePage>
  );
}

function PricingSimulator({ actions }: { actions: ActionInsight[] }) {
  const [prices, setPrices] = React.useState<Record<string, string>>(
    () => Object.fromEntries(actions.map((item) => [item.action, String(item.priceCredits)])),
  );
  const current = actions.reduce((sum, item) => sum + item.credits, 0);
  const projected = actions.reduce((sum, item) => sum + (Number(prices[item.action] ?? 0) || 0) * item.calls, 0);
  return (
    <Panel title="Pricing simulator" testId="admin-pricing-simulator">
      <p className="mb-3 text-xs text-ink-3">
        Change an action&apos;s credit price to see the projected credits for the selected usage volume. Provider cost does not change.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((item) => (
          <label key={item.action} className="text-xs">
            <span className="mb-1 block font-medium text-ink-2">{item.action}</span>
            <div className="flex items-center gap-2">
              <input
                className="h-8 w-20 rounded-lg border border-line bg-bg px-2 text-sm text-ink focus:border-accent focus:outline-none"
                type="number"
                min={0}
                max={1000}
                value={prices[item.action] ?? "0"}
                onChange={(event) => setPrices((prev) => ({ ...prev, [item.action]: event.target.value }))}
                aria-label={`${item.action} credit price`}
              />
              <span className="text-ink-3">cr × {item.calls} calls</span>
            </div>
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-2" data-testid="admin-pricing-simulator-result">
        Current volume: <strong className="text-ink">{current.toLocaleString()}</strong> credits · Simulated:{" "}
        <strong className="text-ink">{projected.toLocaleString()}</strong> credits (
        {projected - current >= 0 ? "+" : ""}
        {(projected - current).toLocaleString()})
      </p>
    </Panel>
  );
}

type ApprovalRow = {
  id: string;
  action: string;
  target_user_id: string;
  target_handle: string;
  payload: { amount?: number; role?: string | null; user_ids?: string[] };
  reason: string;
  requested_by_handle: string;
  requested_role: string;
  status: string;
  created_at: string;
  decided_by_handle: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

const CREDIT_APPROVAL_ROLES = ["super_admin", "billing_admin", "support_admin"];

export function AdminApprovals() {
  const { role } = useAdminRole();
  const { data, error, reload } = useAdminData<{ approvals: ApprovalRow[] }>("approvals?status=pending");
  const [selected, setSelected] = React.useState<ApprovalRow | null>(null);
  return (
    <LivePage
      title="Approvals"
      description="Large credit changes and role changes need a second admin. You can't approve your own request."
    >
      {!data ? (
        <LoadState error={error} testId="admin-approvals-state" />
      ) : (
        <>
          <p className="text-xs text-ink-3" data-testid="admin-approvals-count">
            {data.approvals.length} request{data.approvals.length === 1 ? "" : "s"} waiting.
          </p>
          <DataTable
            testId="admin-approvals-table"
            rows={data.approvals}
            search={(row) => `${row.action} ${row.target_handle} ${row.requested_by_handle} ${row.reason}`}
            onRowClick={setSelected}
            columns={[
              { key: "created_at", label: "When", render: (r) => dateTime(r.created_at) },
              { key: "action", label: "Action", render: (r) => <StatusBadge value={r.action} /> },
              { key: "target_handle", label: "Target", render: (r) => `@${r.target_handle}` },
              { key: "requested_by_handle", label: "Requested by", render: (r) => `@${r.requested_by_handle}` },
              {
                key: "payload",
                label: "Request",
                render: (r) =>
                  r.action.includes("credit")
                    ? `${r.payload.amount ?? 0} credits${r.payload.user_ids ? ` × ${r.payload.user_ids.length} users` : ""}`
                    : `Role: ${r.payload.role ?? "remove"}`,
              },
              { key: "reason", label: "Reason" },
            ]}
          />
        </>
      )}
      {selected && (
        <ApprovalDrawer
          approval={selected}
          role={role}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </LivePage>
  );
}

function ApprovalDrawer({
  approval,
  role,
  onClose,
  onDone,
}: {
  approval: ApprovalRow;
  role: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [needsMfa, setNeedsMfa] = React.useState(false);
  const [mfaCode, setMfaCode] = React.useState("");
  const canApprove =
    role === "super_admin" ||
    (approval.action.includes("credit") && CREDIT_APPROVAL_ROLES.includes(role));
  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    try {
      await adminSend(`approvals/${approval.id}/${decision}`, "POST", { reason: reason.trim() });
      toast(decision === "approve" ? "Request approved" : "Request rejected", { tone: "success" });
      onDone();
    } catch (err) {
      const message = (err as Error).message;
      if (message.toLowerCase().includes("authenticator")) setNeedsMfa(true);
      toast(message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  const stepUp = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/step-up", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) throw new Error(data.detail ?? "Verification failed.");
      setNeedsMfa(false);
      setMfaCode("");
      toast("Verified. You can approve or reject now.", { tone: "success" });
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer open onClose={onClose} title="Approval request" className="sm:max-w-lg">
      <div className="space-y-4 p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Action", approval.action.replace(/_/g, " ")],
            ["Target", `@${approval.target_handle}`],
            ["Requested by", `@${approval.requested_by_handle}`],
            ["Request", approval.action.includes("credit")
              ? `${approval.payload.amount ?? 0} credits${approval.payload.user_ids ? ` for ${approval.payload.user_ids.length} users` : ""}`
              : `Role: ${approval.payload.role ?? "remove"}`],
            ["Reason", approval.reason],
            ["Created", dateTime(approval.created_at)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-surface-2 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</dt>
              <dd className="mt-1 font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {canApprove ? (
          <>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-ink-2">Decision note (recorded in the audit log)</span>
              <input
                className="h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why are you approving or rejecting this?"
              />
            </label>
            {needsMfa && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900">
                  Enter your authenticator code to unlock this decision.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-9 w-36 rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.trim())}
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="6-digit code"
                    aria-label="Authenticator code"
                  />
                  <Button size="sm" loading={busy} disabled={mfaCode.length < 6} onClick={() => void stepUp()}>
                    Verify
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="primary"
                loading={busy}
                disabled={reason.trim().length < 5}
                onClick={() => void decide("approve")}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                loading={busy}
                disabled={reason.trim().length < 5}
                onClick={() => void decide("reject")}
              >
                Reject
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-3">Your role can view this request but not decide it.</p>
        )}
      </div>
    </Drawer>
  );
}

export function AdminAudit() {
  const { data, error } = useAdminData<{ entries: AuditRow[] }>(
    "audit?limit=300",
  );
  return (
    <LivePage
      title="Audit Logs"
      description="Read-only, append-only record of administrative and system actions."
    >
      {!data ? (
        <LoadState error={error} testId="admin-audit-state" />
      ) : (
        <DataTable
          testId="admin-audit-table"
          rows={data.entries}
          search={(row) =>
            `${row.actor} ${row.action} ${row.target_id} ${row.target_label} ${row.reason}`
          }
          columns={[
            {
              key: "created_at",
              label: "When",
              render: (r) => (
                <span className="whitespace-nowrap">
                  {dateTime(r.created_at)}
                </span>
              ),
            },
            { key: "actor", label: "Admin" },
            {
              key: "role",
              label: "Role",
              render: (r) => r.role?.replace(/_/g, " ") ?? "system",
            },
            {
              key: "action",
              label: "Action",
              render: (r) => <code className="text-xs">{r.action}</code>,
            },
            {
              key: "target_id",
              label: "Target",
              render: (r) => (
                <span
                  title={r.target_id}
                  className="block min-w-[180px] max-w-[260px] truncate"
                >
                  {r.target_type === "route"
                    ? r.target_label
                    : `${r.target_type} ${r.target_label}`}
                </span>
              ),
            },
            { key: "reason", label: "Reason" },
            {
              key: "details",
              label: "Details",
              render: (r) => (
                <code
                  title={JSON.stringify(r.details)}
                  className="block max-w-[220px] truncate text-[11px]"
                >
                  {JSON.stringify(r.details)}
                </code>
              ),
            },
            {
              key: "outcome",
              label: "Outcome",
              render: (r) => <StatusBadge value={r.outcome} />,
            },
          ]}
        />
      )}
    </LivePage>
  );
}
