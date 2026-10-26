"use client";

import * as React from "react";

import { ChartLine, Sparkles } from "lucide-react";

import type { TaskInsight, TaskStatusSegment } from "@personalos/core";

import { CompletionDonut } from "./tasks-charts";

export function TaskInsightsPanel({
  rate,
  segments,
  insight,
  period,
  onPeriodChange,
}: {
  rate: number;
  segments: TaskStatusSegment[];
  insight: TaskInsight | null;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  return (
    <section
      aria-label="Task Insights"
      data-testid="tasks-insights"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          Task Insights
        </h2>
        <select
          value={period}
          onChange={(event) => onPeriodChange(event.target.value)}
          aria-label="Insight period"
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink-2"
        >
          <option value="This Month">This Month</option>
          <option value="This Week">This Week</option>
          <option value="Last Month">Last Month</option>
        </select>
      </header>

      <CompletionDonut rate={rate} segments={segments} />

      {insight ? (
        <p
          data-testid="tasks-insight-text"
          className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
        >
          <ChartLine className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <span>{insight.text}</span>
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line p-3 text-[12px] text-ink-3">
          Capture a few tasks to unlock productivity insights.
        </p>
      )}
    </section>
  );
}