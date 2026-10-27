"use client";

import * as React from "react";

import { Check, Gem, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";
import { useCredits } from "@/lib/use-credits";

type Plan = {
  planId: string;
  name: string;
  monthly_price_paise: number;
  annual_price_paise: number;
  monthly_credits: number;
  annual_monthly_credits: number;
  annual_bonus_credits: number;
  trial_days: number;
  trial_credits: number;
};
type Action = {
  action: string;
  label: string;
  minCredits: number;
  maxCredits: number;
};

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const range = (a: Action) =>
  a.minCredits === a.maxCredits
    ? `${a.minCredits}`
    : `${a.minCredits}–${a.maxCredits}`;

export function PlansPage() {
  const [data, setData] = React.useState<{
    plans: Plan[];
    actions: Action[];
  } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [annual, setAnnual] = React.useState(false);
  const { balance } = useCredits(true);
  React.useEffect(() => {
    fetch("/api/v1/plans", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="plans-page">
      <PageHeader
        icon={Gem}
        title="Plans"
        subtitle="More AI credits every month with PersonalOS AI and AI Pro."
        testId="plans-header"
        actions={
          balance && (
            <span
              data-testid="plans-balance"
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2"
            >
              You have {balance.available} credits
            </span>
          )
        }
      />
      <div
        className="inline-flex rounded-full border border-line bg-surface p-1"
        role="group"
        aria-label="Billing period"
      >
        {[false, true].map((a) => (
          <button
            key={String(a)}
            type="button"
            aria-pressed={annual === a}
            data-testid={`plans-toggle-${a ? "annual" : "monthly"}`}
            onClick={() => setAnnual(a)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
              annual === a ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
            )}
          >
            {a ? "Yearly" : "Monthly"}
          </button>
        ))}
      </div>
      {failed && (
        <p className="text-sm text-red-600" data-testid="plans-error">
          Couldn&apos;t load plans. Please try again.
        </p>
      )}
      {!data && !failed && <p className="text-sm text-ink-3">Loading plans…</p>}
      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          {data.plans.map((p) => (
            <PlanTile
              key={p.planId}
              plan={p}
              annual={annual}
              featured={p.planId === "ai"}
            />
          ))}
        </div>
      )}
      {data && <ActionCosts actions={data.actions} />}
    </div>
  );
}

function PlanTile({
  plan,
  annual,
  featured,
}: {
  plan: Plan;
  annual: boolean;
  featured: boolean;
}) {
  const credits = annual ? plan.annual_monthly_credits : plan.monthly_credits;
  const perks = [
    credits
      ? `${credits} AI credits every month`
      : "Everything in PersonalOS, no AI credits",
    annual && plan.annual_bonus_credits
      ? `Includes ${plan.annual_bonus_credits} bonus credits a month vs monthly`
      : null,
    `${plan.trial_days}-day free trial${plan.trial_credits ? ` with ${plan.trial_credits} credits` : ""}`,
    "Tasks, goals, habits, notes and journal",
  ].filter(Boolean) as string[];
  return (
    <section
      data-testid={`plan-tile-${plan.planId}`}
      className={cn(
        "flex flex-col rounded-2xl border bg-surface p-5 shadow-card",
        featured ? "border-accent ring-1 ring-accent/40" : "border-line",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">{plan.name}</h2>
        {featured && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-ink">
            Popular
          </span>
        )}
      </div>
      <p
        className="mt-3 text-3xl font-bold tracking-tight text-ink"
        data-testid={`plan-tile-${plan.planId}-price`}
      >
        {rupees(annual ? plan.annual_price_paise : plan.monthly_price_paise)}
        <span className="text-sm font-normal text-ink-3">
          /{annual ? "year" : "month"}
        </span>
      </p>
      {annual && (
        <p className="text-xs text-ink-3">
          {rupees(Math.round(plan.annual_price_paise / 12))}/month equivalent
        </p>
      )}
      <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-2">
        {perks.map((perk) => (
          <li key={perk} className="flex gap-2">
            <Check
              className="mt-0.5 size-4 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            {perk}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        data-testid={`plan-tile-${plan.planId}-cta`}
        className="mt-5 w-full cursor-not-allowed rounded-lg border border-line bg-surface-2 py-2 text-xs font-semibold text-ink-3"
      >
        Payments coming soon
      </button>
    </section>
  );
}

function ActionCosts({ actions }: { actions: Action[] }) {
  return (
    <section
      data-testid="plans-action-costs"
      className="rounded-2xl border border-line bg-surface p-5 shadow-card"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Sparkles className="size-4 text-accent" aria-hidden="true" /> What
        credits buy
      </h2>
      <p className="mt-1 text-xs text-ink-3">
        If an answer fails, the credits go back. Actions with a range cost less
        for shorter answers.
      </p>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {actions.map((a) => (
          <li key={a.action} className="flex justify-between gap-3 text-ink-2">
            <span>{a.label}</span>
            <span className="tabular-nums font-medium text-ink">
              {range(a)} credit{a.maxCredits === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
