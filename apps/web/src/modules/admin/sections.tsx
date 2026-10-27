"use client";

import * as React from "react";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ACTION_PRICING, AUDIT, inr, LEDGER, PLANS, PROMOTIONS, SETTINGS, SUBSCRIPTIONS, TREND, USAGE, USERS } from "./demo-data";
import { DataTable, DemoNotice, PageHeader, Panel, Stat, StatusBadge } from "./ui";

const axis = { fontSize: 11, fill: "var(--ink-3)" };

function Page({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <DemoNotice />
      {children}
    </div>
  );
}

export function AdminDashboard() {
  const [range, setRange] = React.useState("7d");
  const mix = PLANS.map((plan, i) => ({ plan: plan.name.replace("PersonalOS ", ""), subscribers: [640, 410, 185][i] }));
  return (
    <Page title="Dashboard" description="Subscribers, revenue, AI usage and cost at a glance.">
      <div className="flex gap-2" role="group" aria-label="Date range">
        {["7d", "30d", "90d"].map((value) => (
          <button
            key={value}
            type="button"
            data-testid={`admin-range-${value}`}
            aria-pressed={range === value}
            onClick={() => setRange(value)}
            className={
              range === value
                ? "rounded-full bg-ink px-3 py-1 text-xs font-medium text-bg"
                : "rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2"
            }
          >
            Last {value}
          </button>
        ))}
        <span className="self-center text-[11px] text-ink-3">Date filters apply once live data is connected.</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat testId="stat-users" label="Registered users" value="2,418" />
        <Stat testId="stat-subscribers" label="Active subscribers" value="1,235" hint="Excludes trials" />
        <Stat testId="stat-trials" label="Active trials" value="214" />
        <Stat testId="stat-mrr" label="MRR" value={inr(31254000)} hint="Annual plans normalised to monthly" />
        <Stat testId="stat-arr" label="ARR (run-rate)" value={inr(375048000)} hint="Not recognised revenue" />
        <Stat testId="stat-ai-requests" label="AI requests" value="3,518" hint="3,402 succeeded · 116 failed" />
        <Stat testId="stat-provider-cost" label="Provider cost" value={inr(60220)} hint={`${inr(18)} per successful request`} />
        <Stat testId="stat-pending" label="Pending reservations" value="7" hint="2 older than 10 min" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="AI requests & credits" testId="chart-usage">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="day" tick={axis} />
                <YAxis tick={axis} />
                <Tooltip />
                <Area type="monotone" dataKey="credits" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="requests" stroke="#059669" fill="#059669" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Subscribers by plan" testId="chart-plans">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={mix}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="plan" tick={axis} />
                <YAxis tick={axis} />
                <Tooltip />
                <Bar dataKey="subscribers" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Estimated gross margin by plan">
          <ul className="space-y-2 text-sm">
            {[["Basic", "96%"], ["AI", "81%"], ["AI Pro", "74%"]].map(([plan, margin]) => (
              <li key={plan} className="flex justify-between text-ink-2">
                <span>{plan}</span>
                <span className="font-semibold tabular-nums text-ink">{margin}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Provider budget alerts">
          <p className="text-sm text-amber-700 dark:text-amber-300">OpenAI spend is at 62% of the monthly threshold ({inr(SETTINGS.monthlySpendAlertPaise)}).</p>
        </Panel>
      </div>
      <Panel title="Recent administrative actions">
        <ul className="space-y-1.5 text-sm text-ink-2">
          {AUDIT.slice(0, 3).map((row) => (
            <li key={row.id}>
              <span className="font-medium text-ink">{row.admin}</span> · {row.action} · {row.target} · {row.at}
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  );
}

export function AdminUsers() {
  return (
    <Page title="Users" description="Accounts, plans and credit balances. Private content (journal, notes, documents) is never shown here.">
      <DataTable
        testId="admin-users-table"
        rows={USERS}
        search={(row) => `${row.handle} ${row.email} ${row.plan}`}
        columns={[
          { key: "handle", label: "User", render: (r) => <span className="font-medium text-ink">{r.handle}</span> },
          { key: "email", label: "Email" },
          { key: "plan", label: "Plan" },
          { key: "billing", label: "Billing" },
          { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
          { key: "available", label: "Available", align: "right" },
          { key: "reserved", label: "Reserved", align: "right" },
          { key: "joined", label: "Joined" },
        ]}
      />
    </Page>
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
  return (
    <Page title="Plans & Pricing" description="Versioned plan records. Published changes apply to new subscriptions and the next renewal of existing ones.">
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.id} data-testid={`admin-plan-${plan.id}`} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">{plan.name}</h3>
              <span className="text-[11px] text-ink-3">v{plan.version}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {inr(plan.monthlyPaise)}
              <span className="text-sm font-normal text-ink-3">/month</span>
            </p>
            <p className="text-xs text-ink-3">
              {inr(plan.annualPaise)}/year · {inr(Math.round(plan.annualPaise / 12))}/month equivalent
            </p>
            <dl className="mt-4 space-y-1.5 text-sm">
              {[
                ["Monthly credits", plan.monthlyCredits],
                ["Annual monthly credits", plan.annualMonthlyCredits],
                ["Annual bonus (incl.)", plan.annualBonus],
                ["Trial", `${plan.trialDays} days · ${plan.trialCredits} credits`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between text-ink-2">
                  <dt>{k}</dt>
                  <dd className="font-medium tabular-nums text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <button type="button" disabled className="mt-4 w-full rounded-lg border border-line py-2 text-xs font-medium text-ink-3" title="Editing arrives in Stage 5">
              Edit draft (Stage 5)
            </button>
          </div>
        ))}
      </div>
    </Page>
  );
}

export function AdminCredits() {
  return (
    <Page title="Credit Management" description="Immutable ledger. Balances change only through grants, charges, releases and refunds, never by direct edits.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat testId="stat-included" label="Included (period)" value="148,250" />
        <Stat testId="stat-reserved" label="Reserved" value="21" />
        <Stat testId="stat-consumed" label="Consumed" value="6,720" />
        <Stat testId="stat-promo" label="Promotional" value="6,240" />
      </div>
      <DataTable
        testId="admin-ledger-table"
        rows={LEDGER}
        search={(row) => `${row.user} ${row.type} ${row.reason}`}
        columns={[
          { key: "id", label: "Entry", render: (r) => <code className="text-xs">{r.id}</code> },
          { key: "user", label: "User" },
          { key: "type", label: "Type", render: (r) => <StatusBadge value={r.type} /> },
          { key: "amount", label: "Credits", align: "right", render: (r) => (r.amount > 0 ? `+${r.amount}` : String(r.amount)) },
          { key: "reason", label: "Reason" },
          { key: "at", label: "When" },
        ]}
      />
    </Page>
  );
}

export function AdminUsage() {
  return (
    <Page title="AI Usage & Costs" description="Per-request tokens, credits and actual provider cost. Credits and money are tracked separately.">
      <Panel title="Provider cost trend (₹)" testId="chart-cost">
        <div className="h-48">
          <ResponsiveContainer>
            <AreaChart data={TREND.map((d) => ({ ...d, cost: d.costPaise / 100 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="day" tick={axis} />
              <YAxis tick={axis} />
              <Tooltip />
              <Area type="monotone" dataKey="cost" stroke="#d97706" fill="#d97706" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <DataTable
        testId="admin-usage-table"
        rows={USAGE}
        search={(row) => `${row.user} ${row.action} ${row.status}`}
        columns={[
          { key: "id", label: "Request", render: (r) => <code className="text-xs">{r.id}</code> },
          { key: "user", label: "User" },
          { key: "action", label: "Action" },
          { key: "model", label: "Model" },
          { key: "inTok", label: "In tok", align: "right" },
          { key: "outTok", label: "Out tok", align: "right" },
          { key: "reserved", label: "Reserved", align: "right" },
          { key: "charged", label: "Charged", align: "right" },
          { key: "costPaise", label: "Cost", align: "right", render: (r) => inr(r.costPaise) },
          { key: "ms", label: "ms", align: "right" },
          { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
        ]}
      />
    </Page>
  );
}

export function AdminActionPricing() {
  return (
    <Page title="AI Action Pricing" description="Published pricing v1. Every transaction stores the pricing version used when it ran.">
      <DataTable
        testId="admin-pricing-table"
        rows={ACTION_PRICING.map((row) => ({ ...row, id: row.action }))}
        columns={[
          { key: "label", label: "Action", render: (r) => <span className="font-medium text-ink">{r.label}</span> },
          { key: "action", label: "Key", render: (r) => <code className="text-xs">{r.action}</code> },
          { key: "credits", label: "Credits", align: "right" },
          { key: "model", label: "Model" },
          { key: "maxOutput", label: "Max output tok", align: "right" },
        ]}
      />
    </Page>
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

export function AdminAudit() {
  return (
    <Page title="Audit Logs" description="Read-only record of sensitive administrative actions.">
      <DataTable
        testId="admin-audit-table"
        rows={AUDIT}
        search={(row) => `${row.admin} ${row.action} ${row.target}`}
        columns={[
          { key: "at", label: "When" },
          { key: "admin", label: "Admin" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action", render: (r) => <code className="text-xs">{r.action}</code> },
          { key: "target", label: "Target" },
          { key: "reason", label: "Reason" },
          { key: "outcome", label: "Outcome", render: (r) => <StatusBadge value={r.outcome} /> },
          { key: "requestId", label: "Request ID", render: (r) => <code className="text-xs">{r.requestId}</code> },
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
