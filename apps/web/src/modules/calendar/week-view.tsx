"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import type {
  CalendarDay,
  CalendarEvent,
  CalendarWeek,
  ID,
  Timestamp,
} from "@personalos/core";

import { cn } from "@/lib/cn";

import { EventChip, formatEventTime, eventTone } from "./event-chip";

const HOUR_PX = 46;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

interface PlacedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function layoutDay(day: CalendarDay): PlacedEvent[] {
  const dayStart = day.date;
  const dayEnd = dayStart + DAY_MS;

  const timed = day.events
    .filter((event) => !event.allDay && event.endsAt > event.startsAt)
    .map((event) => ({
      event,
      start: clamp(event.startsAt, dayStart, dayEnd),
      end: clamp(event.endsAt, dayStart, dayEnd),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed: PlacedEvent[] = [];
  let index = 0;

  while (index < timed.length) {
    const cluster: typeof timed = [timed[index]!];
    let maxEnd = timed[index]!.end;
    let cursor = index + 1;
    while (cursor < timed.length && timed[cursor]!.start < maxEnd) {
      cluster.push(timed[cursor]!);
      maxEnd = Math.max(maxEnd, timed[cursor]!.end);
      cursor += 1;
    }

    const columnEnds: number[] = [];
    const rows = cluster.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[column] = item.end;
      }
      return { item, column };
    });

    const totalColumns = columnEnds.length;
    for (const { item, column } of rows) {
      const top = ((item.start - dayStart) / HOUR_MS) * HOUR_PX;
      const rawHeight = ((item.end - item.start) / HOUR_MS) * HOUR_PX - 3;
      placed.push({
        event: item.event,
        top,
        height: Math.max(rawHeight, 18),
        left: (column * 100) / totalColumns,
        width: 100 / totalColumns,
      });
    }

    index = cursor;
  }

  return placed;
}

function isWeekend(day: Timestamp): boolean {
  const dow = new Date(day).getDay();
  return dow === 0 || dow === 6;
}

export interface WeekViewProps {
  week: CalendarWeek;
  onOpenEvent: (event: CalendarEvent) => void;
  onAddSlot: (day: Timestamp, hour: number) => void;
  onMoveEvent?: (eventId: ID, day: Timestamp, hour: number) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (event: CalendarEvent) => void;
  conflictIds?: Set<string>;
  showWeekends?: boolean;
}

export function WeekView({
  week,
  onOpenEvent,
  onAddSlot,
  onMoveEvent,
  selectable = false,
  selected,
  onToggleSelect,
  conflictIds,
  showWeekends = true,
}: WeekViewProps) {
  const days = showWeekends ? week.days : week.days.filter((day) => !isWeekend(day.date));
  const todayIndex = days.findIndex((day) => day.isToday);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const columns = `48px repeat(${days.length}, minmax(0, 1fr))`;

  const activate = (event: CalendarEvent) => {
    if (selectable) onToggleSelect?.(event);
    else onOpenEvent(event);
  };

  const drop = (day: Timestamp, hour: number, eventId: string | null) => {
    setDragOver(null);
    if (!eventId || !onMoveEvent) return;
    onMoveEvent(eventId, day, hour);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid gap-px bg-line" style={{ gridTemplateColumns: columns }}>
        <div className="bg-surface" />
        {days.map((day, index) => {
          const today = index === todayIndex;
          return (
            <div
              key={day.date}
              className={cn(
                "flex items-center justify-center gap-1 border-b bg-surface py-2",
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
            </div>
          );
        })}
      </div>

      <div className="grid gap-px border-b border-line bg-line" style={{ gridTemplateColumns: columns }}>
        <div className="bg-surface px-2 py-1 text-[10px] font-medium text-ink-3">All day</div>
        {days.map((day) => (
          <div
            key={day.date}
            className="min-h-8 bg-surface px-1 py-1"
            aria-label={`All-day events for ${new Date(day.date).toDateString()}`}
            onDragOver={(event) => {
              if (!onMoveEvent) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop(day.date, 0, event.dataTransfer.getData("text/lifeos-event"));
            }}
          >
            {day.events
              .filter((event) => event.allDay)
              .map((event) => (
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
            {day.events.filter((event) => event.allDay).length === 0 && (
              <span className="block h-5 px-1.5 text-[11px] leading-5 text-ink-3/60">–</span>
            )}
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="grid gap-px bg-line" style={{ gridTemplateColumns: columns }}>
          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              <div
                className="bg-surface px-2 text-right text-[10px] tabular-nums leading-5 text-ink-3"
                style={{ height: HOUR_PX }}
              >
                {hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`}
              </div>
              {days.map((day) => {
                const cellKey = `${day.date}-${hour}`;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => onAddSlot(day.date, hour)}
                    onDragOver={(event) => {
                      if (!onMoveEvent) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOver(cellKey);
                    }}
                    onDragLeave={() => setDragOver((current) => (current === cellKey ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault();
                      drop(day.date, hour, event.dataTransfer.getData("text/lifeos-event"));
                    }}
                    aria-label={`Add event on ${new Date(day.date).toDateString()} at ${hour}:00`}
                    className={cn(
                      "group relative bg-surface hover:bg-surface-2",
                      dragOver === cellKey && "bg-accent-soft ring-1 ring-inset ring-accent/60",
                    )}
                    style={{ height: HOUR_PX }}
                  >
                    <span className="absolute inset-x-0 top-0 h-px bg-line" aria-hidden="true" />
                    <span className="absolute inset-0 hidden items-center justify-center group-hover:flex">
                      <Plus className="size-3 text-ink-3" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-0 grid grid-rows-[minmax(0,1fr)]"
          style={{ gridTemplateColumns: columns }}
        >
          <div />
          {days.map((day) => (
            <div key={day.date} className="relative">
              {layoutDay(day).map((placed) => {
                const tone = eventTone(placed.event.color);
                const isSelected = selected?.has(placed.event.id) ?? false;
                const hasConflict = conflictIds?.has(placed.event.id) ?? false;
                return (
                  <button
                    key={placed.event.id}
                    type="button"
                    draggable={Boolean(onMoveEvent)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/lifeos-event", placed.event.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => activate(placed.event)}
                    aria-label={
                      selectable
                        ? `${isSelected ? "Deselect" : "Select"} ${placed.event.title}`
                        : `Open ${placed.event.title}`
                    }
                    aria-pressed={selectable ? isSelected : undefined}
                    className={cn(
                      "pointer-events-auto absolute cursor-grab overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 shadow-card active:cursor-grabbing",
                      tone.bar,
                      isSelected && "ring-2 ring-accent ring-offset-1",
                      hasConflict && !isSelected && "ring-1 ring-danger",
                    )}
                    style={{
                      top: placed.top,
                      height: placed.height,
                      left: `calc(${placed.left}% + 1px)`,
                      width: `calc(${placed.width}% - 2px)`,
                    }}
                  >
                    <span className="block truncate">{placed.event.title}</span>
                    <span className="block truncate text-[10px] font-normal opacity-80">
                      {formatEventTime(placed.event)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
