"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";

import { inr } from "./demo-data";
import {
  adminSend,
  creditRange,
  dateTime,
  LiveNotice,
  LoadState,
  useAdminData,
  useAdminRole,
  type LivePlan,
  type PlanVersion,
  type PricingAction,
  type PricingState,
} from "./live";
import { DataTable, PageHeader } from "./ui";

const field =
  "h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none";

function useSave() {
  const { toast } = useToast();
  return React.useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try {
        await fn();
        toast(ok, { tone: "success" });
        return true;
      } catch (err) {
        toast((err as Error).message, { tone: "danger" });
        return false;
      }
    },
    [toast],
  );
}

function Shell({
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
      <LiveNotice text="LIVE RECORDS — changes are saved as a draft first, then published now or from a date you choose. Only the Super Admin can edit." />
      {children}
    </div>
  );
}

export function PublishBar({
  base,
  testId,
  onDone,
}: {
  base: string;
  testId: string;
  onDone: () => void;
}) {
  const save = useSave();
  const [day, setDay] = React.useState<number | null>(null);
  const [time, setTime] = React.useState("09:00");
  const [reason, setReason] = React.useState("");
  const when = day == null ? null : scheduleAt(day, time);
  const valid =
    reason.trim().length >= 5 && (when == null || when > Date.now());
  const publish = async () => {
    const effective_at = when ? new Date(when).toISOString() : null;
    if (
      await save(
        () => adminSend(`${base}/publish`, "POST", { effective_at, reason }),
        when ? "Draft scheduled" : "Draft published",
      )
    )
      onDone();
  };
  const discard = async () => {
    if (
      await save(
        () => adminSend(`${base}/draft`, "DELETE", undefined),
        "Draft discarded",
      )
    )
      onDone();
  };
  return (
    <div
      data-testid={testId}
      className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
        Unpublished draft — subscribers aren&apos;t affected until you publish.
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div data-testid={`${testId}-when`} className="min-w-0">
          <DatePicker
            value={day}
            onValueChange={setDay}
            min={startOfToday()}
            placeholder="Publish now"
            ariaLabel="Effective date (leave empty to publish now)"
          />
        </div>
        <input
          type="time"
          data-testid={`${testId}-time`}
          value={time}
          disabled={day == null}
          onChange={(e) => setTime(e.target.value || "00:00")}
          className={field}
          aria-label="Effective time"
        />
        <input
          data-testid={`${testId}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          className={`${field} sm:col-span-2`}
        />
      </div>
      {when != null && when <= Date.now() && (
        <p className="text-[11px] text-red-600" data-testid={`${testId}-past`}>
          That time has already passed. Pick a later time, or clear the date to
          publish now.
        </p>
      )}
      <p className="text-[11px] text-ink-3">
        Leave the date empty to publish now. Existing subscribers keep their
        current version until their next renewal.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valid}
          onClick={publish}
          data-testid={`${testId}-publish`}
        >
          {when ? "Schedule" : "Publish now"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={discard}
          data-testid={`${testId}-discard`}
        >
          Discard draft
        </Button>
      </div>
    </div>
  );
}

export function AdminPlans() {
  const { role } = useAdminRole();
  const { data, error, reload } = useAdminData<{ plans: LivePlan[] }>("plans");
  const [editing, setEditing] = React.useState<LivePlan | null>(null);
  return (
    <Shell
      title="Plans & Pricing"
      description="Versioned plan records. A subscription keeps the version it started on until renewal."
    >
      {!data ? (
        <LoadState error={error} testId="admin-plans-state" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.plans.map((plan) => (
            <PlanCard
              key={plan.plan_id}
              plan={plan}
              canEdit={role === "super_admin"}
              onEdit={() => setEditing(plan)}
              onChanged={reload}
            />
          ))}
        </div>
      )}
      <Drawer
        open={editing != null}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? "plan"}`}
        description="Saving creates or updates a draft. Nothing changes for users until you publish."
      >
        {editing && (
          <PlanForm
            plan={editing}
            onSaved={() => (setEditing(null), reload())}
          />
        )}
      </Drawer>
    </Shell>
  );
}

