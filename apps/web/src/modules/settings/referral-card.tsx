"use client";

import * as React from "react";

import { Copy, Gift, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type ReferralSummary = {
  code: string;
  invited: number;
  creditsEarned: number;
  recent: { handle: string; credits: number; createdAt: string | null }[];
};

export function ReferralCard() {
  const { toast } = useToast();
  const [data, setData] = React.useState<ReferralSummary | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/referrals", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<ReferralSummary>) : null))
      .then((value) => alive && setData(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!data) return null;
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${encodeURIComponent(data.code)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Referral link copied", { tone: "success" });
    } catch {
      toast(link, { tone: "success" });
    }
  };
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" data-testid="referral-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Gift className="size-4 text-accent" aria-hidden="true" />
            Invite friends
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            Share your code. You both receive credits when they create an account.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-ink-3">
          <Users className="size-3.5" aria-hidden="true" />
          {data.invited} invited · {data.creditsEarned} credits earned
        </span>
      </header>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code data-testid="referral-code" className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold tracking-wider text-ink">
          {data.code}
        </code>
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          <Copy className="size-3.5" aria-hidden="true" />
          Copy link
        </Button>
      </div>
      {data.recent.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-xs text-ink-2">
          {data.recent.map((item, index) => (
            <li key={`${item.handle}-${index}`} className="flex justify-between gap-3">
              <span>@{item.handle} joined</span>
              <span className="tabular-nums text-success">+{item.credits}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
