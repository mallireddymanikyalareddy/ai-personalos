"use client";

import * as React from "react";

import { Check, Flame } from "lucide-react";

import type { HabitCardRow } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { DropdownMenu } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";

import { HABIT_CADENCE_LABEL, habitColor, habitIcon, habitPriority } from "./habits-meta";

export interface HabitRowProps {
  row: HabitCardRow;
  archived?: boolean;
  onToggleDay: (habitId: string, dayStart: number) => void;
  onOpen?: (habitId: string) => void;
  onEdit?: (habitId: string) => void;
  onArchive?: (habitId: string) => void;
  onRestore?: (habitId: string) => void;
  onDelete?: (habitId: string) => void;
}

export function HabitRow({
  row,
  archived = false,
  onToggleDay,
  onOpen,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: HabitRowProps) {
  const Icon = habitIcon(row.icon);
  const color = habitColor(row.color);
  const priority = habitPriority(row.priority);

  return (
    <li
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:flex-nowrap"
      data-testid="habit-row"
      data-habit-id={row.id}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: color, color: "#fff" }}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen?.(row.id)}
            className="truncate text-sm font-semibold text-ink hover:text-accent-ink hover:underline"
            aria-label={`Open ${row.title}`}
          >
            {row.title}
          </button>
          {row.priority === "high" ? <Badge tone={priority.tone}>{priority.label}</Badge> : null}
        </div>
        <p className="truncate text-[11px] text-ink-3">
          {row.description ?? HABIT_CADENCE_LABEL[row.cadence]}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Flame className="size-4 text-warning" aria-hidden="true" />
        <span className="text-xs font-semibold tabular-nums text-ink">{row.currentStreak}</span>
        <span className="text-[10px] leading-tight text-ink-3">
          <span className="block">days</span>
          <span className="block">Streak</span>
        </span>
      </div>

      <div className="flex w-28 shrink-0 items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <span
            className="block h-full rounded-full"
            style={{ width: `${row.progress}%`, backgroundColor: color }}
          />
        </span>
        <span className="w-9 text-right text-[11px] font-medium tabular-nums text-ink-2">
          {row.progress}%
        </span>
      </div>

      <div
        role="group"
        aria-label={`${row.title} check-ins, this week`}
        className="flex shrink-0 items-center gap-1"
      >
        {row.week.map((day) => (
          <button
            key={day.dayStart}
            type="button"
            disabled={archived || day.isFuture || !day.due}
            aria-pressed={day.checked}
            onClick={() => onToggleDay(row.id, day.dayStart)}
            aria-label={`${row.title} ${day.label}${day.checked ? " checked in" : " not checked in"}`}
            className={cn(
              "grid size-6 place-items-center rounded-full text-white transition-colors",
              day.checked && "bg-success",
              !day.checked && day.due && !day.isFuture && "border border-line-strong bg-surface",
              !day.checked && (day.isFuture || !day.due) && "border border-dashed border-line bg-surface text-ink-3",
              day.isToday && !day.checked && "ring-2 ring-accent/40",
              !day.isFuture && day.due && "hover:border-accent",
            )}
          >
            {day.checked ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>

      <DropdownMenu
        align="end"
        sections={[
          {
            label: row.title,
            items: [
              { label: "Open details", onSelect: () => onOpen?.(row.id) },
              { label: "Edit habit", onSelect: () => onEdit?.(row.id) },
              archived
                ? { label: "Restore habit", onSelect: () => onRestore?.(row.id) }
                : { label: "Archive habit", onSelect: () => onArchive?.(row.id) },
              { label: "Delete habit", danger: true, onSelect: () => onDelete?.(row.id) },
            ],
          },
        ]}
        trigger={
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={`${row.title} options`}
          >
            <span aria-hidden="true">&#8942;</span>
          </button>
        }
      />
    </li>
  );
}