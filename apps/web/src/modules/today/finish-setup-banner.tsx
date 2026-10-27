"use client";

import Link from "next/link";

import { ArrowRight, Sparkles } from "lucide-react";

import { useAuth } from "@/modules/auth/auth-context";

export function FinishSetupBanner() {
  const { profile } = useAuth();
  if (!profile?.onboardingSkipped) return null;
  return (
    <section
      data-testid="finish-setup-banner"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3"
    >
      <p className="flex items-center gap-2 text-sm text-accent-ink">
        <Sparkles className="size-4" aria-hidden="true" />
        Finish setting up PersonalOS — pick your life areas, rhythm and a first goal.
      </p>
      <Link
        href="/onboarding?resume=1"
        data-testid="finish-setup-link"
        className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        Finish setup
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
