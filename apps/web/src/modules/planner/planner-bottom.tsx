"use client";

import * as React from "react";

import { CalendarDays, CheckCircle2, Target } from "lucide-react";

import type { Timestamp } from "@personalos/core";

import { cn } from "@/lib/cn";

export interface WeekDayCell {
  date: Timestamp;
  label: string;
  dayNumber: number;
  count: number;
  isToday: boolean;
}

export function WeeklyPlan({
  days,
  weekLabel,
  selected,
  onSelect,
  onShift,
  onViewFullWeek,
}: {
  days: WeekDayCell[];
  weekLabel: string;
  selected: Timestamp;
  onSelect: (date: Timestamp) => void;
  onShift: (direction: number) => void;
  onViewFullWeek: () => void;
}) {
  return (
    <section
      aria-label="Weekly Plan"
      data-testid="planner-weekly"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarDays className="size-4 text-accent-ink" aria-hidden="true" />
          Weekly Plan
        </h2>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] text-ink-3">{weekLabel}</span>
          <button
            type="button"
            onClick={() => onShift(-1)}
            aria-label="Previous week"
            className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => onShift(1)}
            aria-label="Next week"
            className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <span aria-hidden="true">›</span>
          </button>
          <button
            type="button"
            onClick={onViewFullWeek}
            className="ml-1 text-[11px] font-medium text-accent-ink hover:underline"
          >
            View full week
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const isSelected = day.date === selected;
          return (
            <button
              key={day.date}
              type="button"
              data-testid="planner-week-day"
              onClick={() => onSelect(day.date)}
              aria-pressed={isSelected}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors",
                isSelected
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface-2/50 hover:border-line-strong hover:bg-surface-2",
              )}
            >
              <span className="text-[10px] font-medium text-ink-3">{day.label}</span>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-[13px] font-semibold tabular-nums",
                  day.isToday ? "bg-accent text-white" : "text-ink",
                )}
              >
                {day.dayNumber}
              </span>
              <span className="text-[10px] tabular-nums text-ink-3">
                {day.count} {day.count === 1 ? "item" : "items"}
              </span>
              <span
                className={cn("h-0.5 w-full rounded-full", isSelected ? "bg-accent" : "bg-transparent")}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export interface GoalProgressRow {
  id: string;
  title: string;
  progress: number;
}

export function GoalProgressList({ rows }: { rows: GoalProgressRow[] }) {
  return (
    <section
      aria-label="Goal Progress"
      data-testid="planner-goals"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Target className="size-4 text-accent-ink" aria-hidden="true" />
          Goal Progress
        </h2>
        <a href="/goals" className="text-xs font-medium text-accent-ink hover:underline">
          View all
        </a>
      </header>

      {rows.length === 0 ? (
        <p className="text-[12px] text-ink-3">No active goals yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.id} data-testid="planner-goal-row">
              <div className="mb-1 flex items-center justify-between gap-2">
                <a
                  href="/goals"
                  className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink hover:text-accent-ink hover:underline"
                >
                  {row.title}
                </a>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{row.progress}%</span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${row.progress}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface HabitTile {
  id: string;
  title: string;
  done: number;
  target: number;
  checked: boolean;
}

export function HabitTracker({ tiles, onToggle }: { tiles: HabitTile[]; onToggle?: (id: string) => void }) {
  return (
    <section
      aria-label="Habit Tracker"
      data-testid="planner-habits"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CheckCircle2 className="size-4 text-accent-ink" aria-hidden="true" />
          Habit Tracker
        </h2>
        <a href="/habits" className="text-xs font-medium text-accent-ink hover:underline">
          View all
        </a>
      </header>

      {tiles.length === 0 ? (
        <p className="text-[12px] text-ink-3">No habits tracked yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              data-testid="planner-habit-tile"
              onClick={() => onToggle?.(tile.id)}
              aria-pressed={tile.checked}
              aria-label={`${tile.checked ? "Uncheck" : "Check"} ${tile.title}`}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors hover:border-line-strong",
                tile.checked ? "border-success/40 bg-success-soft" : "border-line bg-surface-2/50",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full",
                  tile.checked ? "bg-success text-white" : "border border-line-strong text-ink-3",
                )}
                aria-hidden="true"
              >
                {tile.checked ? "✓" : ""}
              </span>
              <span className="w-full truncate text-[11px] font-medium text-ink">{tile.title}</span>
              <span className="text-[10px] tabular-nums text-ink-3">
                {tile.done}/{tile.target}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}