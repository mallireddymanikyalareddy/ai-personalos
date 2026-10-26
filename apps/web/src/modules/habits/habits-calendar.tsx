"use client";

import * as React from "react";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type { HabitCalendarDay } from "@personalos/core";

import { cn } from "@/lib/cn";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HabitCalendar({
  days,
  label,
  onShiftMonth,
  selectedDay,
  onSelectDay,
}: {
  days: HabitCalendarDay[];
  label: string;
  onShiftMonth: (delta: number) => void;
  selectedDay: number | null;
  onSelectDay: (dayStart: number) => void;
}) {
  const weeks: HabitCalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <section
      aria-label="Calendar View"
      data-testid="habits-calendar"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarDays className="size-4 text-accent-ink" aria-hidden="true" />
          Calendar View
        </h2>
        <a href="/calendar" className="text-xs font-medium text-accent-ink hover:underline">
          View Calendar
        </a>
      </header>

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onShiftMonth(-1)}
          className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <p className="text-[13px] font-semibold text-ink" data-testid="habits-calendar-label">
          {label}
        </p>
        <button
          type="button"
          onClick={() => onShiftMonth(1)}
          className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div role="grid" aria-label={label} className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            role="columnheader"
            className="pb-1 text-center text-[10px] font-medium text-ink-3"
          >
            {weekday}
          </span>
        ))}

        {weeks.map((week) =>
          week.map((day) => {
            const rate = day.rate;
            const selected = selectedDay === day.dayStart;
            return (
              <button
                key={day.dayStart}
                type="button"
                role="gridcell"
                onClick={() => onSelectDay(day.dayStart)}
                aria-label={`${day.date} ${day.inMonth ? "" : "outside month "}${day.done} of ${day.due} habits done`}
                aria-selected={selected}
                className={cn(
                  "mx-auto grid size-8 place-items-center rounded-lg text-[11px] tabular-nums transition-colors",
                  !day.inMonth && "text-ink-3/50",
                  day.isToday && "bg-accent text-white",
                  !day.isToday && day.inMonth && "text-ink hover:bg-surface-2",
                  selected && !day.isToday && "ring-2 ring-accent/50",
                )}
              >
                {day.date}
                <span className="flex h-1 items-center gap-0.5" aria-hidden="true">
                  {day.due > 0 ? (
                    <span
                      className={cn(
                        "size-1 rounded-full",
                        day.isToday
                          ? "bg-white"
                          : rate >= 80
                            ? "bg-success"
                            : rate >= 40
                              ? "bg-chart-3"
                              : "bg-danger",
                      )}
                    />
                  ) : (
                    <span className="size-1" />
                  )}
                </span>
              </button>
            );
          }),
        )}
      </div>

      <p className="mt-2 text-[10px] text-ink-3" data-testid="habits-calendar-summary">
        {selectedDay != null
          ? `${days.find((day) => day.dayStart === selectedDay)?.done ?? 0} habits done on the selected day.`
          : "Select a day to see how many habits you completed."}
      </p>
    </section>
  );
}