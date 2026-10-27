"use client";

import * as React from "react";

import { inr, PROMOTIONS, SETTINGS, SUBSCRIPTIONS } from "./demo-data";
import {
  creditRange,
  LiveNotice,
  LoadState,
  shortDate,
  useAdminData,
  type LivePlan,
  type PricingVersion,
} from "./live";
import { DataTable, DemoNotice, PageHeader, Panel, StatusBadge } from "./ui";

function Page({
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
      <DemoNotice />
      {children}
    </div>
  );
}

export function AdminSubscriptions() {
  return (
    <Page
      title="Subscriptions"
      description="Plan, billing period, entitlement period and payment status for each subscription."
    >
      <DataTable
        testId="admin-subscriptions-table"
        rows={SUBSCRIPTIONS}
        search={(row) => `${row.id} ${row.user} ${row.plan} ${row.status}`}
        columns={[
          {
            key: "id",
            label: "ID",
            render: (r) => <code className="text-xs">{r.id}</code>,
          },
          { key: "user", label: "User" },
          { key: "plan", label: "Plan" },
          { key: "billing", label: "Billing" },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge value={r.status} />,
          },
          { key: "start", label: "Start" },
          { key: "period", label: "Entitlement period" },
          { key: "renewal", label: "Renewal" },
          {
            key: "payment",
            label: "Payment",
            render: (r) => <StatusBadge value={r.payment} />,
          },
          { key: "cancel", label: "Cancellation" },
        ]}
      />
    </Page>
  );
}

export function AdminPromotions() {
  return (
    <Page
      title="Promotions & Grants"
      description="Campaigns that grant promotional credits with eligibility, limits and expiry."
    >
      <DataTable
        testId="admin-promotions-table"
        rows={PROMOTIONS}
        columns={[
          {
            key: "name",
            label: "Campaign",
            render: (r) => (
              <span className="font-medium text-ink">{r.name}</span>
            ),
          },
          { key: "credits", label: "Credits", align: "right" },
          { key: "eligibility", label: "Eligibility" },
          { key: "start", label: "Start" },
          { key: "end", label: "End" },
          { key: "limit", label: "Limit" },
          { key: "expiry", label: "Expiry" },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge value={r.status} />,
          },
          { key: "granted", label: "Granted", align: "right" },
        ]}
      />
    </Page>
  );
}

export function AdminSettings() {
  return (
    <Page
      title="Platform Settings"
      description="Provider status, limits, thresholds and feature flags. Secrets are never shown in the browser."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="AI & payment providers" testId="admin-provider-status">
          <ul className="space-y-2 text-sm">
            {SETTINGS.providerStatus.map((row) => (
              <li
                key={row.provider}
                className="flex justify-between gap-3 text-ink-2"
              >
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
              [
                "Low-credit notification at",
                `${SETTINGS.lowCreditThreshold} credits`,
              ],
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
