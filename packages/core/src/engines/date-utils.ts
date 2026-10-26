import type { Timestamp } from "../types/common";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export function startOfDay(time: Timestamp): Timestamp {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfDay(time: Timestamp): Timestamp {
  const date = new Date(time);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function addDays(time: Timestamp, days: number): Timestamp {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function isSameDay(a: Timestamp, b: Timestamp): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function isToday(time: Timestamp, now: Timestamp): boolean {
  return isSameDay(time, now);
}

export function startOfWeek(time: Timestamp, weekStart: 0 | 1 = 1): Timestamp {
  const date = new Date(startOfDay(time));
  const delta = (date.getDay() - weekStart + 7) % 7;
  date.setDate(date.getDate() - delta);
  return date.getTime();
}

export function dayDiff(from: Timestamp, to: Timestamp): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

export function nextWeekday(now: Timestamp, weekday: number): Timestamp {
  const today = startOfDay(now);
  const delta = (weekday - new Date(today).getDay() + 7) % 7;
  return addDays(today, delta);
}

export type DueTone = "overdue" | "today" | "tomorrow" | "future" | "past";

export function dueTone(dueAt: Timestamp, now: Timestamp): DueTone {
  const diff = dayDiff(now, dueAt);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return dueAt > now ? "future" : "past";
}

export function formatDayLabel(time: Timestamp, now: Timestamp, locale?: string): string {
  const diff = dayDiff(now, time);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(time));
  }
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(time),
  );
}

export function formatTime(time: Timestamp, hour12: boolean, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).format(new Date(time));
}

export function formatFullDate(time: Timestamp, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(time));
}
