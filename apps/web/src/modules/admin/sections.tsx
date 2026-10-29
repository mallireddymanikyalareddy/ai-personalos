"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";

import {
  adminSend,
  dateTime,
  LiveNotice,
  LoadState,
  shortDate,
  useAdminData,
  useAdminRole,
  type LivePlan,
} from "./live";
import { inr } from "./format";
import { DataTable, PageHeader, Panel, StatusBadge } from "./ui";

const field =
  "h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none";
const textarea =
  "min-h-20 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

function liveLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

function Reason({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <Field label="Reason (recorded in the audit log)" hint="At least 5 characters.">
      <input
        data-testid={testId}
        className={field}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Why are you making this change?"
      />
    </Field>
  );
}

function LivePage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />
      <LiveNotice text="LIVE RECORDS — loaded from the database." />
      {children}
    </div>
  );
}

function useMutations(onDone: () => void) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = React.useCallback(
    async (key: string, fn: () => Promise<unknown>, ok: string) => {
      setBusy(key);
      try {
        await fn();
        toast(ok, { tone: "success" });
        onDone();
        return true;
      } catch (error) {
        toast((error as Error).message, { tone: "danger" });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [onDone, toast],
  );
  return { busy, run };
}

type SubRow = {
  id: string;
  userId: string;
  handle: string | null;
  email: string | null;
  planId: string;
  plan: string;
  planVersion: number;
  billing: string;
  status: string;
  payment: string;
  start: string;
  periodStart: string;
  periodEnd: string;
  trialEnds: string | null;
  cancelAtPeriodEnd: boolean;
};

type SubDetail = {
  subscription: SubRow;
  events: { id: string; type: string; actor: string; created_at: string }[];
  runs: {
    id: string;
    kind: string;
    credits: number;
    status: string;
    period_start: string;
    period_end: string;
  }[];
};

const WRITE_SUBS = ["super_admin", "billing_admin", "support_admin"];

export function AdminSubscriptions() {
  const { role } = useAdminRole();
  const canWrite = WRITE_SUBS.includes(role);
  const { data, error, reload } = useAdminData<{ subscriptions: SubRow[] }>("subscriptions");
  const [creating, setCreating] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <LivePage
      title="Subscriptions"
      description="Plan, billing period, entitlement period and status for each user. Payments are handled manually until Razorpay is connected."
      actions={
        canWrite ? (
          <Button variant="primary" onClick={() => setCreating(true)} data-testid="admin-subscription-new">
            New subscription
          </Button>
        ) : undefined
      }
    >
      {!data ? (
        <LoadState error={error} testId="admin-subscriptions-state" />
      ) : (
        <DataTable
          testId="admin-subscriptions-table"
          rows={data.subscriptions}
          search={(row) => `${row.id} ${row.handle ?? ""} ${row.email ?? ""} ${row.plan} ${row.status}`}
          onRowClick={(row) => setSelected(row.id)}
          columns={[
            { key: "handle", label: "User", render: (r) => <span className="font-medium text-ink">@{r.handle ?? "—"}</span> },
            { key: "plan", label: "Plan" },
            { key: "billing", label: "Billing" },
            { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
            {
              key: "period",
              label: "Current period",
              render: (r) => `${shortDate(r.periodStart)} – ${shortDate(r.periodEnd)}`,
            },
            {
              key: "renewal",
              label: "Next renewal",
              render: (r) => (r.cancelAtPeriodEnd ? "Cancel at period end" : shortDate(r.periodEnd)),
            },
            { key: "payment", label: "Payment", render: (r) => <StatusBadge value={r.payment} /> },
          ]}
        />
      )}
      {canWrite && <CreateSubscription open={creating} onClose={() => setCreating(false)} onDone={reload} />}
      {selected && (
        <SubscriptionDrawer
          id={selected}
          role={role}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </LivePage>
  );
}

function CreateSubscription({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const plans = useAdminData<{ plans: LivePlan[] }>("plans");
  const { busy, run } = useMutations(() => {
    onDone();
    onClose();
  });
  const [identifier, setIdentifier] = React.useState("");
  const [planId, setPlanId] = React.useState("ai");
  const [billing, setBilling] = React.useState("monthly");
  const [trialDays, setTrialDays] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [reason, setReason] = React.useState("");
  const valid = identifier.trim().length > 0 && reason.trim().length >= 5;
  return (
    <Drawer open={open} onClose={onClose} title="New subscription" description="Assign a plan to an existing user.">
      <div className="space-y-4 p-5">
        <Field label="User" hint="Handle, email or user ID.">
          <input
            data-testid="admin-subscription-user"
            className={field}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="e.g. mallireddy-manikyalareddy"
          />
        </Field>
        <Field label="Plan">
          <select className={field} value={planId} onChange={(event) => setPlanId(event.target.value)}>
            {(plans.data?.plans ?? []).map((plan) => (
              <option key={plan.plan_id} value={plan.plan_id}>
                {plan.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Billing period">
          <select className={field} value={billing} onChange={(event) => setBilling(event.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </Field>
        <Field label="Trial days" hint="Leave empty to use the plan's default.">
          <input
            className={field}
            type="number"
            min={0}
            max={365}
            value={trialDays}
            onChange={(event) => setTrialDays(event.target.value)}
          />
        </Field>
        <Field label="Starting status" hint="Leave empty to start a trial when the plan has trial days.">
          <select className={field} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Automatic</option>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
          </select>
        </Field>
        <Reason value={reason} onChange={setReason} testId="admin-subscription-reason" />
        <Button
          variant="primary"
          className="w-full"
          loading={busy === "create"}
          disabled={!valid}
          onClick={() =>
            void run(
              "create",
              () =>
                adminSend("subscriptions", "POST", {
                  identifier: identifier.trim(),
                  plan_id: planId,
                  billing_period: billing,
                  trial_days: trialDays === "" ? null : Number(trialDays),
                  status: status || null,
                  reason: reason.trim(),
                }),
              "Subscription created",
            )
          }
        >
          Create subscription
        </Button>
      </div>
    </Drawer>
  );
}

function SubscriptionDrawer({
  id,
  role,
  onClose,
  onChanged,
}: {
  id: string;
  role: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, error, reload } = useAdminData<SubDetail>(`subscriptions/${id}`);
  const plans = useAdminData<{ plans: LivePlan[] }>("plans");
  const { busy, run } = useMutations(() => {
    reload();
    onChanged();
  });
  const [reason, setReason] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [planId, setPlanId] = React.useState("");
  const [billing, setBilling] = React.useState("");
  const [paymentStatus, setPaymentStatus] = React.useState("");
  const [preview, setPreview] = React.useState<{
    estimatedProrationPaise: number;
    daysLeft: number;
    newAllowance: number;
    note: string;
  } | null>(null);
  const loadPreview = async () => {
    const res = await fetch(
      `/api/v1/admin/subscriptions/${id}/change-preview?plan_id=${planId}&billing_period=${billing}`,
      { credentials: "include", cache: "no-store" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setPreview(data);
  };
  const canWrite = WRITE_SUBS.includes(role);
  const auditReady = reason.trim().length >= 5;
  const sub = data?.subscription;
  React.useEffect(() => {
    if (!sub) return;
    setPlanId(sub.planId);
    setBilling(sub.billing);
    setPaymentStatus(sub.payment);
  }, [sub]);
  const act = (key: string, path: string, method: "POST" | "PUT", body: unknown, ok: string) =>
    void run(key, () => adminSend(path, method, body), ok);
  return (
    <Drawer open onClose={onClose} title="Subscription" description={sub ? `@${sub.handle ?? "—"}` : undefined} className="sm:max-w-xl">
      <div className="space-y-5 p-5">
        {!data || !sub ? (
          <LoadState error={error} testId="admin-subscription-detail-state" />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Plan", `${sub.plan} (v${sub.planVersion})`],
                ["Billing", sub.billing],
                ["Status", sub.status],
                ["Payment", sub.payment],
                ["Period", `${shortDate(sub.periodStart)} – ${shortDate(sub.periodEnd)}`],
                ["Trial ends", sub.trialEnds ? shortDate(sub.trialEnds) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-surface-2 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</dt>
                  <dd className="mt-1 font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {canWrite && (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <Reason value={reason} onChange={setReason} testId="admin-subscription-action-reason" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    loading={busy === "renew"}
                    disabled={!auditReady}
                    onClick={() => act("renew", `subscriptions/${id}/renew`, "POST", { reason: reason.trim() }, "Period renewed")}
                  >
                    Renew now
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === "grant"}
                    disabled={!auditReady}
                    onClick={() => act("grant", `subscriptions/${id}/grant`, "POST", { reason: reason.trim() }, "Period credits granted")}
                  >
                    Grant period credits
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === "cancel"}
                    disabled={!auditReady || sub.status === "expired"}
                    onClick={() =>
                      act("cancel", `subscriptions/${id}/cancel`, "POST", { at_period_end: true, reason: reason.trim() }, "Cancellation scheduled")
                    }
                  >
                    Cancel at period end
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busy === "cancel-now"}
                    disabled={!auditReady || sub.status === "expired"}
                    onClick={() =>
                      act("cancel-now", `subscriptions/${id}/cancel`, "POST", { at_period_end: false, reason: reason.trim() }, "Subscription canceled")
                    }
                  >
                    Cancel now
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === "resume"}
                    disabled={!auditReady || sub.status === "expired"}
                    onClick={() => act("resume", `subscriptions/${id}/resume`, "POST", { reason: reason.trim() }, "Subscription resumed")}
                  >
                    Resume
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Change status">
                    <select className={field} value={status} onChange={(event) => setStatus(event.target.value)}>
                      <option value="">Choose status</option>
                      {["trialing", "active", "past_due", "canceled", "expired"].map((value) => (
                        <option key={value} value={value}>
                          {value.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    size="sm"
                    loading={busy === "status"}
                    disabled={!auditReady || !status}
                    onClick={() =>
                      act("status", `subscriptions/${id}`, "PUT", { status, reason: reason.trim() }, "Status updated")
                    }
                  >
                    Save status
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Payment status">
                    <select className={field} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                      {["manual", "paid", "failed", "refunded"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    size="sm"
                    loading={busy === "payment"}
                    disabled={!auditReady || !paymentStatus || paymentStatus === sub.payment}
                    onClick={() =>
                      act("payment", `subscriptions/${id}`, "PUT",
                        { payment_status: paymentStatus, reason: reason.trim() }, "Payment status updated")
                    }
                  >
                    Save payment status
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Plan">
                    <select className={field} value={planId} onChange={(event) => setPlanId(event.target.value)}>
                      {(plans.data?.plans ?? []).map((plan) => (
                        <option key={plan.plan_id} value={plan.plan_id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Billing period">
                    <select className={field} value={billing} onChange={(event) => setBilling(event.target.value)}>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={planId === sub.planId && billing === sub.billing}
                    onClick={() => void loadPreview()}
                    data-testid="admin-subscription-preview"
                  >
                    Preview change
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === "plan"}
                    disabled={!auditReady || (planId === sub.planId && billing === sub.billing)}
                    onClick={() =>
                      act("plan", `subscriptions/${id}`, "PUT",
                        { plan_id: planId, billing_period: billing, reason: reason.trim() }, "Subscription updated")
                    }
                    data-testid="admin-subscription-change-plan"
                  >
                    Change plan or billing cycle
                  </Button>
                </div>
                {preview && (
                  <div className="rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-2" data-testid="admin-subscription-preview-result">
                    <p>
                      {preview.daysLeft} day{preview.daysLeft === 1 ? "" : "s"} left · new allowance{" "}
                      <strong className="text-ink">{preview.newAllowance}</strong> credits.
                    </p>
                    <p className="mt-1">
                      Estimated proration:{" "}
                      <strong className="text-ink">{inr(preview.estimatedProrationPaise)}</strong>.
                    </p>
                    <p className="mt-1 text-ink-3">{preview.note}</p>
                  </div>
                )}
              </div>
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Entitlement runs</h3>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Credits</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.runs.map((run) => (
                      <tr key={run.id} className="border-t border-line/60">
                        <td className="px-3 py-2">{shortDate(run.period_start)} – {shortDate(run.period_end)}</td>
                        <td className="px-3 py-2 tabular-nums">{run.credits}</td>
                        <td className="px-3 py-2"><StatusBadge value={run.status} /></td>
                      </tr>
                    ))}
                    {data.runs.length === 0 && (
                      <tr><td className="px-3 py-4 text-ink-3" colSpan={3}>No grants yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Recent events</h3>
              <ul className="space-y-1.5 text-sm text-ink-2">
                {data.events.slice(0, 10).map((event) => (
                  <li key={event.id} className="flex justify-between gap-3">
                    <span>{event.type.replace(/_/g, " ")}</span>
                    <span className="text-ink-3">{dateTime(event.created_at)} · {event.actor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

type Promo = {
  id: string;
  name: string;
  credits: number;
  eligibility: string;
  starts_at: string;
  ends_at: string;
  per_user_limit: number;
  credit_expiry_days: number;
  segment_days: number;
  user_ids: string[];
  auto_grant: boolean;
  code: string | null;
  status: string;
  granted: number;
  activeGrants: number;
};

type PromoDetail = {
  promotion: Promo;
  grants: { id: string; handle: string; credits: number; status: string; granted_at: string; expires_at: string | null }[];
};

const WRITE_PROMOS = ["super_admin", "billing_admin"];

export function AdminPromotions() {
  const { role } = useAdminRole();
  const canWrite = WRITE_PROMOS.includes(role);
  const { data, error, reload } = useAdminData<{ promotions: Promo[] }>("promotions");
  const [creating, setCreating] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <LivePage
      title="Promotions & Grants"
      description="Campaigns that grant promotional credits with eligibility, limits and expiry."
      actions={
        canWrite ? (
          <Button variant="primary" onClick={() => setCreating(true)} data-testid="admin-promotion-new">
            New promotion
          </Button>
        ) : undefined
      }
    >
      {!data ? (
        <LoadState error={error} testId="admin-promotions-state" />
      ) : (
        <DataTable
          testId="admin-promotions-table"
          rows={data.promotions}
          search={(row) => `${row.name} ${row.eligibility} ${row.status}`}
          onRowClick={(row) => setSelected(row.id)}
          columns={[
            { key: "name", label: "Campaign", render: (r) => <span className="font-medium text-ink">{r.name}</span> },
            { key: "credits", label: "Credits", align: "right" },
            { key: "eligibility", label: "Eligibility" },
            { key: "code", label: "Code", render: (r) => (r.code ? <code className="text-xs">{r.code}</code> : "—") },
            { key: "auto_grant", label: "Auto", render: (r) => (r.auto_grant ? "Scheduled" : "Manual") },
            { key: "starts_at", label: "Starts", render: (r) => shortDate(r.starts_at) },
            { key: "ends_at", label: "Ends", render: (r) => shortDate(r.ends_at) },
            { key: "expiry", label: "Credit expiry", render: (r) => (r.credit_expiry_days ? `${r.credit_expiry_days} days` : "Never") },
            { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
            { key: "granted", label: "Granted", align: "right", render: (r) => `${r.granted} (${r.activeGrants} active)` },
          ]}
        />
      )}
      {canWrite && <CreatePromotion open={creating} onClose={() => setCreating(false)} onDone={reload} />}
      {selected && (
        <PromotionDrawer
          id={selected}
          role={role}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </LivePage>
  );
}

function CreatePromotion({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const plans = useAdminData<{ plans: LivePlan[] }>("plans");
  const { busy, run } = useMutations(() => {
    onDone();
    onClose();
  });
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [name, setName] = React.useState("");
  const [credits, setCredits] = React.useState("10");
  const [eligibility, setEligibility] = React.useState("all");
  const [startsAt, setStartsAt] = React.useState(liveLocal(now.toISOString()));
  const [endsAt, setEndsAt] = React.useState(liveLocal(later.toISOString()));
  const [limit, setLimit] = React.useState("1");
  const [expiry, setExpiry] = React.useState("30");
  const [segmentDays, setSegmentDays] = React.useState("30");
  const [userIds, setUserIds] = React.useState("");
  const [autoGrant, setAutoGrant] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [reason, setReason] = React.useState("");
  const valid = name.trim().length >= 3 && Number(credits) > 0 && reason.trim().length >= 5;
  return (
    <Drawer open={open} onClose={onClose} title="New promotion">
      <div className="space-y-4 p-5">
        <Field label="Campaign name">
          <input className={field} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Credits per user">
          <input className={field} type="number" min={1} value={credits} onChange={(event) => setCredits(event.target.value)} />
        </Field>
        <Field label="Eligibility">
          <select className={field} value={eligibility} onChange={(event) => setEligibility(event.target.value)}>
            <option value="all">All users</option>
            <option value="new">New users</option>
            <option value="trial">Trial subscribers</option>
            <option value="inactive">Inactive AI users</option>
            <option value="low_credit">Low-credit users</option>
            <option value="users">Specific users</option>
            {(plans.data?.plans ?? []).map((plan) => (
              <option key={plan.plan_id} value={`plan:${plan.plan_id}`}>
                {plan.name} subscribers
              </option>
            ))}
          </select>
        </Field>
        {(eligibility === "new" || eligibility === "inactive") && (
          <Field label="Segment window (days)" hint="New = joined within; inactive = no AI usage within.">
            <input className={field} type="number" min={1} max={365} value={segmentDays} onChange={(event) => setSegmentDays(event.target.value)} />
          </Field>
        )}
        {eligibility === "users" && (
          <Field label="Users" hint="Comma-separated handles, emails or user IDs.">
            <textarea className={textarea} value={userIds} onChange={(event) => setUserIds(event.target.value)} placeholder="alice, bob@example.com" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Coupon code" hint="Optional; users can redeem it.">
            <input className={field} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="WELCOME10" />
          </Field>
          <Field label="Scheduled grant" hint="Grant automatically every 6 hours while active.">
            <label className="flex h-9 items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={autoGrant} onChange={(event) => setAutoGrant(event.target.checked)} />
              Enable auto-grant
            </label>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input className={field} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </Field>
          <Field label="Ends">
            <input className={field} type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Per-user limit">
            <input className={field} type="number" min={1} value={limit} onChange={(event) => setLimit(event.target.value)} />
          </Field>
          <Field label="Credit expiry (days)" hint="0 means never.">
            <input className={field} type="number" min={0} value={expiry} onChange={(event) => setExpiry(event.target.value)} />
          </Field>
        </div>
        <Reason value={reason} onChange={setReason} testId="admin-promotion-reason" />
        <Button
          variant="primary"
          className="w-full"
          loading={busy === "create"}
          disabled={!valid}
          onClick={() =>
            void run(
              "create",
              () =>
                adminSend("promotions", "POST", {
                  name: name.trim(),
                  credits: Number(credits),
                  eligibility,
                  starts_at: new Date(startsAt).toISOString(),
                  ends_at: new Date(endsAt).toISOString(),
                  per_user_limit: Number(limit),
                  credit_expiry_days: Number(expiry),
                  segment_days: Number(segmentDays),
                  user_ids: userIds.split(",").map((value) => value.trim()).filter(Boolean),
                  auto_grant: autoGrant,
                  code: code.trim() || null,
                  reason: reason.trim(),
                }),
              "Promotion created as a draft",
            )
          }
        >
          Create promotion
        </Button>
      </div>
    </Drawer>
  );
}

function PromotionDrawer({
  id,
  role,
  onClose,
  onChanged,
}: {
  id: string;
  role: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, error, reload } = useAdminData<PromoDetail>(`promotions/${id}`);
  const { busy, run } = useMutations(() => {
    reload();
    onChanged();
  });
  const [reason, setReason] = React.useState("");
  const canWrite = WRITE_PROMOS.includes(role);
  const auditReady = reason.trim().length >= 5;
  const promo = data?.promotion;
  return (
    <Drawer open onClose={onClose} title="Promotion" description={promo?.name} className="sm:max-w-xl">
      <div className="space-y-5 p-5">
        {!data || !promo ? (
          <LoadState error={error} testId="admin-promotion-detail-state" />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Status", promo.status],
                ["Credits each", String(promo.credits)],
                ["Eligibility", promo.eligibility],
                ["Coupon code", promo.code ?? "—"],
                ["Grant mode", promo.auto_grant ? "Scheduled (6h)" : "Manual"],
                ["Window", `${shortDate(promo.starts_at)} - ${shortDate(promo.ends_at)}`],
                ["Credit expiry", promo.credit_expiry_days ? `${promo.credit_expiry_days} days` : "Never"],
                ["Granted", `${promo.granted} (${promo.activeGrants} active)`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-surface-2 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</dt>
                  <dd className="mt-1 font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {canWrite && (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <Reason value={reason} onChange={setReason} testId="admin-promotion-action-reason" />
                <div className="flex flex-wrap gap-2">
                  {promo.status === "draft" && (
                    <Button
                      size="sm"
                      loading={busy === "activate"}
                      disabled={!auditReady}
                      onClick={() => void run("activate", () => adminSend(`promotions/${id}/activate`, "POST", { reason: reason.trim() }), "Promotion activated")}
                    >
                      Activate
                    </Button>
                  )}
                  {promo.status === "active" && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={busy === "grant"}
                        disabled={!auditReady}
                        onClick={() => void run("grant", () => adminSend(`promotions/${id}/grant`, "POST", { reason: reason.trim() }), "Credits granted")}
                      >
                        Grant now
                      </Button>
                      <Button
                        size="sm"
                        loading={busy === "end"}
                        disabled={!auditReady}
                        onClick={() => void run("end", () => adminSend(`promotions/${id}/end`, "POST", { reason: reason.trim() }), "Promotion ended")}
                      >
                        End promotion
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Grants</h3>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-3">
                    <tr>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Credits</th>
                      <th className="px-3 py-2">Granted</th>
                      <th className="px-3 py-2">Expires</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grants.map((grant) => (
                      <tr key={grant.id} className="border-t border-line/60">
                        <td className="px-3 py-2">@{grant.handle}</td>
                        <td className="px-3 py-2 tabular-nums">{grant.credits}</td>
                        <td className="px-3 py-2">{shortDate(grant.granted_at)}</td>
                        <td className="px-3 py-2">{grant.expires_at ? shortDate(grant.expires_at) : "Never"}</td>
                        <td className="px-3 py-2"><StatusBadge value={grant.status} /></td>
                      </tr>
                    ))}
                    {data.grants.length === 0 && (
                      <tr><td className="px-3 py-4 text-ink-3" colSpan={5}>No grants yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

type Settings = {
  defaultModel: string;
  maxInputTokens: number;
  maxRequestsPerMinute: number;
  monthlySpendAlertPaise: number;
  creditValuePaise: number;
  approvalThresholdCredits: number;
  referralReferrerCredits: number;
  referralRefereeCredits: number;
  giftMaxCredits: number;
  inputCostPaisePerMTok: number;
  outputCostPaisePerMTok: number;
  lowCreditThreshold: number;
  resetPolicy: string;
  trialDays: number;
  pastDueGraceDays: number;
  supportEmail: string;
  supportUrl: string;
  statusPageUrl: string;
  supportHours: string;
  requireMfaForAdmins: boolean;
  adminSessionMinutes: number;
  auditRetentionDays: number;
  flags: Record<string, boolean>;
};

export function AdminSettings() {
  const { role } = useAdminRole();
  const canWrite = role === "super_admin";
  const { data, error, reload } = useAdminData<{ settings: Settings; providers: { provider: string; status: string }[] }>("settings");
  const { busy, run } = useMutations(reload);
  const [form, setForm] = React.useState<Settings | null>(null);
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (data) setForm({
      ...data.settings,
      creditValuePaise: data.settings.creditValuePaise ?? 250,
      approvalThresholdCredits: data.settings.approvalThresholdCredits ?? 1000,
      referralReferrerCredits: data.settings.referralReferrerCredits ?? 10,
      referralRefereeCredits: data.settings.referralRefereeCredits ?? 5,
      giftMaxCredits: data.settings.giftMaxCredits ?? 1000,
      inputCostPaisePerMTok: data.settings.inputCostPaisePerMTok ?? 0,
      outputCostPaisePerMTok: data.settings.outputCostPaisePerMTok ?? 0,
      pastDueGraceDays: data.settings.pastDueGraceDays ?? 3,
      supportEmail: data.settings.supportEmail ?? "",
      supportUrl: data.settings.supportUrl ?? "",
      statusPageUrl: data.settings.statusPageUrl ?? "",
      supportHours: data.settings.supportHours ?? "",
      requireMfaForAdmins: data.settings.requireMfaForAdmins ?? false,
      adminSessionMinutes: data.settings.adminSessionMinutes ?? 1440,
      auditRetentionDays: data.settings.auditRetentionDays ?? 365,
    });
  }, [data]);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  const valid = form != null && reason.trim().length >= 5;
  return (
    <LivePage
      title="Platform Settings"
      description="Provider status, limits, thresholds and feature flags. Secrets are never shown in the browser."
    >
      {!data || !form ? (
        <LoadState error={error} testId="admin-settings-state" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="AI & payment providers" testId="admin-provider-status">
            <ul className="space-y-2 text-sm">
              {data.providers.map((row) => (
                <li key={row.provider} className="flex justify-between gap-3 text-ink-2">
                  <span>{row.provider}</span>
                  <StatusBadge value={row.status} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Limits & thresholds">
            <div className="grid gap-3">
              <Field label="Default model">
                <input className={field} disabled={!canWrite} value={form.defaultModel} onChange={(e) => set("defaultModel", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max input tokens">
                  <input className={field} type="number" disabled={!canWrite} value={form.maxInputTokens} onChange={(e) => set("maxInputTokens", Number(e.target.value))} />
                </Field>
                <Field label="Requests / minute / user">
                  <input className={field} type="number" disabled={!canWrite} value={form.maxRequestsPerMinute} onChange={(e) => set("maxRequestsPerMinute", Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly spend alert">
                  <input className={field} type="number" disabled={!canWrite} value={form.monthlySpendAlertPaise / 100} onChange={(e) => set("monthlySpendAlertPaise", Math.round(Number(e.target.value) * 100))} />
                  <span className="mt-1 block text-xs text-ink-3">{inr(form.monthlySpendAlertPaise)}</span>
                </Field>
                <Field label="Low-credit notification at">
                  <input className={field} type="number" disabled={!canWrite} value={form.lowCreditThreshold} onChange={(e) => set("lowCreditThreshold", Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estimated value per AI credit" hint="Used only to estimate monthly AI spend.">
                  <input className={field} type="number" step="0.01" disabled={!canWrite} value={form.creditValuePaise / 100} onChange={(e) => set("creditValuePaise", Math.round(Number(e.target.value) * 100))} />
                  <span className="mt-1 block text-xs text-ink-3">{inr(form.creditValuePaise)}</span>
                </Field>
                <Field label="Approval threshold (credits)" hint="Credit changes at or above this need a second admin. 0 disables approvals.">
                  <input className={field} type="number" min={0} disabled={!canWrite} value={form.approvalThresholdCredits} onChange={(e) => set("approvalThresholdCredits", Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Referrer credits">
                  <input className={field} type="number" min={0} disabled={!canWrite} value={form.referralReferrerCredits} onChange={(e) => set("referralReferrerCredits", Number(e.target.value))} />
                </Field>
                <Field label="New-user credits">
                  <input className={field} type="number" min={0} disabled={!canWrite} value={form.referralRefereeCredits} onChange={(e) => set("referralRefereeCredits", Number(e.target.value))} />
                </Field>
                <Field label="Gift max">
                  <input className={field} type="number" min={1} disabled={!canWrite} value={form.giftMaxCredits} onChange={(e) => set("giftMaxCredits", Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Input cost / 1M tokens" hint="Provider cost in rupees; 0 disables estimates.">
                  <input className={field} type="number" step="0.01" disabled={!canWrite} value={form.inputCostPaisePerMTok / 100} onChange={(e) => set("inputCostPaisePerMTok", Math.round(Number(e.target.value) * 100))} />
                  <span className="mt-1 block text-xs text-ink-3">{inr(form.inputCostPaisePerMTok)}</span>
                </Field>
                <Field label="Output cost / 1M tokens">
                  <input className={field} type="number" step="0.01" disabled={!canWrite} value={form.outputCostPaisePerMTok / 100} onChange={(e) => set("outputCostPaisePerMTok", Math.round(Number(e.target.value) * 100))} />
                  <span className="mt-1 block text-xs text-ink-3">{inr(form.outputCostPaisePerMTok)}</span>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Trial length (days)">
                  <input className={field} type="number" disabled={!canWrite} value={form.trialDays} onChange={(e) => set("trialDays", Number(e.target.value))} />
                </Field>
                <Field label="Past-due grace (days)" hint="AI pauses after this many days past due.">
                  <input className={field} type="number" min={0} max={90} disabled={!canWrite} value={form.pastDueGraceDays} onChange={(e) => set("pastDueGraceDays", Number(e.target.value))} />
                </Field>
              </div>
            </div>
          </Panel>
          <Panel title="Credit reset policy">
            <textarea className={textarea} disabled={!canWrite} value={form.resetPolicy} onChange={(e) => set("resetPolicy", e.target.value)} />
          </Panel>
          <Panel title="Support configuration" testId="admin-support-settings">
            <div className="grid gap-3">
              <Field label="Support email">
                <input className={field} disabled={!canWrite} value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} placeholder="support@example.com" />
              </Field>
              <Field label="Support link">
                <input className={field} disabled={!canWrite} value={form.supportUrl} onChange={(e) => set("supportUrl", e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Status page">
                <input className={field} disabled={!canWrite} value={form.statusPageUrl} onChange={(e) => set("statusPageUrl", e.target.value)} placeholder="https://status.…" />
              </Field>
              <Field label="Support hours">
                <input className={field} disabled={!canWrite} value={form.supportHours} onChange={(e) => set("supportHours", e.target.value)} placeholder="Mon–Fri, 9am–6pm IST" />
              </Field>
            </div>
          </Panel>
          <Panel title="Admin security" testId="admin-security-settings">
            <div className="grid gap-3">
              <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
                <span>Require MFA for every admin</span>
                <input type="checkbox" disabled={!canWrite} checked={form.requireMfaForAdmins} onChange={(e) => set("requireMfaForAdmins", e.target.checked)} />
              </label>
              <Field label="Admin session lifetime (minutes)" hint="Displayed policy. Existing sessions are not shortened retroactively.">
                <input className={field} type="number" min={30} max={10080} disabled={!canWrite} value={form.adminSessionMinutes} onChange={(e) => set("adminSessionMinutes", Number(e.target.value))} />
              </Field>
              <Field label="Audit log retention (days)" hint="Operational target; purge is not automated yet.">
                <input className={field} type="number" min={30} max={3650} disabled={!canWrite} value={form.auditRetentionDays} onChange={(e) => set("auditRetentionDays", Number(e.target.value))} />
              </Field>
            </div>
          </Panel>
          <Panel title="Feature flags">
            <ul className="space-y-2 text-sm">
              {Object.entries(form.flags).map(([key, on]) => (
                <li key={key} className="flex items-center justify-between gap-3 text-ink-2">
                  <code className="text-xs">{key}</code>
                  <input type="checkbox" disabled={!canWrite} checked={on} onChange={(e) => set("flags", { ...form.flags, [key]: e.target.checked })} />
                </li>
              ))}
            </ul>
          </Panel>
          {canWrite && (
            <div className="space-y-3 lg:col-span-2">
              <Reason value={reason} onChange={setReason} testId="admin-settings-reason" />
              <Button
                variant="primary"
                loading={busy === "save"}
                disabled={!valid}
                onClick={() =>
                  void run(
                    "save",
                    () =>
                      adminSend("settings", "PUT", {
                        default_model: form.defaultModel,
                        max_input_tokens: form.maxInputTokens,
                        max_requests_per_minute: form.maxRequestsPerMinute,
                        monthly_spend_alert_paise: form.monthlySpendAlertPaise,
                        credit_value_paise: form.creditValuePaise,
                        approval_threshold_credits: form.approvalThresholdCredits,
                        referral_referrer_credits: form.referralReferrerCredits,
                        referral_referee_credits: form.referralRefereeCredits,
                        gift_max_credits: form.giftMaxCredits,
                        input_cost_paise_per_mtok: form.inputCostPaisePerMTok,
                        output_cost_paise_per_mtok: form.outputCostPaisePerMTok,
                        low_credit_threshold: form.lowCreditThreshold,
                        reset_policy: form.resetPolicy,
                        trial_days: form.trialDays,
                        past_due_grace_days: form.pastDueGraceDays,
                        support_email: form.supportEmail,
                        support_url: form.supportUrl,
                        status_page_url: form.statusPageUrl,
                        support_hours: form.supportHours,
                        require_mfa_for_admins: form.requireMfaForAdmins,
                        admin_session_minutes: form.adminSessionMinutes,
                        audit_retention_days: form.auditRetentionDays,
                        flags: form.flags,
                        reason: reason.trim(),
                      }),
                    "Settings saved",
                  )
                }
              >
                Save settings
              </Button>
            </div>
          )}
        </div>
      )}
    </LivePage>
  );
}
