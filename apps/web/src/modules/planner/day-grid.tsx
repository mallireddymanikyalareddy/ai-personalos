"use client";

import * as React from "react";

import type {
  CalendarDay,
  CalendarEvent,
  PlanningPreferences,
  Timestamp,
} from "@personalos/core";

import { EventChip } from "@/modules/calendar/event-chip";

import { HOUR_MS, HOUR_PX, dayWindow, hourLabel, layoutItems, parseHHMM, windowRows } from "./planner-utils";
import { PlannerCell } from "./planner-cell";
import { PlannerItemChip } from "./plan-item";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
});

export interface DayGridProps {
  day: CalendarDay;
  prefs: PlanningPreferences;
  now: Timestamp;
  hour12: boolean;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenBlock: (blockId: string) => void;
  onRequestPlace: (startsAt: Timestamp) => void;
  onResizeBlock?: (blockId: string, startsAt: Timestamp, endsAt: Timestamp) => void;
}

export function DayGrid({
  day,
  prefs,
  now,
  hour12,
  onOpenEvent,
  onOpenBlock,
  onRequestPlace,
  onResizeBlock,
}: DayGridProps) {
  const startMin = parseHHMM(prefs.dayStart) ?? 9 * 60;
  const rawEnd = parseHHMM(prefs.dayEnd) ?? 17 * 60;
  const endMin = rawEnd > startMin ? rawEnd : startMin + 9 * 60;

  const { from, to } = dayWindow(day.date, startMin, endMin);
  const rows = windowRows(startMin, endMin);
  const allDayEvents = day.events.filter((event) => event.allDay);

  const placed = layoutItems(
    [...day.timeBlocks, ...day.events.filter((event) => !event.allDay)],
    from,
    to,
  );

  const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(day.date),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <span className="text-xs font-medium text-ink">
          {day.isToday ? "Today · " : ""}
          {dateFormatter.format(new Date(day.date))}
        </span>
        <span className="text-[10px] tabular-nums text-ink-3">
          {hourLabel(Math.floor(startMin / 60))}–{hourLabel(Math.ceil(endMin / 60))}
        </span>
      </div>

      {allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-line bg-surface px-3 py-1.5">
          {allDayEvents.map((event) => (
            <EventChip key={event.id} event={event} compact onClick={onOpenEvent} />
          ))}
        </div>
      )}

      <div className="relative">
        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-px bg-line">
          {rows.map((hour) => (
            <React.Fragment key={hour}>
              <div
                className="bg-surface px-2 text-right text-[10px] tabular-nums leading-5 text-ink-3"
                style={{ height: HOUR_PX }}
              >
                {hourLabel(hour)}
              </div>
              <PlannerCell
                startsAt={day.date + hour * HOUR_MS}
                label={`${shortDate} ${hourLabel(hour)}`}
                onRequestPlace={onRequestPlace}
              />
            </React.Fragment>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 grid grid-cols-[48px_minmax(0,1fr)]">
          <div />
          <div className="relative">
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
        </div>
      </div>
    </div>
  );
}