function PlanFacts({ v }: { v: PlanVersion }) {
  const rows: [string, React.ReactNode][] = [
    ["Monthly credits", v.monthly_credits],
    ["Annual monthly credits", v.annual_monthly_credits],
    ["Annual bonus (incl.)", v.annual_bonus_credits],
    ["Trial", `${v.trial_days} days · ${v.trial_credits} credits`],
  ];
  return (
    <>
      <p
        className="mt-3 text-2xl font-semibold text-ink"
        data-testid={`admin-plan-${v.plan_id}-v${v.version}-price`}
      >
        {inr(v.monthly_price_paise)}
        <span className="text-sm font-normal text-ink-3">/month</span>
      </p>
      <p className="text-xs text-ink-3">
        {inr(v.annual_price_paise)}/year ·{" "}
        {inr(Math.round(v.annual_price_paise / 12))}/month equivalent
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between text-ink-2">
            <dt>{k}</dt>
            <dd className="font-medium tabular-nums text-ink">{val}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function PlanCard({
  plan,
  canEdit,
  onEdit,
  onChanged,
}: {
  plan: LivePlan;
  canEdit: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const v = plan.current;
  return (
    <div
      data-testid={`admin-plan-${plan.plan_id}`}
      className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">{plan.name}</h3>
        <span
          data-testid={`admin-plan-${plan.plan_id}-version`}
          className="text-[11px] text-ink-3"
        >
          {v ? `v${v.version} · live` : "no live version"}
        </span>
      </div>
      {v && <PlanFacts v={v} />}
      {plan.scheduled.map((s) => (
        <div
          key={s.version}
          data-testid={`admin-plan-${plan.plan_id}-scheduled`}
          className="rounded-xl border border-sky-300/60 bg-sky-50/60 p-3 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-300"
        >
          v{s.version} scheduled from {dateTime(s.effective_at)}:{" "}
          {inr(s.monthly_price_paise)}/month · {s.monthly_credits} credits
        </div>
      ))}
      {plan.draft && (
        <div
          data-testid={`admin-plan-${plan.plan_id}-draft`}
          className="space-y-2"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Draft v{plan.draft.version}
          </p>
          <PlanFacts v={plan.draft} />
          {canEdit && (
            <PublishBar
              base={`plans/${plan.plan_id}`}
              testId={`admin-plan-${plan.plan_id}-publishbar`}
              onDone={onChanged}
            />
          )}
        </div>
      )}
      {canEdit && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={onEdit}
          data-testid={`admin-plan-${plan.plan_id}-edit`}
        >
          {plan.draft ? "Edit draft" : "Edit as new version"}
        </Button>
      )}
      <HistoryLine
        testId={`admin-plan-${plan.plan_id}-history`}
        versions={plan.history}
      />
    </div>
  );
}

function HistoryLine({
  versions,
  testId,
}: {
  versions: { version: number; effective_at: string }[];
  testId: string;
}) {
  const live = versions.filter(
    (v) => new Date(v.effective_at).getTime() <= Date.now(),
  );
  const shown = live.slice(0, 5);
  return (
    <p className="text-[11px] text-ink-3" data-testid={testId}>
      Past live versions:{" "}
      {shown
        .map((h) => `v${h.version} (${dateTime(h.effective_at)})`)
        .join(" · ") || "—"}
      {live.length > shown.length && ` · +${live.length - shown.length} older`}
    </p>
  );
}

function startOfToday() {
  return new Date().setHours(0, 0, 0, 0);
}

function scheduleAt(day: number, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

const PLAN_INPUTS: [keyof PlanVersion, string, "rupees" | "int"][] = [
  ["monthly_price_paise", "Monthly price (₹)", "rupees"],
  ["annual_price_paise", "Annual price (₹)", "rupees"],
  ["monthly_credits", "Monthly credits", "int"],
  ["annual_monthly_credits", "Annual plan: credits per month", "int"],
  ["annual_bonus_credits", "Annual bonus credits (included)", "int"],
  ["trial_days", "Trial length (days, max 90)", "int"],
  ["trial_credits", "Trial credits", "int"],
];

function PlanForm({ plan, onSaved }: { plan: LivePlan; onSaved: () => void }) {
  const save = useSave();
  const base = (plan.draft ?? plan.current) as PlanVersion;
  const [name, setName] = React.useState(base.name);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      PLAN_INPUTS.map(([k, , kind]) => [
        k,
        kind === "rupees" ? String((base[k] as number) / 100) : String(base[k]),
      ]),
    ),
  );
  const [reason, setReason] = React.useState("");
  const parsed = Object.fromEntries(
    PLAN_INPUTS.map(([k, , kind]) => [
      k,
      kind === "rupees"
        ? Math.round(Number(values[k]) * 100)
        : Number(values[k]),
    ]),
  );
  const valid =
    name.trim().length >= 3 &&
    reason.trim().length >= 5 &&
    Object.values(parsed).every((n) => Number.isInteger(n) && n >= 0) &&
    parsed.trial_days <= 90;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      await save(
        () =>
          adminSend(`plans/${plan.plan_id}/draft`, "PUT", {
            name,
            ...parsed,
            reason,
          }),
        "Draft saved",
      )
    )
      onSaved();
  };
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="admin-plan-form">
      <label className="block text-xs font-medium text-ink-2">
        Plan name
        <input
          data-testid="admin-plan-form-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${field} mt-1`}
        />
      </label>
      {PLAN_INPUTS.map(([k, label, kind]) => (
        <label key={k} className="block text-xs font-medium text-ink-2">
          {label}
          <input
            data-testid={`admin-plan-form-${k}`}
            inputMode={kind === "rupees" ? "decimal" : "numeric"}
            value={values[k]}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                [k]: e.target.value.replace(
                  kind === "rupees" ? /[^\d.]/g : /\D/g,
                  "",
                ),
              }))
            }
            className={`${field} mt-1`}
          />
        </label>
      ))}
      <input
        data-testid="admin-plan-form-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for the change (required)"
        className={field}
      />
      <Button
        type="submit"
        disabled={!valid}
        data-testid="admin-plan-form-save"
      >
        Save draft
      </Button>
    </form>
  );
}

