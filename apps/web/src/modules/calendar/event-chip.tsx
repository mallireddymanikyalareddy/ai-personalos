"use client";

import * as React from "react";

import type { CalendarEvent } from "@personalos/core";

import { cn } from "@/lib/cn";

export const EVENT_COLORS = [
  "accent",
  "teal",
  "amber",
  "rose",
  "blue",
  "green",
  "violet",
  "slate",
] as const;

export type EventColorKey = (typeof EVENT_COLORS)[number];

export interface EventTone {
  dot: string;
  chip: string;
  bar: string;
}

const TONES: Record<EventColorKey, EventTone> = {
  accent: {
    dot: "bg-accent",
    chip: "bg-accent-soft text-accent-ink",
    bar: "border-accent/50 bg-accent text-white",
  },
  teal: {
    dot: "bg-chart-2",
    chip: "bg-chart-2/15 text-chart-2",
    bar: "border-chart-2/50 bg-chart-2 text-white",
  },
  amber: {
    dot: "bg-chart-3",
    chip: "bg-chart-3/15 text-chart-3",
    bar: "border-chart-3/50 bg-chart-3 text-white",
  },
  rose: {
    dot: "bg-chart-4",
    chip: "bg-chart-4/15 text-chart-4",
    bar: "border-chart-4/50 bg-chart-4 text-white",
  },
  blue: {
    dot: "bg-chart-5",
    chip: "bg-chart-5/15 text-chart-5",
    bar: "border-chart-5/50 bg-chart-5 text-white",
  },
  green: {
    dot: "bg-chart-6",
    chip: "bg-chart-6/15 text-chart-6",
    bar: "border-chart-6/50 bg-chart-6 text-white",
  },
  violet: {
    dot: "bg-chart-7",
    chip: "bg-chart-7/15 text-chart-7",
    bar: "border-chart-7/50 bg-chart-7 text-white",
  },
  slate: {
    dot: "bg-chart-8",
    chip: "bg-chart-8/15 text-chart-8",
    bar: "border-chart-8/50 bg-chart-8 text-white",
  },
};

const CSS_COLOR_TONES: Record<string, EventColorKey> = {
  "var(--accent)": "accent",
  "var(--chart-1)": "accent",
  "var(--chart-2)": "teal",
  "var(--chart-3)": "amber",
  "var(--chart-4)": "rose",
  "var(--chart-5)": "blue",
  "var(--chart-6)": "green",
  "var(--chart-7)": "violet",
  "var(--chart-8)": "slate",
};

export const CALENDAR_COLOR_CHOICES = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-6)",
  "var(--chart-3)",
  "var(--chart-7)",
  "var(--chart-2)",
] as const;

export function isEventColorKey(value: string | null | undefined): value is EventColorKey {
  return value != null && (EVENT_COLORS as readonly string[]).includes(value);
}

export function toneKeyFor(color: string | null | undefined): EventColorKey {
  if (color == null) return "accent";
  if (isEventColorKey(color)) return color;
  return CSS_COLOR_TONES[color] ?? "accent";
}

export function eventTone(color: string | null): EventTone {
  return TONES[toneKeyFor(color)];
}

/** Event colour wins; otherwise inherit the calendar's colour. */
export function resolveEventColor(
  event: Pick<CalendarEvent, "color" | "calendarId">,
  calendarColors?: Record<string, string | null>,
): string | null {
  if (event.color) return event.color;
  if (event.calendarId) return calendarColors?.[event.calendarId] ?? null;
  return null;
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatter.format(new Date(event.startsAt))} – ${formatter.format(new Date(event.endsAt))}`;
}

export interface EventChipProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
  selectable?: boolean;
  selected?: boolean;
  conflict?: boolean;
}

export function EventChip({
  event,
  compact = false,
  onClick,
  selectable = false,
  selected = false,
  conflict = false,
}: EventChipProps) {
  const tone = eventTone(event.color);
  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      aria-label={
        selectable
          ? `${selected ? "Deselect" : "Select"} ${event.title}`
          : `Open ${event.title}`
      }
      aria-pressed={selectable ? selected : undefined}
      className={cn(
        "flex h-5 w-full min-w-0 items-center gap-1 rounded px-1.5 text-left text-[11px] font-medium",
        tone.chip,
        onClick && "transition-colors hover:brightness-105",
        selected && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
        conflict && !selected && "ring-1 ring-danger/60",
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      <span className="min-w-0 truncate">{event.title}</span>
      {!compact && (
        <span className="ml-auto shrink-0 tabular-nums opacity-70">
          {formatEventTime(event)}
        </span>
      )}
    </button>
  );
}
