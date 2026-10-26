import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { PlanningPreferences } from "../../types/profile";
import { findFreeSlots, type FreeSlot } from "../calendar/freebusy";
import { startOfDay } from "../date-utils";

export interface DayWindow {
  day: Timestamp;
  from: Timestamp;
  to: Timestamp;
}

export function resolveHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function enumerateDayWindows(
  prefs: PlanningPreferences,
  from: Timestamp,
  to: Timestamp,
  options: { ignoreWorkDays?: boolean } = {},
): DayWindow[] {
  const startMin = resolveHHMM(prefs.dayStart) ?? 9 * 60;
  const endMin = resolveHHMM(prefs.dayEnd) ?? 17 * 60;
  const windows: DayWindow[] = [];
  const firstDay = startOfDay(from);
  const lastDay = startOfDay(to);
  const step = 86_400_000;
  for (let day = firstDay; day <= lastDay; day += step) {
    const weekday = new Date(day).getDay();
    if (!options.ignoreWorkDays && prefs.workDays.length > 0 && !prefs.workDays.includes(weekday)) {
      continue;
    }
    const winFrom = day + startMin * 60_000;
    const winTo = day + endMin * 60_000;
    const start = Math.max(winFrom, from);
    const end = Math.min(winTo, to);
    if (start < end) windows.push({ day, from: start, to: end });
  }
  return windows;
}

export function findPlanningWindows(
  state: AppState,
  prefs: PlanningPreferences,
  from: Timestamp,
  to: Timestamp,
  minDurationMin = 30,
): FreeSlot[] {
  const slots: FreeSlot[] = [];
  for (const window of enumerateDayWindows(prefs, from, to)) {
    slots.push(...findFreeSlots(state, window.from, window.to, minDurationMin));
  }
  return slots;
}

export function totalPlanningFreeMinutes(
  state: AppState,
  prefs: PlanningPreferences,
  from: Timestamp,
  to: Timestamp,
  minDurationMin = 30,
): number {
  return findPlanningWindows(state, prefs, from, to, minDurationMin).reduce(
    (sum, slot) => sum + slot.durationMin,
    0,
  );
}

export function nextPlanningDay(
  prefs: PlanningPreferences,
  from: Timestamp,
): Timestamp {
  const step = 86_400_000;
  for (let i = 0; i < 14; i++) {
    const day = from + i * step;
    const weekday = new Date(day).getDay();
    if (prefs.workDays.length > 0 && !prefs.workDays.includes(weekday)) continue;
    return day;
  }
  return from;
}