export function AdminActionPricing() {
  const { role } = useAdminRole();
  const { data, error, reload } = useAdminData<PricingState>("pricing");
  const [editing, setEditing] = React.useState(false);
  const current = data?.current;
  return (
    <Shell
      title="AI Action Pricing"
      description="Credit cost per AI action. Each AI request stores the pricing version that was live when it started."
    >
      {!current ? (
        <LoadState
          error={error ?? (data ? "No published pricing version." : undefined)}
          testId="admin-pricing-state"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className="text-sm text-ink-2"
              data-testid="admin-pricing-live-version"
            >
              Live:{" "}
              <span className="font-semibold text-ink">v{current.version}</span>{" "}
              since {dateTime(current.effective_at)}
              {data.scheduled.map(
                (s) =>
                  ` · v${s.version} scheduled from ${dateTime(s.effective_at)}`,
              )}
            </p>
            {role === "super_admin" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditing(true)}
                data-testid="admin-pricing-edit"
              >
                {data.draft ? "Edit draft" : "Edit costs as new version"}
              </Button>
            )}
          </div>
          {data.draft && (
            <div className="space-y-2" data-testid="admin-pricing-draft">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Draft v{data.draft.version} (changes highlighted)
              </p>
              <PricingTable
                rows={data.draft.actions}
                compare={current.actions}
                testId="admin-pricing-draft-table"
              />
              {role === "super_admin" && (
                <PublishBar
                  base="pricing"
                  testId="admin-pricing-publishbar"
                  onDone={reload}
                />
              )}
            </div>
          )}
          <PricingTable rows={current.actions} testId="admin-pricing-table" />
          <HistoryLine testId="admin-pricing-history" versions={data.history} />
        </>
      )}
      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit AI action costs"
        description="Saved as a draft until you publish."
        className="sm:max-w-2xl"
      >
        {current && editing && (
          <PricingForm
            base={(data?.draft ?? current).actions}
            onSaved={() => (setEditing(false), reload())}
          />
        )}
      </Drawer>
    </Shell>
  );
}

