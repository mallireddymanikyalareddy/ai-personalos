"use client";

import * as React from "react";

import Link from "next/link";

import { ArrowRight, Sparkles, X } from "lucide-react";

import { LOW_CREDITS, useCredits } from "@/lib/use-credits";
import { useAuth } from "@/modules/auth/auth-context";

const dismissKey = () =>
  `personalos:upgrade-dismissed:${new Date().toDateString()}`;

export function UpgradeCard() {
  const { status } = useAuth();
  const { balance } = useCredits(status === "authenticated");
  const [dismissed, setDismissed] = React.useState(true);
  React.useEffect(
    () => setDismissed(window.localStorage.getItem(dismissKey()) === "1"),
    [],
  );
  if (!balance || balance.available > LOW_CREDITS || dismissed) return null;
  const empty = balance.available === 0;
  return (
    <section
      data-testid="upgrade-card"
      className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 pr-10 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p
            className="text-sm font-semibold text-amber-900 dark:text-amber-200"
            data-testid="upgrade-card-title"
          >
            {empty
              ? "You're out of AI credits"
              : `Only ${balance.available} AI credit${balance.available === 1 ? "" : "s"} left`}
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
            The AI plans add fresh credits every month for chat, briefings and
            reflections.
          </p>
        </div>
      </div>
      <Link
        href="/plans"
        data-testid="upgrade-card-link"
        className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
      >
        Get more credits <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
      <button
        type="button"
        aria-label="Dismiss for today"
        data-testid="upgrade-card-dismiss"
        onClick={() => (
          window.localStorage.setItem(dismissKey(), "1"),
          setDismissed(true)
        )}
        className="absolute right-2 top-2 rounded-md p-1 text-amber-700/70 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300/70 dark:hover:bg-amber-500/20"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
