import * as React from "react";

import { Flame } from "lucide-react";

import type { Habit, HabitCheckIn } from "@personalos/core";

import { cn } from "@/lib/cn";
import { startOfDay, addDays } from "@/lib/datetime";
import { Chip } from "@/components/ui/chip";

const CADENCE_LABELS: Record<Habit["cadence"], string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

const WEEKDAY_LETTERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export interface HabitCardProps {
  habit: Habit;
  checkins: HabitCheckIn[];
  onToggle: (dayStartTs: number) => void;
  onOpen?: () => void;
  className?: string;
}

function streak(checkins: HabitCheckIn[], nowTs: number): number {
  const days = new Set(checkins.map((checkin) => startOfDay(checkin.checkedAt)));
  let cursor = startOfDay(nowTs);
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function HabitCard({ habit, checkins, onToggle, onOpen, className }: HabitCardProps) {
  const checkedDays = React.useMemo(
    () => new Set(checkins.map((checkin) => startOfDay(checkin.checkedAt))),
    [checkins],
  );
  const nowTs = React.useMemo(() => startOfDay(Date.now()), []);
  const currentStreak = React.useMemo(() => streak(checkins, Date.now()), [checkins]);

  const accent =
    typeof habit.color === "string" && habit.color.startsWith("#") ? habit.color : "var(--accent)";

  const markers = React.useMemo(() => {
    const list: { ts: number; day: number; letter: string }[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const ts = addDays(nowTs, -offset);
      list.push({
        ts,
        day: offset,
        letter: WEEKDAY_LETTERS[(new Date(ts).getDay() + 6) % 7],
      });
    }
    return list;
  }, [nowTs]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
        aria-label={`Open ${habit.title}`}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{habit.title}</span>
          <Chip className="shrink-0">{CADENCE_LABELS[habit.cadence]}</Chip>
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-3">
          <Flame
            className={cn("size-3.5", currentStreak > 0 ? "text-warning" : "text-ink-3/60")}
            aria-hidden="true"
          />
          <span className="font-medium tabular-nums">
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
        <div
          role="group"
          aria-label={`${habit.title} check-ins, last 7 days`}
          className="flex items-center gap-1"
        >
          {markers.map((marker) => {
            const checked = checkedDays.has(marker.ts);
            const today = marker.day === 0;
            const future = marker.day < 0;
            return (
              <button
                key={marker.ts}
                type="button"
                aria-label={`${new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(marker.ts)} ${checked ? "checked in" : "not checked in"}`}
                aria-pressed={checked}
                onClick={() => onToggle(marker.ts)}
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-100",
                  checked
                    ? "bg-accent text-white"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                  today && !checked && "ring-1 ring-inset ring-line-strong",
                  future && "pointer-events-none opacity-40",
                )}
              >
                {marker.letter}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}