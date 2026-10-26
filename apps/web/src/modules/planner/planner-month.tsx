"use client";

import * as React from "react";

import type { CalendarDay, CalendarMonth, Timestamp } from "@personalos/core";

import { cn } from "@/lib/cn";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({
  month,
  anchor,
  onSelectDay,
}: {
  month: CalendarMonth;
  anchor: Timestamp;
  onSelectDay: (day: Timestamp) => void;
}) {
  const anchorDate = new Date(anchor);
  const anchorMonth = anchorDate.getMonth();

  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-surface"
      data-testid="planner-month"
    >
      <div className="grid grid-cols-7 gap-px border-b border-line bg-line">
        {WEEKDAYS.map((label) => (
          <span
            key={label}
            className="bg-surface-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-line">
        {month.weeks.flatMap((week) =>
          week.days.map((day) => (
            <MonthCell
              key={day.date}
              day={day}
              inMonth={new Date(day.date).getMonth() === anchorMonth}
              onSelectDay={onSelectDay}
            />
          )),
        )}
      </div>
    </div>
  );
}

function MonthCell({
  day,
  inMonth,
  onSelectDay,
}: {
  day: CalendarDay;
  inMonth: boolean;
  onSelectDay: (day: Timestamp) => void;
}) {
  const items = [...day.events, ...day.timeBlocks];
  return (
    <button
      type="button"
      onClick={() => onSelectDay(day.date)}
      data-testid="planner-month-day"
      className={cn(
        "flex min-h-24 flex-col gap-1 bg-surface p-1.5 text-left transition-colors hover:bg-surface-2/60",
        !inMonth && "bg-surface-2/40",
      )}
    >
      <span
        className={cn(
          "grid size-5 place-items-center rounded-full text-[11px] tabular-nums",
          day.isToday ? "bg-accent font-semibold text-white" : "text-ink-3",
        )}
      >
        {new Date(day.date).getDate()}
      </span>
      <span className="space-y-0.5">
        {items.slice(0, 2).map((item) => (
          <span
            key={item.id}
            className={cn(
              "block truncate rounded px-1 py-0.5 text-[10px]",
              item.type === "event" ? "bg-info-soft text-info" : "bg-accent-soft text-accent-ink",
            )}
          >
            {item.title}
          </span>
        ))}
        {items.length > 2 ? (
          <span className="block px-1 text-[10px] text-ink-3">+{items.length - 2} more</span>
        ) : null}
      </span>
    </button>
  );
}