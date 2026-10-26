"use client";

import * as React from "react";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { TaskBreakdownRow, TaskStatusSegment } from "@personalos/core";

/**
 * Bars are rendered with plain elements rather than a charting library: recharts'
 * Bar shapes do not paint reliably, whereas these are deterministic, styled with
 * the same design tokens, and fully testable.
 */
export function ProjectBars({ rows }: { rows: TaskBreakdownRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-3">
        No projects yet.
      </p>
    );
  }

  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <ul className="space-y-2.5" data-testid="tasks-project-bars">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3" data-testid="tasks-project-bar">
          <span className="flex w-28 shrink-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
            <span className="truncate text-[12px] text-ink-2">{row.label}</span>
          </span>
          <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              data-testid="tasks-project-bar-fill"
              className="block h-full rounded-full"
              style={{ width: `${Math.round((row.count / max) * 100)}%`, backgroundColor: row.color }}
            />
          </span>
          <span className="w-6 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink">
            {row.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StatusBars({ segments }: { segments: TaskStatusSegment[] }) {
  if (segments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-3">
        No status data yet.
      </p>
    );
  }

  const max = Math.max(...segments.map((segment) => segment.count), 1);

  return (
    <div className="flex h-40 items-end gap-3" data-testid="tasks-status-bars">
      {segments.map((segment) => (
        <div key={segment.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[12px] font-semibold tabular-nums text-ink">{segment.count}</span>
          <span
            data-testid="tasks-status-bar"
            className="w-full max-w-14 rounded-t-md"
            style={{
              height: `${Math.max(6, Math.round((segment.count / max) * 100))}%`,
              backgroundColor: segment.color,
            }}
            aria-label={`${segment.label}: ${segment.count} tasks`}
          />
          <span className="w-full truncate text-center text-[10px] text-ink-3">{segment.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PriorityDonut({ rows, total }: { rows: TaskBreakdownRow[]; total: number }) {
  const segments = rows.map((row) => ({ key: row.key, label: row.label, value: row.count, color: row.color }));

  return (
    <div className="flex items-center gap-4" data-testid="tasks-priority-donut">
      <div className="relative shrink-0">
        <ResponsiveContainer width={128} height={128}>
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={58}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {segments.map((segment) => (
                <Cell key={segment.key} fill={segment.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-lg font-bold tabular-nums text-ink">{total}</span>
            <span className="block text-[10px] leading-tight text-ink-3">Tasks</span>
          </span>
        </span>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.length === 0 ? (
          <li className="text-[12px] text-ink-3">No tasks yet.</li>
        ) : (
          segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2 text-[12px]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink-2">{segment.label}</span>
              <span className="shrink-0 text-ink-3">
                {segment.value} ({Math.round((segment.value / Math.max(1, total)) * 100)}%)
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function CompletionDonut({
  rate,
  segments,
}: {
  rate: number;
  segments: TaskStatusSegment[];
}) {
  const data = [
    { key: "achieved", value: rate, fill: "var(--success)" },
    { key: "remaining", value: Math.max(0, 100 - rate), fill: "var(--surface-3)" },
  ];

  return (
    <div className="flex items-center gap-4" data-testid="tasks-completion-donut">
      <div className="relative shrink-0">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={54}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((segment) => (
                <Cell key={segment.key} fill={segment.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-lg font-bold tabular-nums text-ink">{rate}%</span>
            <span className="block text-[10px] leading-tight text-ink-3">Completion</span>
            <span className="block text-[10px] leading-tight text-ink-3">Rate</span>
          </span>
        </span>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.length === 0 ? (
          <li className="text-[12px] text-ink-3">No tasks yet.</li>
        ) : (
          segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2 text-[12px]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink-2">{segment.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-ink">{segment.count}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function StatusLegend({ segments }: { segments: TaskStatusSegment[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2" data-testid="tasks-status-legend">
      {segments.map((segment) => (
        <li key={segment.key} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
          {segment.label}
        </li>
      ))}
    </ul>
  );
}