"use client";

import * as React from "react";

import { Sparkles } from "lucide-react";

import { CREDITS_EVENT } from "@/lib/ai-stream";
import { LOW_CREDITS, useCredits } from "@/lib/use-credits";

type Entry = { id: string; type: string; credits: number; available_delta: number; reserved_delta: number; reason: string; created_at: string };

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
  return e.available_delta > 0 ? `+${e.available_delta}` : String(e.available_delta);
}

export function CreditsCard() {
  const { balance } = useCredits(true);
  const [entries, setEntries] = React.useState<Entry[] | null>(null);
  React.useEffect(() => {
    const load = () =>
      fetch("/api/v1/credits/history?limit=50", { credentials: "include", cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ entries: Entry[] }>) : { entries: [] }))
        .then((d) => setEntries(d.entries))
        .catch(() => setEntries([]));
    load();
    window.addEventListener(CREDITS_EVENT, load);
    return () => window.removeEventListener(CREDITS_EVENT, load);
  }, []);
  return (
    <section data-testid="credits-card" className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent" aria-hidden="true" /> AI credits
          </h2>
          <p className="mt-1 text-xs text-ink-3">GPT 6 Luna answers use credits: chat 1, morning briefing 2, evening reflection 2. Failed answers cost nothing.</p>
        </div>
        <div className="text-right">
          <p data-testid="credits-card-available" className="text-2xl font-semibold tabular-nums text-ink">{balance?.available ?? "—"}</p>
          <p className="text-[11px] text-ink-3">available{balance?.reserved ? ` · ${balance.reserved} held` : ""}</p>
        </div>
      </header>
      {balance && balance.available <= LOW_CREDITS && (
        <p data-testid="credits-card-low" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          You&apos;re running low on AI credits. Plans with monthly credits are coming soon.
        </p>
      )}
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-3">History</h3>
      <ul data-testid="credits-history" className="mt-2 divide-y divide-line/60">
        {entries?.map((e) => (
          <li key={e.id} data-testid={`credits-history-${e.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">{LABELS[e.type] ?? e.type}</p>
              <p className="truncate text-xs text-ink-3">
                {e.reason} · {new Date(e.created_at).toLocaleString()}
              </p>
            </div>
            <span className="shrink-0 tabular-nums text-ink-2">{amountText(e)}</span>
          </li>
        ))}
        {entries?.length === 0 && <li className="py-3 text-sm text-ink-3">No credit activity yet.</li>}
        {!entries && <li className="py-3 text-sm text-ink-3">Loading…</li>}
      </ul>
    </section>
  );
}
