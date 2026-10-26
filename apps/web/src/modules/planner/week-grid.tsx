"use client";

import * as React from "react";

import type {
  CalendarEvent,
  CalendarWeek,
  PlanningPreferences,
  Timestamp,
} from "@personalos/core";

import { cn } from "@/lib/cn";

import { EventChip } from "@/modules/calendar/event-chip";

import {
  HOUR_MS,
  HOUR_PX,
  dayWindow,
  hourLabel,
  layoutItems,
  parseHHMM,
  windowRows,
} from "./planner-utils";
import { PlannerCell } from "./planner-cell";
import { PlannerItemChip } from "./plan-item";

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
});

export interface WeekGridProps {
  week: CalendarWeek;
  prefs: PlanningPreferences;
  now: Timestamp;
  hour12: boolean;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenBlock: (blockId: string) => void;
  onRequestPlace: (startsAt: Timestamp) => void;
  onSelectDay?: (date: Timestamp) => void;
  onResizeBlock?: (blockId: string, startsAt: Timestamp, endsAt: Timestamp) => void;
}

export function WeekGrid({
  week,
  prefs,
  now,
  hour12,
  onOpenEvent,
  onOpenBlock,
  onRequestPlace,
  onSelectDay,
  onResizeBlock,
}: WeekGridProps) {
  const startMin = parseHHMM(prefs.dayStart) ?? 9 * 60;
  const rawEnd = parseHHMM(prefs.dayEnd) ?? 17 * 60;
  const endMin = rawEnd > startMin ? rawEnd : startMin + 9 * 60;
  const rows = windowRows(startMin, endMin);
  const todayIndex = week.days.findIndex((day) => day.isToday);

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-px bg-line">
        <div className="bg-surface" />
        {week.days.map((day, index) => {
          const today = index === todayIndex;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDay?.(day.date)}
              aria-label={`Open ${weekdayFormatter.format(new Date(day.date))}`}
              className={cn(
                "flex items-center justify-center gap-1 border-b bg-surface py-2 transition-colors hover:bg-surface-2",
                today && "bg-accent-soft/60",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  today ? "text-accent-ink" : "text-ink-2",
                )}
              >
                {weekdayFormatter.format(new Date(day.date))}
              </span>
            </button>
          );
        })}
      </div>

      {week.days.some((day) => day.events.some((event) => event.allDay)) && (
        <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-px border-b border-line bg-line">
          <div className="bg-surface px-2 py-1 text-[10px] font-medium text-ink-3">All day</div>
          {week.days.map((day) => (
            <div key={day.date} className="min-h-8 bg-surface px-1 py-1">
              {day.events
                .filter((event) => event.allDay)
                .map((event) => (
                  <EventChip key={event.id} event={event} compact onClick={onOpenEvent} />
                ))}
              {!day.events.some((event) => event.allDay) && (
                <span className="block h-5 px-1.5 text-[11px] leading-5 text-ink-3/60">—</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-px bg-line">
          {rows.map((hour) => (
            <React.Fragment key={hour}>
              <div
                className="bg-surface px-2 text-right text-[10px] tabular-nums leading-5 text-ink-3"
                style={{ height: HOUR_PX }}
              >
                {hourLabel(hour)}
              </div>
              {week.days.map((day) => (
                <PlannerCell
                  key={day.date}
                  startsAt={day.date + hour * HOUR_MS}
                  label={`${weekdayFormatter.format(new Date(day.date))} ${hourLabel(hour)}`}
                  onRequestPlace={onRequestPlace}
                />
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 grid grid-cols-[48px_repeat(7,minmax(0,1fr))]">
          <div />
          {week.days.map((day) => {
            const { from, to } = dayWindow(day.date, startMin, endMin);
            const placed = layoutItems(
              [...day.timeBlocks, ...day.events.filter((event) => !event.allDay)],
              from,
              to,
            );
            return (
              <div key={day.date} className="relative">
                {placed.map((entry) => (
                  <PlannerItemChip
                    key={entry.id}
                    item={entry.item}
                    hour12={hour12}
                    style={{
                      top: entry.top,
                      height: entry.height,
                      left: `calc(${entry.left}% + 1px)`,
                      width: `calc(${entry.width}% - 2px)`,
                    }}
                    onOpenEvent={onOpenEvent}
                    onOpenBlock={onOpenBlock}
                    onResizeBlock={onResizeBlock}
                  />
                ))}
                {day.isToday && now > from && now < to && (
                  <div
                    className="absolute inset-x-0"
                    style={{ top: ((now - from) / HOUR_MS) * HOUR_PX }}
                    aria-hidden="true"
                  >
                    <div className="h-0.5 bg-danger" />
                    <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-danger" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}