function PricingTable({
  rows,
  compare,
  testId,
}: {
  rows: PricingAction[];
  compare?: PricingAction[];
  testId: string;
}) {
  const before = (r: PricingAction) => {
    const old = compare?.find((c) => c.action === r.action);
    const differs =
      old &&
      (old.min_credits !== r.min_credits ||
        old.max_credits !== r.max_credits ||
        old.max_output_tokens !== r.max_output_tokens);
    return differs ? old : null;
  };
  const was = (now: React.ReactNode, old: React.ReactNode, same: boolean) =>
    same ? (
      now
    ) : (
      <span className="font-semibold text-amber-700 dark:text-amber-300">
        {now}{" "}
        <span className="text-[11px] font-normal text-ink-3">(was {old})</span>
      </span>
    );
  return (
    <DataTable
      testId={testId}
      rows={rows.map((row) => ({ ...row, id: row.action }))}
      columns={[
        {
          key: "label",
          label: "Action",
          render: (r) => (
            <span className="font-medium text-ink">
              {before(r) && (
                <span
                  className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
                  aria-label="changed"
                />
              )}
              {r.label}
            </span>
          ),
        },
        {
          key: "action",
          label: "Key",
          render: (r) => <code className="text-xs">{r.action}</code>,
        },
        {
          key: "min_credits",
          label: "Credits",
          align: "right",
          render: (r) => {
            const old = before(r);
            return old
              ? was(
                  creditRange(r),
                  creditRange(old),
                  creditRange(r) === creditRange(old),
                )
              : creditRange(r);
          },
        },
        { key: "model", label: "Model" },
        {
          key: "max_output_tokens",
          label: "Max output tok",
          align: "right",
          render: (r) => {
            const old = before(r);
            return old
              ? was(
                  r.max_output_tokens,
                  old.max_output_tokens,
                  r.max_output_tokens === old.max_output_tokens,
                )
              : r.max_output_tokens;
          },
        },
      ]}
    />
  );
}

function PricingForm({
  base,
  onSaved,
}: {
  base: PricingAction[];
  onSaved: () => void;
}) {
  const save = useSave();
  const [rows, setRows] = React.useState(() => base.map((a) => ({ ...a })));
  const [reason, setReason] = React.useState("");
  const set = (
    i: number,
    key: "min_credits" | "max_credits" | "max_output_tokens",
    value: string,
  ) =>
    setRows((prev) =>
      prev.map((r, j) =>
        j === i ? { ...r, [key]: Number(value.replace(/\D/g, "") || 0) } : r,
      ),
    );
  const bad = rows.find(
    (r) =>
      r.min_credits < 1 ||
      r.max_credits > 100 ||
      r.min_credits > r.max_credits ||
      r.max_output_tokens < 50 ||
      r.max_output_tokens > 16000,
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const actions = rows.map(
      ({ action, min_credits, max_credits, max_output_tokens }) => ({
        action,
        min_credits,
        max_credits,
        max_output_tokens,
      }),
    );
    if (
      await save(
        () => adminSend("pricing/draft", "PUT", { actions, reason }),
        "Pricing draft saved",
      )
    )
      onSaved();
  };
  const cell =
    "h-8 w-20 rounded-md border border-line bg-bg px-2 text-right text-sm tabular-nums text-ink focus:border-accent focus:outline-none";
  return (
    <form
      onSubmit={submit}
      className="space-y-3"
      data-testid="admin-pricing-form"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3">
            <th className="py-1.5">Action</th>
            <th className="text-right">Min</th>
            <th className="text-right">Max</th>
            <th className="text-right">Max out tok</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.action} className="border-t border-line/60">
              <td className="py-1.5 pr-2 text-ink-2">{r.label}</td>
              <td className="text-right">
                <input
                  aria-label={`${r.label} minimum`}
                  data-testid={`admin-pricing-form-${r.action}-min`}
                  value={r.min_credits}
                  onChange={(e) => set(i, "min_credits", e.target.value)}
                  className={cell}
                />
              </td>
              <td className="text-right">
                <input
                  aria-label={`${r.label} maximum`}
                  data-testid={`admin-pricing-form-${r.action}-max`}
                  value={r.max_credits}
                  onChange={(e) => set(i, "max_credits", e.target.value)}
                  className={cell}
                />
              </td>
              <td className="text-right">
                <input
                  aria-label={`${r.label} max output tokens`}
                  data-testid={`admin-pricing-form-${r.action}-tokens`}
                  value={r.max_output_tokens}
                  onChange={(e) => set(i, "max_output_tokens", e.target.value)}
                  className={cell}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {bad && (
        <p
          className="text-xs text-red-600"
          data-testid="admin-pricing-form-error"
        >
          {bad.label}: credits must be 1–100 with min ≤ max, and max output
          50–16,000 tokens.
        </p>
      )}
      <input
        data-testid="admin-pricing-form-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for the change (required)"
        className={field}
      />
      <Button
        type="submit"
        disabled={!!bad || reason.trim().length < 5}
        data-testid="admin-pricing-form-save"
      >
        Save draft
      </Button>
    </form>
  );
}
