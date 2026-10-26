import type { Timestamp } from "../../types/common";
import type { RecurrenceRule, Task } from "../../types/task";
import { DAY_MS, addDays, startOfDay } from "../date-utils";

const WEEKDAY_MASK = 0b0111110;

function clampDayOfMonth(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function nextDaily(from: Timestamp, interval: number): Timestamp {
  return from + interval * DAY_MS;
}

function nextWeekdays(from: Timestamp, interval: number): Timestamp {
  let cursor = from;
  let count = 0;
  while (count < interval) {
    cursor = addDays(cursor, 1);
    const dow = new Date(cursor).getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return cursor;
}

function nextWeekly(
  from: Timestamp,
  interval: number,
  daysOfWeek: number[],
): Timestamp {
  const sorted = [...new Set(daysOfWeek)].sort((a, b) => a - b);
  const effectiveDays = sorted.length > 0 ? sorted : [new Date(from).getDay()];
  const fromDow = new Date(from).getDay();

  let best: Timestamp | null = null;
  for (const targetDow of effectiveDays) {
    let delta = targetDow - fromDow;
    if (delta <= 0) delta += 7;
    const candidate = addDays(from, delta);
    if (best == null || candidate < best) best = candidate;
  }

  if (best != null && interval <= 1) return best;

  const weeksToAdd = Math.max(1, interval);
  const firstTarget = effectiveDays[0]!;
  let delta = firstTarget - fromDow;
  if (delta <= 0) delta += 7;
  return addDays(from, delta + (weeksToAdd - 1) * 7);
}

function nextMonthly(from: Timestamp, interval: number): Timestamp {
  const date = new Date(from);
  const day = date.getDate();
  const targetMonth = date.getMonth() + interval;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const clampedDay = clampDayOfMonth(year, month, day);
  const result = new Date(year, month, clampedDay);
  result.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return result.getTime();
}

function nextYearly(from: Timestamp, interval: number): Timestamp {
  const date = new Date(from);
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear() + interval;
  const clampedDay = month === 1 && day === 29 && !isLeapYear(year) ? 28 : day;
  const result = new Date(year, month, clampedDay);
  result.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return result.getTime();
}

export function nextOccurrence(
  rule: RecurrenceRule,
  from: Timestamp,
  anchor?: Timestamp,
): Timestamp | null {
  if (rule.interval < 1) return null;

  let candidate: Timestamp;
  switch (rule.freq) {
    case "daily":
      candidate = nextDaily(from, rule.interval);
      break;
    case "weekdays":
      candidate = nextWeekdays(from, rule.interval);
      break;
    case "weekly":
      candidate = nextWeekly(from, rule.interval, rule.daysOfWeek ?? []);
      break;
    case "monthly":
      candidate = nextMonthly(from, rule.interval);
      break;
    case "yearly":
      candidate = nextYearly(from, rule.interval);
      break;
    default:
      return null;
  }

  if (rule.endsAt != null && candidate >= rule.endsAt) return null;

  if (rule.count != null && anchor != null) {
    const ordinal = occurrenceOrdinal(rule, anchor, candidate);
    if (ordinal > rule.count) return null;
  }

  return candidate;
}

export function occurrenceOrdinal(
  rule: RecurrenceRule,
  anchor: Timestamp,
  occurrence: Timestamp,
): number {
  if (rule.freq === "daily") {
    return Math.round((startOfDay(occurrence) - startOfDay(anchor)) / DAY_MS / rule.interval) + 1;
  }
  if (rule.freq === "weekdays") {
    let count = 0;
    let cursor = anchor;
    while (cursor < occurrence) {
      cursor = nextWeekdays(cursor, 1);
      count += 1;
    }
    return count + 1;
  }
  if (rule.freq === "weekly") {
    const weeks = Math.round((startOfDay(occurrence) - startOfDay(anchor)) / (7 * DAY_MS));
    return weeks / rule.interval + 1;
  }
  if (rule.freq === "monthly") {
    const a = new Date(anchor);
    const b = new Date(occurrence);
    const months =
      (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    return months / rule.interval + 1;
  }
  if (rule.freq === "yearly") {
    const years = new Date(occurrence).getFullYear() - new Date(anchor).getFullYear();
    return years / rule.interval + 1;
  }
  return 1;
}

export function advanceRecurrence(
  task: Task,
  now: Timestamp,
): { nextAt: Timestamp | null; exhausted: boolean } {
  if (!task.recurrence) return { nextAt: null, exhausted: true };

  const anchor = task.dueAt ?? task.scheduledAt;
  if (anchor == null) return { nextAt: null, exhausted: true };

  const next = nextOccurrence(task.recurrence, anchor, anchor);
  if (next == null) return { nextAt: null, exhausted: true };

  if (task.recurrence.count != null) {
    const ordinal = occurrenceOrdinal(task.recurrence, anchor, next);
    if (ordinal > task.recurrence.count) return { nextAt: null, exhausted: true };
  }

  return { nextAt: next, exhausted: false };
}

export function reconcileRecurringTask(
  task: Task,
  now: Timestamp,
): { dueAt: Timestamp | null; scheduledAt: Timestamp | null } | null {
  if (!task.recurrence) return null;

  const anchor = task.dueAt ?? task.scheduledAt;
  if (anchor == null) return null;

  const isOverdue = anchor < startOfDay(now);
  if (!isOverdue) return null;

  let cursor = anchor;
  let next: Timestamp | null = null;
  for (let i = 0; i < 3660; i++) {
    next = nextOccurrence(task.recurrence, cursor, anchor);
    if (next == null) return null;
    if (next >= startOfDay(now)) break;
    cursor = next;
  }

  if (next == null || next < startOfDay(now)) return null;

  const result: { dueAt: Timestamp | null; scheduledAt: Timestamp | null } = {
    dueAt: null,
    scheduledAt: null,
  };
  if (task.dueAt != null) result.dueAt = next;
  if (task.scheduledAt != null) result.scheduledAt = next;
  return result;
}

export function recurrenceKey(rule: RecurrenceRule, anchor: Timestamp): string {
  const days = [...(rule.daysOfWeek ?? [])].sort((a, b) => a - b).join(",");
  return `${rule.freq}:${rule.interval}:${days}:${anchor}`;
}
