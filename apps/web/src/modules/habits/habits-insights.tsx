"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import { ArrowUpRight, Lightbulb, Sparkles, Star, TrendingUp, Trophy } from "lucide-react";

import type { HabitInsight } from "@personalos/core";

import { SuccessDonut } from "./habits-charts";

const TONE: Record<HabitInsight["tone"], { icon: LucideIcon; className: string }> = {
  success: { icon: TrendingUp, className: "bg-success-soft text-success" },
  accent: { icon: Trophy, className: "bg-warning-soft text-warning" },
  warning: { icon: ArrowUpRight, className: "bg-danger-soft text-danger" },
};

export function HabitInsights({
  rate,
  insights,
}: {
  rate: number;
  insights: HabitInsight[];
}) {
  return (
    <section
      aria-label="Habit Insights"
      data-testid="habits-insights"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          Habit Insights
        </h2>
        <a href="/analytics" className="text-xs font-medium text-accent-ink hover:underline">
          View Details
        </a>
      </header>

      <div className="flex items-center gap-4">
        <SuccessDonut rate={rate} />
        <ul className="min-w-0 flex-1 space-y-2.5">
          {insights.length === 0 ? (
            <li className="text-[12px] text-ink-3">Add a habit to unlock insights.</li>
          ) : (
            insights.map((insight) => {
              const tone = TONE[insight.tone];
              const Icon = insight.id === "strongest" ? Star : tone.icon;
              const iconClassName =
                insight.id === "strongest" ? "bg-accent-soft text-accent-ink" : tone.className;
              return (
                <li key={insight.id} className="flex items-start gap-2.5">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-lg ${iconClassName}`}
                    aria-hidden="true"
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="text-[12px] leading-snug text-ink-2">{insight.text}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
}

export const MOTIVATION_QUOTES = [
  "Small steps create big changes!",
  "Consistency beats intensity, every time.",
  "You are one check-in away from a new best streak.",
  "Progress, not perfection.",
  "Start today, not Monday.",
];

export function MotivationCard({
  currentStreak,
  quote,
}: {
  currentStreak: number;
  quote: string;
}) {
  return (
    <div
      data-testid="habits-motivation"
      className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-success-soft via-surface to-info-soft p-4 shadow-card"
    >
      <Lightbulb className="mb-2 size-5 text-success" aria-hidden="true" />
      <p className="text-[15px] font-bold leading-snug text-ink" data-testid="habits-motivation-quote">
        {quote}
      </p>
      <p className="mt-1 text-[11px] text-ink-2">
        {currentStreak > 0
          ? `Keep building your habits — ${currentStreak} day streak alive.`
          : "Keep building your habits."}
      </p>
    </div>
  );
}