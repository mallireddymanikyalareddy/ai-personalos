"use client";

import * as React from "react";

import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyProductivity, InsightAreaFocus } from "@personalos/core";

import { cn } from "@/lib/cn";

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12,
} as const;

const AXIS_TICK = { fontSize: 10, fill: "var(--ink-3)" } as const;

export function ProductivityTrend({ days }: { days: DailyProductivity[] }) {
  if (days.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-3">
        No activity in this window yet.
      </p>
    );
  }

  const data = days.map((day) => ({ label: day.label, rate: day.rate }));
  const last = days[days.length - 1]!;

  return (
    <div className="relative h-56 w-full" data-testid="insights-trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 24, left: -18, bottom: 0 }}>
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value}%`}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "var(--line)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${String(value)}%`, "Productivity"]}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--chart-5)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--chart-5)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <span className="pointer-events-none absolute right-2 top-2 rounded-lg bg-chart-5 px-2 py-1 text-[11px] font-semibold text-white">
        {last.rate}%
      </span>
    </div>
  );
}

export function DistributionDonut({
  slices,
  totalLabel,
  centerValue,
}: {
  slices: InsightAreaFocus[];
  totalLabel: string;
  centerValue: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.minutes, 0);
  const data = slices.map((slice) => ({
    key: slice.area,
    label: slice.label,
    minutes: slice.minutes,
    pct: total > 0 ? Math.round((slice.minutes / total) * 100) : 0,
    color:
      slice.area === "work"
        ? "var(--chart-5)"
        : slice.area === "personal"
          ? "var(--chart-7)"
          : slice.area === "learning"
            ? "var(--chart-6)"
            : slice.area === "health"
              ? "var(--chart-4)"
              : slice.area === "finance"
                ? "var(--chart-3)"
                : "var(--chart-8)",
  }));

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 148, height: 148 }}>
        <ResponsiveContainer width={148} height={148}>
          <PieChart>
            <Pie
              data={data}
              dataKey="minutes"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={1}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-xl font-bold tabular-nums text-ink">{centerValue}</span>
            <span className="block text-[10px] text-ink-3">{totalLabel}</span>
          </span>
        </span>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.length === 0 ? (
          <li className="text-[12px] text-ink-3">No focus time recorded yet.</li>
        ) : (
          data.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2 text-[12px]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink-2">{slice.label}</span>
              <span className="shrink-0 tabular-nums text-ink-2">{formatHours(slice.minutes)}</span>
              <span className="w-8 shrink-0 text-right tabular-nums text-ink-3">{slice.pct}%</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function ScoreDonut({
  percent,
  caption,
  legend,
}: {
  percent: number;
  caption: string;
  legend: { label: string; value: string; tone: string }[];
}) {
  const data = [
    { key: "score", value: percent },
    { key: "rest", value: Math.max(0, 100 - percent) },
  ];

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
        <ResponsiveContainer width={128} height={128}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={60}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              <Cell key="score" fill="var(--chart-6)" />
              <Cell key="rest" fill="var(--surface-3)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-xl font-bold tabular-nums text-ink">{percent}%</span>
            <span className="block text-[10px] text-ink-3">{caption}</span>
          </span>
        </span>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {legend.map((entry) => (
          <li key={entry.label} className="flex items-center gap-2 text-[12px]">
            <span className={cn("size-4 shrink-0 rounded-full", entry.tone)} aria-hidden="true" />
            <span className="shrink-0 font-semibold tabular-nums text-ink">{entry.value}</span>
            <span className="min-w-0 flex-1 truncate text-ink-2">{entry.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MiniBars({
  values,
  labels,
  color = "var(--chart-5)",
}: {
  values: number[];
  labels: string[];
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-24 items-end gap-1.5" data-testid="insights-mini-bars">
      {values.map((value, index) => (
        <div key={labels[index] ?? index} className="flex flex-1 flex-col items-center gap-1">
          <span
            className="w-full rounded-t"
            style={{ height: `${Math.max(6, (value / max) * 78)}%`, backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="text-[9px] text-ink-3">{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}

export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
