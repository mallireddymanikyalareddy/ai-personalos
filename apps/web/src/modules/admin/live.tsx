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
export type LivePlan = { plan_id: string; name: string; available: boolean; current_version: number; current: PlanVersion };
export type PricingAction = { action: string; label: string; min_credits: number; max_credits: number; model: string; max_output_tokens: number };
export type PricingVersion = { version: number; status: string; effective_at: string; actions: PricingAction[] };

export function useAdminData<T>(path: string) {
  const [state, setState] = React.useState<{ data?: T; error?: string }>({});
  React.useEffect(() => {
    let alive = true;
    fetch(`/api/v1/admin/${path}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "You don't have access to this data." : "Couldn't load live data.");
        return (await res.json()) as T;
      })
      .then((data) => alive && setState({ data }))
      .catch((err: Error) => alive && setState({ error: err.message }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
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

export function LoadState({ error, testId }: { error?: string; testId: string }) {
  return (
    <p data-testid={testId} className={error ? "text-sm text-red-600" : "text-sm text-ink-3"}>
      {error ?? "Loading saved records…"}
    </p>
  );
}

export const creditRange = (a: PricingAction) => (a.min_credits === a.max_credits ? String(a.min_credits) : `${a.min_credits}–${a.max_credits}`);
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
