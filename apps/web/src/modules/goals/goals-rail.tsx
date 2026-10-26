"use client";

import * as React from "react";

import { Flag, TrendingUp } from "lucide-react";

import type { GoalHealth, GoalMilestoneRow } from "@personalos/core";

import { GOAL_CATEGORY_COLOR, formatGoalDate } from "./goals-meta";
import { HealthDonut } from "./goals-charts";

function RailShell({
  title,
  icon,
  action,
  testId,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: { label: string; href: string };
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {icon}
          {title}
        </h2>
        {action ? (
          <a href={action.href} className="text-xs font-medium text-accent-ink hover:underline">
            {action.label}
          </a>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function UpcomingMilestones({ rows }: { rows: GoalMilestoneRow[] }) {
  return (
    <RailShell
      testId="goals-milestones"
      title="Upcoming Milestones"
      icon={<Flag className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "View all", href: "/work" }}
    >
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-3">
          No upcoming milestones. Link a project to a goal and add milestones.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="goals-milestone-list">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-[12px]" data-testid="goals-milestone-row">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: row.category ? GOAL_CATEGORY_COLOR[row.category] : "var(--chart-8)" }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-ink-2">{row.title}</span>
              <span className="shrink-0 text-[11px] text-ink-3">{formatGoalDate(row.dueAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </RailShell>
  );
}

export function GoalInsightsPanel({
  health,
  overallProgress,
  insight,
}: {
  health: Record<GoalHealth, number>;
  overallProgress: number;
  insight: string;
}) {
  return (
    <RailShell
      testId="goals-insights"
      title="Goal Insights"
      icon={<TrendingUp className="size-4 text-accent" aria-hidden="true" />}
    >
      <HealthDonut health={health} overallProgress={overallProgress} />
      <p
        data-testid="goals-insight-text"
        className="mt-3 rounded-lg bg-success-soft p-2.5 text-[12px] leading-relaxed text-success"
      >
        {insight}
      </p>
    </RailShell>
  );
}