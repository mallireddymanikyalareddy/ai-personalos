import type { HabitCadence } from "../../types/habit";
import type { Timestamp } from "../../types/common";
import { addDays, startOfDay, startOfWeek } from "../date-utils";

export type WeekIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function mondayIndex(ts: Timestamp): number {
  return (new Date(ts).getDay() + 6) % 7;
}

export interface CadenceSpec {
  cadence: HabitCadence;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  anchor?: Timestamp;
}

export function cadenceDueOn(spec: CadenceSpec, dayStart: Timestamp): boolean {
  const dow = mondayIndex(dayStart);
  switch (spec.cadence) {
    case "daily":
      return true;
    case "weekdays":
      return dow < 5;
    case "weekly": {
      const target = spec.daysOfWeek?.length ? (spec.daysOfWeek[0] ?? 0) % 7 : mondayIndex(spec.anchor ?? Date.now());
      return dow === target;
    }
    case "monthly": {
      const targets = spec.daysOfMonth?.length ? spec.daysOfMonth : [1];
      return targets.includes(new Date(dayStart).getDate());
    }
    case "custom":
      if (spec.daysOfWeek?.length) return spec.daysOfWeek.includes(dow);
      if (spec.daysOfMonth?.length) return spec.daysOfMonth.includes(new Date(dayStart).getDate());
      return false;
  }
}

export type Period = "day" | "week";

export function periodStart(ts: Timestamp, period: Period, weekStart: 0 | 1 = 1): Timestamp {
  return period === "day" ? startOfDay(ts) : startOfWeek(ts, weekStart);
}

export function nextPeriodStart(from: Timestamp, period: Period, weekStart: 0 | 1 = 1): Timestamp {
  if (period === "day") return addDays(startOfDay(from), 1);
  return addDays(startOfWeek(from, weekStart), 7);
}

export function previousPeriodStart(from: Timestamp, period: Period, weekStart: 0 | 1 = 1): Timestamp {
  if (period === "day") return addDays(startOfDay(from), -1);
  return addDays(startOfWeek(from, weekStart), -7);
}

export function isPeriodDueIn(
  spec: CadenceSpec,
  periodFrom: Timestamp,
  periodTo: Timestamp,
  now: Timestamp,
): boolean {
  for (let day = periodFrom; day < periodTo; day = addDays(day, 1)) {
    if (day > now) break;
    if (cadenceDueOn(spec, day)) return true;
  }
  return false;
}

export function cadenceLabel(spec: CadenceSpec): string {
  switch (spec.cadence) {
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "custom":
      if (spec.daysOfWeek?.length) return `Weekly · ${spec.daysOfWeek.map((d) => DAY_NAMES[d] ?? d).join(" ")}`;
      if (spec.daysOfMonth?.length) return `Monthly · ${spec.daysOfMonth.map((d) => `${d}${ordinal(d)}`).join(" ")}`;
      return "Custom";
  }
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ordinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

export { DAY_NAMES };