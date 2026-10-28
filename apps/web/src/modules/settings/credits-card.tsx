"use client";

import * as React from "react";

import Link from "next/link";

import { Sparkles } from "lucide-react";

import { CREDITS_EVENT } from "@/lib/ai-stream";
import { useCredits } from "@/lib/use-credits";

type Entry = {
  id: string;
  type: string;
  credits: number;
  available_delta: number;
  reserved_delta: number;
  reason: string;
  created_at: string;
};

const LABELS: Record<string, string> = {
  trial_grant: "Trial credits",
  admin_grant: "Added by PersonalOS",
  admin_debit: "Removed by PersonalOS",
  reserve: "Held",
  charge: "Used",
  release: "Returned",
};

function amountText(e: Entry): string {
  if (e.type === "charge") return `−${e.credits}`;
  if (e.type === "reserve") return `${e.credits} held`;
  return e.available_delta > 0
    ? `+${e.available_delta}`
    : String(e.available_delta);
}

type Forecast = { daysLeft: number | null; used7d: number; used14d: number };

export function CreditsCard() {
  const { balance, lowThreshold } = useCredits(true);
  const [entries, setEntries] = React.useState<Entry[] | null>(null);
  const [forecast, setForecast] = React.useState<Forecast | null>(null);
  React.useEffect(() => {
    const load = () =>
      fetch("/api/v1/credits/history?limit=50", {
        credentials: "include",
        cache: "no-store",
      })
        .then((res) =>
          res.ok
            ? (res.json() as Promise<{ entries: Entry[] }>)
            : { entries: [] },
        )
        .then((d) => setEntries(d.entries))
        .catch(() => setEntries([]));
    load();
    window.addEventListener(CREDITS_EVENT, load);
    return () => window.removeEventListener(CREDITS_EVENT, load);
  }, []);
  React.useEffect(() => {
    const load = () =>
      fetch("/api/v1/credits/forecast", {
        credentials: "include",
        cache: "no-store",
      })
        .then((res) => (res.ok ? (res.json() as Promise<Forecast>) : null))
        .then(setForecast)
        .catch(() => undefined);
    load();
    window.addEventListener(CREDITS_EVENT, load);
    return () => window.removeEventListener(CREDITS_EVENT, load);
  }, []);
  return (
    <section
      data-testid="credits-card"
      className="rounded-2xl border border-line bg-surface p-5 shadow-card"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent" aria-hidden="true" /> AI
            credits
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            GPT 6 Luna answers in chat, briefings and reflections use credits
            (costs are listed on the Plans page). Failed answers cost nothing.
          </p>
        </div>
        <div className="text-right">
          <p
            data-testid="credits-card-available"
            className="text-2xl font-semibold tabular-nums text-ink"
          >
            {balance?.available ?? "—"}
          </p>
          <p className="text-[11px] text-ink-3">
            available{balance?.reserved ? ` · ${balance.reserved} held` : ""}
          </p>
          <Link
            href="/plans"
            data-testid="credits-card-view-plans"
            className="whitespace-nowrap text-[11px] font-medium text-accent-ink hover:underline"
          >
            View plans
          </Link>
        </div>
      </header>
      {balance && balance.available <= lowThreshold && (
        <p
          data-testid="credits-card-low"
          className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        >
          You&apos;re running low on AI credits.{" "}
          <Link
            href="/plans"
            data-testid="credits-card-plans-link"
            className="underline underline-offset-2"
          >
            See plans with monthly credits
          </Link>
        </p>
      )}
      {forecast && (
        <p
          data-testid="credits-card-forecast"
          className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-2"
        >
          {forecast.daysLeft != null
            ? `About ${forecast.daysLeft} day${forecast.daysLeft === 1 ? "" : "s"} left at your recent pace. ${forecast.used7d} credit${forecast.used7d === 1 ? "" : "s"} used in the last 7 days.`
            : "No AI credits used in the last two weeks."}
        </p>
      )}
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-3">
        History
      </h3>
      <ul
        data-testid="credits-history"
        className="mt-2 divide-y divide-line/60"
      >
        {entries?.map((e) => (
          <li
            key={e.id}
            data-testid={`credits-history-${e.id}`}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{LABELS[e.type] ?? e.type}</p>
              <p className="truncate text-xs text-ink-3">
                {e.reason} · {new Date(e.created_at).toLocaleString()}
              </p>
            </div>
            <span className="shrink-0 tabular-nums text-ink-2">
              {amountText(e)}
            </span>
          </li>
        ))}
        {entries?.length === 0 && (
          <li className="py-3 text-sm text-ink-3">No credit activity yet.</li>
        )}
        {!entries && <li className="py-3 text-sm text-ink-3">Loading…</li>}
      </ul>
    </section>
  );
}
