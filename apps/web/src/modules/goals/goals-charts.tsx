"use client";

import * as React from "react";

import {
  BarChart as RechartsBarChart,
  Bar,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { GoalCategory, GoalHealth } from "@personalos/core";

import { GOAL_CATEGORY_COLOR } from "./goals-meta";
import { cn } from "@/lib/cn";

export function CategoryBars({
  rows,
}: {
  rows: Array<{ category: GoalCategory; label: string; progress: number; count: number }>;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-3">No goals yet.</p>;
  }

  const data = rows.map((row) => ({
    name: row.label,
    progress: row.progress,
    fill: GOAL_CATEGORY_COLOR[row.category],
  }));

  return (
    <div data-testid="goals-category-bars" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressLine({
  points,
}: {
  points: Array<{ key: string; label: string; progress: number }>;
}) {
  const data = points.map((point) => ({ name: point.label, progress: point.progress }));

  return (
    <div data-testid="goals-progress-line" className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--ink-3)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            domain={[0, 100]}
            padding={{ bottom: 14 }}
            tick={{ fontSize: 10, fill: "var(--ink-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--line)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="progress"
            stroke="var(--chart-6)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "var(--surface)", stroke: "var(--chart-6)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HealthDonut({
  health,
  overallProgress,
}: {
  health: Record<GoalHealth, number>;
  overallProgress: number;
}) {
  const segments: Array<{ key: string; label: string; value: number; color: string }> = [
    { key: "on_track", label: "On Track", value: health.on_track, color: "var(--success)" },
    { key: "ahead", label: "Ahead", value: health.ahead, color: "var(--chart-5)" },
    { key: "at_risk", label: "At Risk", value: health.at_risk, color: "var(--chart-3)" },
    { key: "overdue", label: "Overdue", value: health.overdue, color: "var(--danger)" },
    { key: "on_hold", label: "On Hold", value: health.on_hold, color: "var(--chart-8)" },
  ].filter((segment) => segment.value > 0);

  return (
    <div className="flex items-center gap-4" data-testid="goals-health-donut">
      <div className="relative shrink-0">
        <ResponsiveContainer width={116} height={116}>
          <PieChart>
            <Pie
              data={segments.length > 0 ? segments : [{ key: "empty", label: "None", value: 1, color: "var(--surface-2)" }]}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={34}
              outerRadius={50}
              paddingAngle={2}
              stroke="none"
            >
              {segments.length > 0
                ? segments.map((segment) => <Cell key={segment.key} fill={segment.color} />)
                : [<Cell key="empty" fill="var(--surface-2)" />]}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-center">
            <span className="block text-lg font-semibold tabular-nums text-ink">{overallProgress}%</span>
            <span className="block text-[10px] text-ink-3">Overall</span>
          </span>
        </span>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.length === 0 ? (
          <li className="text-[12px] text-ink-3">No active goals.</li>
        ) : (
          segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2 text-[12px]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink-2">{segment.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-ink">{segment.value}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function MiniBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.round((value / max) * 100);
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-surface-2", className)}>
      <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}