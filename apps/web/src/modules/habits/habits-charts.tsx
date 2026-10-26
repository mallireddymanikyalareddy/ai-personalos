"use client";

import * as React from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
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

import type { HabitMonthPoint } from "@personalos/core";

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12,
} as const;

const AXIS_TICK = { fontSize: 10, fill: "var(--ink-3)" } as const;

export function SuccessDonut({ rate, size = 132 }: { rate: number; size?: number }) {
  const outer = size / 2;
  const segments = [
    { key: "achieved", value: rate, fill: "var(--chart-3)" },
    { key: "remaining", value: Math.max(0, 100 - rate), fill: "var(--surface-3)" },
  ];

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      data-testid="habits-donut"
    >
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="key"
            cx="50%"
            cy="50%"
            innerRadius={outer * 0.62}
            outerRadius={outer * 0.9}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {segments.map((segment) => (
              <Cell key={segment.key} fill={segment.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <span>
          <span className="block text-xl font-bold tabular-nums text-ink">{rate}%</span>
          <span className="block text-[10px] leading-tight text-ink-3">Overall</span>
          <span className="block text-[10px] leading-tight text-ink-3">Success</span>
        </span>
      </span>
    </div>
  );
}

export function MonthTrend({ points }: { points: HabitMonthPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-3">
        No check-ins recorded this month yet.
      </p>
    );
  }

  const data = points.map((point) => ({ label: point.label, rate: point.rate }));

  return (
    <div className="h-44 w-full" data-testid="habits-month-trend">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="habit-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            domain={[0, 100]}
            padding={{ bottom: 14 }}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip
            cursor={{ stroke: "var(--line)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${String(value)}%`, "Success"]}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--chart-5)"
            strokeWidth={2.5}
            fill="url(#habit-trend-fill)"
            dot={{ r: 2, fill: "var(--surface)", stroke: "var(--chart-5)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SuccessLine({ points }: { points: HabitMonthPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-3">
        No check-ins recorded this month yet.
      </p>
    );
  }

  const data = points.map((point) => ({ label: point.label, rate: point.rate }));

  return (
    <div className="h-44 w-full" data-testid="habits-month-line">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            domain={[0, 100]}
            padding={{ bottom: 14 }}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip
            cursor={{ stroke: "var(--line)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${String(value)}%`, "Success"]}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--chart-5)"
            strokeWidth={2.5}
            dot={{ r: 2, fill: "var(--surface)", stroke: "var(--chart-5)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}