"use client";

import * as React from "react";

import Link from "next/link";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  refund: "Refunded",
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
  const { balance, lowThreshold, reload } = useCredits(true);
  const { toast } = useToast();
  const [entries, setEntries] = React.useState<Entry[] | null>(null);
  const [forecast, setForecast] = React.useState<Forecast | null>(null);
  const [code, setCode] = React.useState("");
  const [redeemBusy, setRedeemBusy] = React.useState(false);
  const [giftTo, setGiftTo] = React.useState("");
  const [giftAmount, setGiftAmount] = React.useState("");
  const [giftNote, setGiftNote] = React.useState("");
  const [giftBusy, setGiftBusy] = React.useState(false);
  const gift = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number.parseInt(giftAmount, 10);
    if (!giftTo.trim() || !Number.isInteger(amount) || amount < 1) return;
    setGiftBusy(true);
    try {
      const res = await fetch("/api/v1/credits/gift", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: giftTo.trim(),
          amount,
          note: giftNote.trim() || null,
          requestId: `gift-${crypto.randomUUID()}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; recipientHandle?: string };
      if (!res.ok) throw new Error(data.detail ?? "Gift could not be sent.");
      toast(`Sent ${amount} credits to @${data.recipientHandle ?? giftTo.trim()}`, { tone: "success" });
      setGiftTo("");
      setGiftAmount("");
      setGiftNote("");
      reload();
      window.dispatchEvent(new Event(CREDITS_EVENT));
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setGiftBusy(false);
    }
  };
  const redeem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setRedeemBusy(true);
    try {
      const res = await fetch("/api/v1/promotions/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; credits?: number };
      if (!res.ok) throw new Error(data.detail ?? "That code could not be redeemed.");
      toast(`Added ${data.credits ?? 0} credits`, { tone: "success" });
      setCode("");
      reload();
      window.dispatchEvent(new Event(CREDITS_EVENT));
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setRedeemBusy(false);
    }
  };
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
      {balance?.planId && (
        <dl
          data-testid="credits-card-plan"
          className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2/50 p-3 text-xs"
        >
          <div>
            <dt className="text-ink-3">Plan</dt>
            <dd className="font-medium text-ink" data-testid="credits-card-plan-name">
              {balance.planName}
              {balance.billing ? ` · ${balance.billing}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Next reset</dt>
            <dd className="font-medium text-ink" data-testid="credits-card-reset">
              {balance.nextResetAt
                ? new Date(balance.nextResetAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Monthly allowance</dt>
            <dd className="font-medium text-ink" data-testid="credits-card-allowance">
              {balance.allowance ?? 0} credits
              {balance.annualBonus
                ? ` (includes ${balance.annualBonus} annual bonus)`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Buckets</dt>
            <dd className="font-medium text-ink" data-testid="credits-card-buckets">
              {balance.included ?? 0} included · {balance.promotional ?? 0} promo ·{" "}
              {balance.purchased ?? 0} purchased
            </dd>
          </div>
        </dl>
      )}
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
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={redeem}>
        <input
          data-testid="credits-redeem-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Have a promo code?"
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-xs text-ink focus:border-accent focus:outline-none"
        />
        <Button size="sm" type="submit" loading={redeemBusy} disabled={!code.trim()}>
          Redeem
        </Button>
      </form>
      <form className="mt-3 space-y-2 rounded-xl border border-line bg-surface-2 p-3" onSubmit={gift}>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Gift credits</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={giftTo}
            onChange={(event) => setGiftTo(event.target.value)}
            placeholder="Handle or email"
            aria-label="Recipient"
            className="h-8 rounded-lg border border-line bg-bg px-3 text-xs text-ink focus:border-accent focus:outline-none"
          />
          <input
            value={giftAmount}
            onChange={(event) => setGiftAmount(event.target.value.replace(/\D/g, ""))}
            placeholder="Credits"
            inputMode="numeric"
            aria-label="Gift amount"
            className="h-8 rounded-lg border border-line bg-bg px-3 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>
        <input
          value={giftNote}
          onChange={(event) => setGiftNote(event.target.value)}
          placeholder="Note (optional)"
          aria-label="Gift note"
          className="h-8 w-full rounded-lg border border-line bg-bg px-3 text-xs text-ink focus:border-accent focus:outline-none"
        />
        <Button size="sm" type="submit" loading={giftBusy} disabled={!giftTo.trim() || !giftAmount}>
          Send gift
        </Button>
      </form>
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
