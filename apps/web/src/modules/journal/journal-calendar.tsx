"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

import { journalDateKey, moodDotLabel } from "@personalos/core";
import type { MoodCalendarDay } from "@personalos/core";
import type { PersonalOS } from "@personalos/core";
import type { Timestamp } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface JournalCalendarProps {
  os: PersonalOS;
  selectedDate: Timestamp;
  onSelect: (date: Timestamp) => void;
  weekStart?: 0 | 1;
}

const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toneFor(day: MoodCalendarDay): string {
  if (!day.hasEntry) return "bg-surface-2";
  return cn(
    day.mood === "happy" || day.mood === "excited"
      ? "bg-success"
      : day.mood === "calm"
        ? "bg-success/70"
        : day.mood === "neutral"
          ? "bg-warning/70"
          : day.mood === "tired" || day.mood === "stressed"
            ? "bg-warning"
            : day.mood
              ? "bg-danger"
              : "bg-accent/50",
  );
}

export function JournalCalendar({
  os,
  selectedDate,
  onSelect,
  weekStart = 1,
}: JournalCalendarProps) {
  const [cursor, setCursor] = React.useState(() => {
    const date = new Date(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const days = os.journalMoodCalendar(cursor.getMonth(), cursor.getFullYear());
  const todayKey = journalDateKey(Date.now());
  const selectedKey = dateKeyOf(selectedDate);
  const weekdayLabels = weekStart === 0 ? WEEKDAYS_SUN : WEEKDAYS_MON;

  const leading = firstWeekdayOffset(cursor, weekStart);

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    const previousDay = new Date(selectedDate).getDate();
    onSelect(
      new Date(next.getFullYear(), next.getMonth(), Math.min(previousDay, daysInMonth(next))).getTime(),
    );
  };

  const goToSelected = () => {
    const date = new Date(selectedDate);
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
    onSelect(date.getTime());
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={goToSelected}>
            Today
          </Button>
          <Button size="sm" variant="ghost" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-ink-3">
        {weekdayLabels.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {days.map((day) => {
          const isSelected = day.dateKey === selectedKey;
          const isToday = day.dateKey === todayKey;
          const dayNumber = Number(day.dateKey.slice(8, 10));
          return (
            <button
              key={day.dateKey}
              type="button"
              aria-label={`${day.dateKey} — ${moodDotLabel(day)}${day.entryCount > 1 ? `, ${day.entryCount} entries` : ""}`}
              aria-current={isSelected ? "date" : undefined}
              onClick={() => onSelect(new Date(cursor.getFullYear(), cursor.getMonth(), dayNumber).getTime())}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs",
                isSelected ? "border-accent bg-accent/10" : "border-transparent hover:bg-surface-2",
                isToday && !isSelected && "border-line",
              )}
            >
              <span className="tabular-nums">{dayNumber}</span>
              <span className="mt-0.5 flex items-center gap-0.5">
                {day.mood ? (
                  <span className={cn("size-1.5 rounded-full", toneFor(day))} aria-hidden />
                ) : null}
                {day.entryCount > 0 ? <span className="sr-only">Journal completed</span> : null}
                {day.hasPhotos ? <ImageIcon className="size-2.5 text-ink-3" aria-hidden /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
        <Legend tone="bg-success" label="Positive" />
        <Legend tone="bg-warning" label="Low or stressed" />
        <Legend tone="bg-danger" label="Very low" />
        <Legend tone="bg-accent/50" label="No mood recorded" />
        <Legend tone="bg-surface-2" label="No entry" />
      </dl>
    </section>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("size-2 rounded-full", tone)} aria-hidden />
      <dt>{label}</dt>
    </div>
  );
}

function dateKeyOf(at: Timestamp): string {
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function firstWeekdayOffset(cursor: Date, weekStart: 0 | 1): number {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  return (first.getDay() - weekStart + 7) % 7;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
