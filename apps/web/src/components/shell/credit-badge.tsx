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
  return (
    <Link
      href="/settings?tab=ai"
      data-testid="credit-badge"
      data-low={low}
      title={
        low
          ? `Only ${balance.available} AI credits left`
          : `${balance.available} AI credits available`
      }
      aria-label={`${balance.available} AI credits available${low ? ", running low" : ""}`}
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
    </Link>
  );
}
