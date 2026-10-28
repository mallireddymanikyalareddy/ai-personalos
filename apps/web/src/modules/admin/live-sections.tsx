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
  type AuditRow,
  type LedgerEntry,
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
      const result = await adminSend<{ applied: number; failed: number; skipped: number }>(
        "users/bulk-credits", "POST",
        {
          user_ids: ids,
          amount: mode === "add" ? n : -n,
          reason: reason.trim(),
          requestId: `bulk-${crypto.randomUUID()}`,
        });
      toast(`${result.applied} updated · ${result.failed} failed · ${result.skipped} skipped`, {
        tone: result.failed ? "danger" : "success",
      });
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
      const result = await adminSend<{ changed: number; skipped: number }>("users/bulk-role", "PUT", {
        user_ids: ids,
        role: role === "__none__" ? null : role,
        reason: reason.trim(),
      });
      toast(`${result.changed} roles updated · ${result.skipped} skipped`, {
        tone: result.skipped ? "danger" : "success",
      });
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
  return (
    <LivePage
      title="AI Usage & Costs"
      description="Every AI request with credits held and charged. Provider money cost tracking arrives with billing."
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
