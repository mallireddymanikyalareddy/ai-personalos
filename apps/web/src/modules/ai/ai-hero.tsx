"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  CalendarDays,
  ChartNoAxesColumn,
  Compass,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

export interface AIFeature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}

const FLOATING_ICONS: { icon: LucideIcon; className: string; tone: string }[] = [
  { icon: CalendarDays, className: "left-[46%] top-6", tone: "bg-accent-soft text-accent-ink" },
  { icon: Sparkles, className: "right-[42%] top-10", tone: "bg-success-soft text-success" },
  { icon: Zap, className: "right-[30%] top-24", tone: "bg-warning-soft text-warning" },
  { icon: Compass, className: "left-[38%] bottom-8", tone: "bg-info-soft text-info" },
  { icon: ChartNoAxesColumn, className: "right-[38%] bottom-8", tone: "bg-danger-soft text-danger" },
];

export function AIHero() {
  return (
    <section
      aria-label="AI assistant hero"
      data-testid="ai-hero"
      className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-accent-soft via-surface to-info-soft p-5 shadow-card sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(40rem 18rem at 100% -20%, var(--accent-soft), transparent 60%), radial-gradient(30rem 16rem at 0% 120%, var(--info-soft), transparent 60%)",
        }}
      />

      <div className="relative max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-ink">
          <Sparkles className="size-3" aria-hidden="true" />
          AI Assistant
        </span>
        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          Your personal AI
          <br />
          for a more{" "}
          <span className="bg-gradient-to-r from-accent to-chart-4 bg-clip-text text-transparent">
            intentional life.
          </span>
        </h1>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-2">
          Plan, organize, get insights and take action — all in one place. personalOS understands
          your goals, schedule and context to give you personalised suggestions.
        </p>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-72 items-center justify-center lg:flex">
        <div className="relative grid size-32 place-items-center rounded-full bg-surface/60 shadow-card">
          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-accent-soft to-info-soft" />
          <Sparkles className="relative size-10 text-accent-ink" aria-hidden="true" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        {FLOATING_ICONS.map((entry) => {
          const Icon = entry.icon;
          return (
            <span
              key={entry.className}
              className={`absolute grid size-9 place-items-center rounded-xl shadow-card ${entry.className} ${entry.tone}`}
            >
              <Icon className="size-4" />
            </span>
          );
        })}
      </div>
    </section>
  );
}

export function AIFeatureCards({
  features,
  onRun,
}: {
  features: AIFeature[];
  onRun: (feature: AIFeature) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="ai-features">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <button
            key={feature.id}
            type="button"
            data-testid={`ai-feature-${feature.id}`}
            onClick={() => onRun(feature)}
            className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-2/60"
          >
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${feature.tone}`} aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{feature.title}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{feature.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function defaultAIFeatures(goalTitle: string | null): AIFeature[] {
  return [
    {
      id: "plan-day",
      title: "Plan my day",
      description: "Turn your priorities into a realistic plan",
      icon: Zap,
      tone: "bg-warning-soft text-warning",
    },
    {
      id: "break-goals",
      title: "Break down goals",
      description: goalTitle != null ? `Create actionable steps for “${goalTitle}”` : "Create actionable steps and timelines",
      icon: Target,
      tone: "bg-accent-soft text-accent-ink",
    },
    {
      id: "scheduling",
      title: "Smart scheduling",
      description: "Find the best time for your tasks and habits",
      icon: CalendarDays,
      tone: "bg-info-soft text-info",
    },
    {
      id: "insights",
      title: "Get insights",
      description: "See progress and personalised advice",
      icon: ChartNoAxesColumn,
      tone: "bg-danger-soft text-danger",
    },
  ];
}