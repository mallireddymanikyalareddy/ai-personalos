"use client";

import Link from "next/link";

import { Sparkles } from "lucide-react";

import { cn } from "@/lib/cn";
import { useCredits } from "@/lib/use-credits";
import { useAuth } from "@/modules/auth/auth-context";

export function CreditBadge() {
  const { status } = useAuth();
  const { balance, lowThreshold } = useCredits(status === "authenticated");
  if (!balance) return null;
  const low = balance.available <= lowThreshold;
  const planShort = balance.planName
    ? balance.planName.replace(/^PersonalOS\s*/i, "")
    : null;
  const reset = balance.nextResetAt
    ? new Date(balance.nextResetAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : null;
  return (
    <Link
      href="/settings?tab=ai"
      data-testid="credit-badge"
      data-low={low}
      title={`${planShort ? `${planShort} · ` : ""}${balance.available} AI credits available${
        reset ? ` · resets ${reset}` : ""
      }`}
      aria-label={`${planShort ? `${planShort}, ` : ""}${balance.available} AI credits available${
        reset ? `, resets ${reset}` : ""
      }${low ? ", running low" : ""}`}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium tabular-nums transition-colors",
        low
          ? "border-amber-300/70 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      <Sparkles className="size-3.5" aria-hidden="true" />
      <span data-testid="credit-badge-count">{balance.available}</span>
      <span className="hidden sm:inline">
        {low ? "credits left" : "credits"}
      </span>
      {planShort && (
        <span className="hidden border-l border-line pl-1 text-[10px] text-ink-3 md:inline" data-testid="credit-badge-plan">
          {planShort}
        </span>
      )}
    </Link>
  );
}
