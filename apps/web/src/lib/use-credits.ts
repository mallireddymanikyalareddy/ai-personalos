"use client";

import * as React from "react";

import { CREDITS_EVENT } from "@/lib/ai-stream";

export const LOW_CREDITS = 3;
export type CreditBalance = { available: number; reserved: number };

export function useCredits(enabled: boolean) {
  const [balance, setBalance] = React.useState<CreditBalance | null>(null);
  const load = React.useCallback(() => {
    fetch("/api/v1/credits", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<CreditBalance>) : null))
      .then(setBalance)
      .catch(() => undefined);
  }, []);
  React.useEffect(() => {
    if (!enabled) return;
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener(CREDITS_EVENT, load);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener(CREDITS_EVENT, load);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [enabled, load]);
  return { balance, reload: load };
}
