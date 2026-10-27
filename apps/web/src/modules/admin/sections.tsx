"use client";

import * as React from "react";

import { inr, PROMOTIONS, SETTINGS, SUBSCRIPTIONS } from "./demo-data";
import { creditRange, LiveNotice, LoadState, shortDate, useAdminData, type LivePlan, type PricingVersion } from "./live";
import { DataTable, DemoNotice, PageHeader, Panel, StatusBadge } from "./ui";


function LivePage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <LiveNotice text="LIVE RECORDS — loaded from the database. Read-only for now; editing arrives in a later stage." />
      {children}
    </div>
  );
}

function Page({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <DemoNotice />
      {children}
    </div>
  );
}

export function AdminSubscriptions() {
  return (
    <Page title="Subscriptions" description="Plan, billing period, entitlement period and payment status for each subscription.">
      <DataTable
        testId="admin-subscriptions-table"
        rows={SUBSCRIPTIONS}
        search={(row) => `${row.id} ${row.user} ${row.plan} ${row.status}`}
        columns={[
          { key: "id", label: "ID", render: (r) => <code className="text-xs">{r.id}</code> },
          { key: "user", label: "User" },
          { key: "plan", label: "Plan" },
          { key: "billing", label: "Billing" },
          { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
          { key: "start", label: "Start" },
          { key: "period", label: "Entitlement period" },
          { key: "renewal", label: "Renewal" },
          { key: "payment", label: "Payment", render: (r) => <StatusBadge value={r.payment} /> },
          { key: "cancel", label: "Cancellation" },
        ]}
      />
    </Page>
  );
}

export function AdminPlans() {
  const { data, error } = useAdminData<{ plans: LivePlan[] }>("plans");
  return (
    <LivePage title="Plans & Pricing" description="Versioned plan records. Published changes apply to new subscriptions and the next renewal of existing ones.">
      {!data ? (
        <LoadState error={error} testId="admin-plans-state" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.plans.map((plan) => (
            <PlanCard key={plan.plan_id} plan={plan} />
          ))}
        </div>
      )}
    </LivePage>
  );
}

function PlanCard({ plan }: { plan: LivePlan }) {
  const v = plan.current;
  const rows: [string, React.ReactNode][] = [
    ["Monthly credits", v.monthly_credits],
    ["Annual monthly credits", v.annual_monthly_credits],
    ["Annual bonus (incl.)", v.annual_bonus_credits],
    ["Trial", `${v.trial_days} days · ${v.trial_credits} credits`],
    ["Effective from", shortDate(v.effective_at)],
  ];
  return (
    <div data-testid={`admin-plan-${plan.plan_id}`} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">{plan.name}</h3>
        <span data-testid={`admin-plan-${plan.plan_id}-version`} className="text-[11px] text-ink-3">
          v{v.version} · {v.status}
        </span>
      </div>
      <p data-testid={`admin-plan-${plan.plan_id}-price`} className="mt-3 text-2xl font-semibold text-ink">
        {inr(v.monthly_price_paise)}
        <span className="text-sm font-normal text-ink-3">/month</span>
      </p>
      <p className="text-xs text-ink-3">
        {inr(v.annual_price_paise)}/year · {inr(Math.round(v.annual_price_paise / 12))}/month equivalent
      </p>
      <dl className="mt-4 space-y-1.5 text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between text-ink-2">
            <dt>{k}</dt>
            <dd className="font-medium tabular-nums text-ink">{val}</dd>
          </div>
        ))}
      </dl>
      <button type="button" disabled className="mt-4 w-full rounded-lg border border-line py-2 text-xs font-medium text-ink-3" title="Editing arrives in Stage 5">
        Edit draft (Stage 5)
      </button>
    </div>
  );
}

export function AdminActionPricing() {
  const { data, error } = useAdminData<{ versions: PricingVersion[] }>("pricing");
  const published = data?.versions.find((v) => v.status === "published");
  return (
    <LivePage
      title="AI Action Pricing"
      description={published ? `Published pricing v${published.version}, effective ${shortDate(published.effective_at)}. Every transaction stores the pricing version used when it ran.` : "Every transaction stores the pricing version used when it ran."}
    >
      {!published ? (
        <LoadState error={error ?? (data ? "No published pricing version." : undefined)} testId="admin-pricing-state" />
      ) : (
        <DataTable
          testId="admin-pricing-table"
          rows={published.actions.map((row) => ({ ...row, id: row.action }))}
          columns={[
            { key: "label", label: "Action", render: (r) => <span className="font-medium text-ink">{r.label}</span> },
            { key: "action", label: "Key", render: (r) => <code className="text-xs">{r.action}</code> },
            { key: "min_credits", label: "Credits", align: "right", render: (r) => creditRange(r) },
            { key: "model", label: "Model" },
            { key: "max_output_tokens", label: "Max output tok", align: "right" },
          ]}
        />
      )}
    </LivePage>
  );
}

export function AdminPromotions() {
  return (
    <Page title="Promotions & Grants" description="Campaigns that grant promotional credits with eligibility, limits and expiry.">
      <DataTable
        testId="admin-promotions-table"
        rows={PROMOTIONS}
        columns={[
          { key: "name", label: "Campaign", render: (r) => <span className="font-medium text-ink">{r.name}</span> },
          { key: "credits", label: "Credits", align: "right" },
          { key: "eligibility", label: "Eligibility" },
          { key: "start", label: "Start" },
          { key: "end", label: "End" },
          { key: "limit", label: "Limit" },
          { key: "expiry", label: "Expiry" },
          { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
          { key: "granted", label: "Granted", align: "right" },
        ]}
      />
    </Page>
  );
}

export function AdminSettings() {
  return (
    <Page title="Platform Settings" description="Provider status, limits, thresholds and feature flags. Secrets are never shown in the browser.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="AI & payment providers" testId="admin-provider-status">
          <ul className="space-y-2 text-sm">
            {SETTINGS.providerStatus.map((row) => (
              <li key={row.provider} className="flex justify-between gap-3 text-ink-2">
                <span>{row.provider}</span>
                <span className="font-medium text-ink">{row.status}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Limits & thresholds">
          <dl className="space-y-1.5 text-sm">
            {[
              ["Default model", SETTINGS.defaultModel],
              ["Max input tokens", SETTINGS.maxInputTokens.toLocaleString()],
              ["Requests / minute / user", SETTINGS.maxRequestsPerMinute],
              ["Monthly spend alert", inr(SETTINGS.monthlySpendAlertPaise)],
              ["Low-credit notification at", `${SETTINGS.lowCreditThreshold} credits`],
              ["Trial length", `${SETTINGS.trialDays} days`],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between text-ink-2">
                <dt>{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Credit reset policy">
          <p className="text-sm text-ink-2">{SETTINGS.resetPolicy}</p>
        </Panel>
        <Panel title="Feature flags">
          <ul className="space-y-1.5 text-sm">
            {SETTINGS.flags.map((flag) => (
              <li key={flag.key} className="flex justify-between text-ink-2">
                <code className="text-xs">{flag.key}</code>
                <StatusBadge value={flag.on ? "active" : "draft"} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
