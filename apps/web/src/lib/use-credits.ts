"use client";

import * as React from "react";

import { CREDITS_EVENT } from "@/lib/ai-stream";

export const LOW_CREDITS = 3;
export type CreditBalance = {
  available: number;
  reserved: number;
  included?: number;
  promotional?: number;
  purchased?: number;
  planId?: string | null;
  planName?: string | null;
  status?: string | null;
  billing?: string | null;
  nextResetAt?: string | null;
  allowance?: number;
  annualBonus?: number;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: string | null;
};
export type PublicSettings = {
  lowCreditThreshold: number;
  flags: Record<string, boolean>;
};

const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  lowCreditThreshold: LOW_CREDITS,
  flags: { ai_confirmation_modal: true, annual_bonus_credits: true, promotions: true },
};

export function usePublicSettings() {
  const [settings, setSettings] = React.useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/settings/public", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<PublicSettings>) : null))
      .then((data) => {
        if (alive && data) {
          setSettings({
            lowCreditThreshold: data.lowCreditThreshold ?? LOW_CREDITS,
            flags: { ...DEFAULT_PUBLIC_SETTINGS.flags, ...(data.flags ?? {}) },
          });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}

export function useCredits(enabled: boolean) {
  const [balance, setBalance] = React.useState<CreditBalance | null>(null);
  const settings = usePublicSettings();
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
  return {
    balance,
    reload: load,
    lowThreshold: settings.lowCreditThreshold,
    flags: settings.flags,
  };
}
