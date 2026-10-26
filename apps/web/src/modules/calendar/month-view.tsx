"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import type { CalendarEvent, CalendarMonth, Timestamp } from "@personalos/core";

import { cn } from "@/lib/cn";

import { EventChip } from "./event-chip";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CELL_EVENTS = 2;

export interface MonthViewProps {
  month: CalendarMonth;
  onOpenEvent: (event: CalendarEvent) => void;
  onAddDay: (day: Timestamp) => void;
  onShowDay: (day: Timestamp) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (event: CalendarEvent) => void;
  conflictIds?: Set<string>;
  showWeekends?: boolean;
}

export function MonthView({
  month,
  onOpenEvent,
  onAddDay,
  onShowDay,
  selectable = false,
  selected,
  onToggleSelect,
  conflictIds,
  showWeekends = true,
}: MonthViewProps) {
  const monthStart = month.start;
  const labels = showWeekends ? WEEKDAY_LABELS : WEEKDAY_LABELS.slice(0, 5);
  const columns = showWeekends ? 7 : 5;
  const visibleDays = (days: CalendarMonth["weeks"][number]["days"]) =>
    showWeekends
      ? days
      : days.filter((day) => {
          const dow = new Date(day.date).getDay();
          return dow !== 0 && dow !== 6;
        });

  const activate = (event: CalendarEvent) => {
    if (selectable) onToggleSelect?.(event);
    else onOpenEvent(event);
  };

  return (
    <div>
      <div
        className="grid gap-px rounded-xl border border-line bg-line"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {labels.map((label) => (
          <div
            key={label}
            className="bg-surface px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-3"
          >
            {label}
          </div>
        ))}

        {month.weeks.map((week) => (
          <React.Fragment key={week.start}>
            {visibleDays(week.days).map((day) => {
              const inMonth = day.date >= monthStart && day.date < month.end;
              const visible = day.events.filter((event) => !event.allDay || true);
              const shown = visible.slice(0, MAX_CELL_EVENTS);
              const hiddenCount = visible.length - shown.length;
              const today = day.isToday;

              return (
                <div
                  key={day.date}
                  className={cn(
                    "group relative min-h-[92px] bg-surface p-1.5 transition-colors hover:bg-surface-2",
                    !inMonth && "bg-bg-subtle text-ink-3",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onShowDay(day.date)}
                      aria-label={
                        today
                          ? `Open ${new Date(day.date).toDateString()}, today`
                          : `Open ${new Date(day.date).toDateString()}`
                      }
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums",
                        today
                          ? "bg-accent text-white"
                          : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                      )}
                    >
                      {new Date(day.date).getDate()}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddDay(day.date)}
                      aria-label={`Add event on ${new Date(day.date).toDateString()}`}
                      className="grid size-5 place-items-center rounded text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 hover:text-ink"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {shown.map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        compact
                        onClick={activate}
                        selectable={selectable}
                        selected={selected?.has(event.id)}
                        conflict={conflictIds?.has(event.id)}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onShowDay(day.date)}
                        className="px-1.5 text-[11px] font-medium text-ink-3 hover:text-accent-ink"
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                  </div>

                  {visible.length === 0 && inMonth && (
                    <div className="absolute inset-0 hidden cursor-pointer group-hover:block" />
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}