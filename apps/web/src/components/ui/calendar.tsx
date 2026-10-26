"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Timestamp } from "@personalos/core";

import { cn } from "@/lib/cn";

const toDayStart = (ts: Timestamp) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export interface MonthCalendarProps {
  value?: Timestamp | null;
  onValueChange?: (ts: Timestamp) => void;
  displayedMonth?: Timestamp | null;
  onDisplayedMonthChange?: (ts: Timestamp) => void;
  weekStartsOn?: 0 | 1;
  min?: Timestamp | null;
  max?: Timestamp | null;
  showOutsideDays?: boolean;
  className?: string;
  headerClassName?: string;
}

export function MonthCalendar({
  value,
  onValueChange,
  displayedMonth,
  onDisplayedMonthChange,
  weekStartsOn = 1,
  min,
  max,
  showOutsideDays = false,
  className,
  headerClassName,
}: MonthCalendarProps) {
  const [mounted, setMounted] = React.useState(false);
  const [anchor, setAnchor] = React.useState<Timestamp | null>(null);
  const [today, setToday] = React.useState<Timestamp | null>(null);
  const controlled = displayedMonth != null && onDisplayedMonthChange != null;

  React.useEffect(() => {
    setMounted(true);
    setToday(toDayStart(Date.now()).getTime());
    setAnchor(toDayStart(Date.now()).getTime());
  }, []);

  const baseTs = displayedMonth ?? value ?? anchor;
  const base = baseTs == null ? null : toDayStart(baseTs);

  const monthLabel = React.useMemo(() => {
    if (!base || !mounted) return null;
    if (typeof Intl === "undefined") return null;
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(base);
  }, [base, mounted]);

  const weeks = React.useMemo(() => {
    if (!base) return [];
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const lead = (first.getDay() - weekStartsOn + 7) % 7;
    const start = addDays(first, -lead);
    const result: Date[][] = [];
    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const week: Date[] = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        week.push(addDays(start, weekIndex * 7 + dayIndex));
      }
      result.push(week);
    }
    return result;
  }, [base, weekStartsOn]);

  if (!mounted || !base) {
    return (
      <div
        aria-hidden="true"
        className={cn("w-full rounded-xl border border-line bg-surface p-3", className)}
      >
        <div className="h-8 w-full" />
      </div>
    );
  }

  const minDay = min != null ? toDayStart(min) : null;
  const maxDay = max != null ? toDayStart(max) : null;
  const current = value != null ? toDayStart(value) : null;

  const goToMonth = (offset: number) => {
    const next = addMonths(base, offset);
    if (controlled) onDisplayedMonthChange!(next.getTime());
    setAnchor(next.getTime());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const from = current ?? toDayStart(base.getTime());
    let next: Date;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(from, -1);
        break;
      case "ArrowRight":
        next = addDays(from, 1);
        break;
      case "ArrowUp":
        next = addDays(from, -7);
        break;
      case "ArrowDown":
        next = addDays(from, 7);
        break;
      case "Home":
        next = new Date(from.getFullYear(), from.getMonth(), 1);
        break;
      default:
        next = new Date(from.getFullYear(), from.getMonth() + 1, 0);
        break;
    }
    if (next.getMonth() !== from.getMonth() || next.getFullYear() !== from.getFullYear()) {
      const fromIndex = from.getFullYear() * 12 + from.getMonth();
      const nextIndex = next.getFullYear() * 12 + next.getMonth();
      goToMonth(nextIndex - fromIndex);
    }
    onValueChange?.(next.getTime());
  };

  const weekdayLabels = [
    ...WEEKDAY_LABELS.slice(weekStartsOn),
    ...WEEKDAY_LABELS.slice(0, weekStartsOn),
  ];

  return (
    <div
      role="grid"
      aria-label={monthLabel ?? undefined}
      className={cn("w-full select-none rounded-xl border border-line bg-surface p-3", className)}
      onKeyDown={handleKeyDown}
    >
      <div className={cn("mb-2 flex items-center justify-between", headerClassName)}>
        <div className="text-sm font-semibold tracking-tight text-ink">{monthLabel}</div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div role="row" className="mb-1 grid grid-cols-7 gap-0.5">
        {weekdayLabels.map((label, index) => (
          <div
            key={index}
            className="grid h-6 place-items-center text-[11px] font-semibold text-ink-3"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.map((week, weekIndex) => (
          <React.Fragment key={weekIndex}>
            {week.map((day) => {
              const inMonth = day.getMonth() === base.getMonth();
              const dayTs = day.getTime();
              const disabled =
                (minDay != null && dayTs < minDay.getTime()) ||
                (maxDay != null && dayTs > maxDay.getTime()) ||
                (!inMonth && !showOutsideDays);
              const isToday = today != null && sameDay(day, toDayStart(today));
              const selected = current != null && sameDay(day, current);
              return (
                <button
                  key={dayTs}
                  type="button"
                  role="gridcell"
                  onClick={() => {
                    if (!disabled) onValueChange?.(dayTs);
                  }}
                  aria-label={`${new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(day)}`}
                  aria-selected={selected}
                  aria-current={isToday ? "date" : undefined}
                  aria-disabled={disabled || undefined}
                  tabIndex={selected ? 0 : -1}
                  className={cn(
                    "relative grid size-8 place-items-center rounded-full text-sm tabular-nums transition-colors duration-100",
                    !inMonth && "text-ink-3/50",
                    disabled && "pointer-events-none opacity-40",
                    selected
                      ? "bg-accent font-semibold text-white"
                      : "hover:bg-surface-2",
                    isToday && !selected && "font-semibold text-accent-ink",
                    isToday && !selected && "ring-1 ring-inset ring-accent/60",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}