"use client";

import * as React from "react";

export type PlanVersion = {
  plan_id: string;
  name: string;
  version: number;
  status: string;
  effective_at: string;
  monthly_price_paise: number;
  annual_price_paise: number;
  monthly_credits: number;
  annual_monthly_credits: number;
  annual_bonus_credits: number;
  trial_days: number;
  trial_credits: number;
};
export type LivePlan = {
  plan_id: string;
  name: string;
  available: boolean;
  current: PlanVersion | null;
  scheduled: PlanVersion[];
  draft: PlanVersion | null;
  history: PlanVersion[];
};
export type PricingAction = {
  action: string;
  label: string;
  min_credits: number;
  max_credits: number;
  model: string;
  max_output_tokens: number;
};
export type PricingVersion = {
  version: number;
  status: string;
  effective_at: string;
  actions: PricingAction[];
};
export type PricingState = {
  current: PricingVersion | null;
  scheduled: PricingVersion[];
  draft: PricingVersion | null;
  history: (Omit<PricingVersion, "actions"> & { actions: number })[];
};

export const AdminRoleContext = React.createContext<{
  role: string;
  id: string;
}>({ role: "analyst", id: "" });
export const useAdminRole = () => React.useContext(AdminRoleContext);

export async function adminSend<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
): Promise<T> {
  const res = await fetch(`/api/v1/admin/${path}`, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((data as { detail?: string }).detail ?? "Request failed");
  return data as T;
}

export async function downloadAdminCsv(path: string, filename: string): Promise<void> {
  const res = await fetch(`/api/v1/admin/${path}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't export that file.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function useAdminData<T>(path: string) {
  const [state, setState] = React.useState<{ data?: T; error?: string }>({});
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((n) => n + 1), []);
  React.useEffect(() => {
    let alive = true;
    fetch(`/api/v1/admin/${path}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok)
          throw new Error(
            res.status === 403
              ? "You don't have access to this data."
              : "Couldn't load live data.",
          );
        return (await res.json()) as T;
      })
      .then((data) => alive && setState({ data }))
      .catch((err: Error) => alive && setState({ error: err.message }));
    return () => {
      alive = false;
    };
  }, [path, tick]);
  return { ...state, reload };
}

export function LiveNotice({ text }: { text: string }) {
  return (
    <div
      role="note"
      data-testid="admin-live-notice"
      className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    >
      {text}
    </div>
  );
}

export function LoadState({
  error,
  testId,
}: {
  error?: string;
  testId: string;
}) {
  return (
    <p
      data-testid={testId}
      className={error ? "text-sm text-red-600" : "text-sm text-ink-3"}
    >
      {error ?? "Loading saved records…"}
    </p>
  );
}

export const creditRange = (a: PricingAction) =>
  a.min_credits === a.max_credits
    ? String(a.min_credits)
    : `${a.min_credits}–${a.max_credits}`;
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
export const ROLE_OPTIONS = [
  ["super_admin", "Super Admin"],
  ["billing_admin", "Billing Admin"],
  ["support_admin", "Support Admin"],
  ["ai_ops_admin", "AI Operations Admin"],
  ["analyst", "Read-only Analyst"],
] as const;
export const roleLabel = (role: string | null) =>
  ROLE_OPTIONS.find(([k]) => k === role)?.[1] ?? "—";

export type LedgerEntry = {
  id: string;
  user_id: string;
  handle?: string;
  type: string;
  credits: number;
  available_delta: number;
  reserved_delta: number;
  reason: string;
  actor: string;
  action?: string;
  created_at: string;
};
export type UsageRow = {
  id: string;
  handle?: string;
  action: string;
  model: string;
  reserved: number;
  charged: number;
  est_output_tokens: number;
  ms: number;
  status: string;
  error?: string | null;
  created_at: string;
};
export type AuditRow = {
  id: string;
  actor: string;
  role: string | null;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  reason: string;
  outcome: string;
  details: Record<string, unknown>;
  created_at: string;
};
export type UsageTotals = {
  requests: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  creditsCharged: number;
};
export type ActionInsight = {
  action: string;
  calls: number;
  credits: number;
  costPaise: number;
  avgMs: number;
  priceCredits: number;
};
export type PlanInsight = {
  planId: string;
  name: string;
  subscribers: number;
  monthlyRevenuePaise: number;
  monthlyCredits: number;
  costPerSubscriberPaise: number;
  marginPaise: number;
};
export type UsageInsights = {
  totals: UsageTotals & { inputTokens: number; outputTokens: number; estimatedCostPaise: number };
  byAction: ActionInsight[];
  byModel: { model: string; calls: number; credits: number; costPaise: number; avgMs: number }[];
  trend: { day: string; calls: number; credits: number; costPaise: number }[];
  month: { spendPaise: number; projectedPaise: number; credits: number };
  costPerCreditPaise: number;
  plans: PlanInsight[];
};
export type TrendPoint = { day: string; requests: number; credits: number };

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
