import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Habit, HabitCheckIn } from "../../types/habit";
import type { Task } from "../../types/task";
import { addDays, startOfDay } from "../date-utils";
import {
  cadenceDueOn,
  isPeriodDueIn,
  nextPeriodStart,
  periodStart,
  previousPeriodStart,
  type CadenceSpec,
  type Period,
} from "../repeat/cadence";

export const HABIT_MAX_STREAK_PERIODS = 3652;

export function habitSpec(habit: Habit): CadenceSpec {
  return {
    cadence: habit.cadence,
    daysOfWeek: habit.daysOfWeek,
    daysOfMonth: habit.daysOfMonth,
    anchor: habit.createdAt,
  };
}

export function activeHabits(state: AppState): Habit[] {
  return Object.values(state.habits).filter((habit) => !habit.archived);
}

export function habitDueOn(state: AppState, habit: Habit, dayStart: Timestamp): boolean {
  return cadenceDueOn(habitSpec(habit), dayStart);
}

export function habitPeriodBounds(
  habit: Habit,
  dayStart: Timestamp,
  weekStart: 0 | 1 = 1,
): { from: Timestamp; to: Timestamp } {
  const from = periodStart(dayStart, habit.period as Period, weekStart);
  return { from, to: nextPeriodStart(from, habit.period as Period, weekStart) };
}

export function checkInsForHabit(state: AppState, habitId: ID): HabitCheckIn[] {
  return Object.values(state.habitCheckins).filter((checkin) => checkin.habitId === habitId);
}

export function habitCheckedOnDay(
  state: AppState,
  habit: Habit,
  dayStart: Timestamp,
): boolean {
  return Object.values(state.habitCheckins).some(
    (checkin) =>
      checkin.habitId === habit.id && startOfDay(checkin.checkedAt) === dayStart,
  );
}

export function habitAttendedDays(
  state: AppState,
  habit: Habit,
  from: Timestamp,
  to: Timestamp,
): Set<Timestamp> {
  const days = new Set<Timestamp>();
  for (const checkin of Object.values(state.habitCheckins)) {
    if (checkin.habitId !== habit.id) continue;
    if (checkin.checkedAt >= from && checkin.checkedAt < to) {
      days.add(startOfDay(checkin.checkedAt));
    }
  }
  for (const task of Object.values(state.tasks)) {
    if (task.habitId !== habit.id || task.completedAt == null) continue;
    if (task.completedAt >= from && task.completedAt < to) {
      days.add(startOfDay(task.completedAt));
    }
  }
  return days;
}

export function habitPeriodMet(
  state: AppState,
  habit: Habit,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp,
): boolean {
  if (from > now) return false;
  return habitAttendedDays(state, habit, from, to).size >= habit.targetPerPeriod;
}

export function findHabitOccurrenceTask(
  state: AppState,
  habit: Habit,
  dayStart: Timestamp,
  weekStart: 0 | 1 = 1,
): Task | null {
  const { from, to } = habitPeriodBounds(habit, dayStart, weekStart);
  return (
    Object.values(state.tasks).find(
      (task) =>
        task.habitId === habit.id &&
        task.status !== "done" &&
        task.status !== "cancelled" &&
        task.status !== "archived" &&
        task.dueAt != null &&
        task.dueAt >= from &&
        task.dueAt < to,
    ) ?? null
  );
}

interface PeriodSample {
  from: Timestamp;
  to: Timestamp;
  due: boolean;
  met: boolean;
}

function enumeratePeriods(
  state: AppState,
  habit: Habit,
  now: Timestamp,
  weekStart: 0 | 1,
  maxSteps: number,
  floor: Timestamp | null,
): PeriodSample[] {
  const period = habit.period as Period;
  const start = Math.max(periodStart(habit.createdAt, period, weekStart), floor ?? 0);
  const periods: PeriodSample[] = [];
  let cursor = periodStart(now, period, weekStart);
  const periodSpec = habitSpec(habit);
  for (let steps = 0; steps < maxSteps && cursor >= start; steps += 1) {
    const from = cursor;
    const to = nextPeriodStart(from, period, weekStart);
    periods.push({
      from,
      to,
      due: isPeriodDueIn(periodSpec, from, to, now),
      met: habitPeriodMet(state, habit, from, to, now),
    });
    cursor = previousPeriodStart(cursor, period, weekStart);
  }
  return periods;
}

export interface HabitStreaks {
  current: number;
  best: number;
}

export function habitStreaks(
  state: AppState,
  habit: Habit,
  now: Timestamp,
  weekStart: 0 | 1 = 1,
): HabitStreaks {
  const periods = enumeratePeriods(
    state,
    habit,
    now,
    weekStart,
    HABIT_MAX_STREAK_PERIODS,
    null,
  ).filter((sample) => sample.due);

  let current = 0;
  let cursor = 0;
  if (cursor < periods.length && !periods[cursor]!.met) cursor += 1;
  while (cursor < periods.length && periods[cursor]!.met) {
    current += 1;
    cursor += 1;
  }

  let best = 0;
  let run = 0;
  for (const sample of periods) {
    if (sample.met) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, best };
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  duePeriods: number;
  metPeriods: number;
  attendedDays: number;
  totalCheckIns: number;
  lastCheckedAt: Timestamp | null;
}

export function habitStats(
  state: AppState,
  habit: Habit,
  now: Timestamp,
  weekStart: 0 | 1 = 1,
  lookbackPeriods = 28,
  floor: Timestamp | null = null,
): HabitStats {
  const streaks = habitStreaks(state, habit, now, weekStart);
  const checkins = checkInsForHabit(state, habit.id);

  const dayMs = 86_400_000;
  const lastN =
    habit.period === "week"
      ? lookbackPeriods * 7 * dayMs
      : (lookbackPeriods - 1) * dayMs;
  const lookbackFloor = periodStart(now, habit.period as Period, weekStart) - lastN;
  const effectiveFloor = floor != null ? Math.max(floor, lookbackFloor) : lookbackFloor;

  const samples = enumeratePeriods(
    state,
    habit,
    now,
    weekStart,
    lookbackPeriods * 3,
    effectiveFloor,
  ).filter((sample) => sample.to <= now + 1);

  const due = samples.filter((sample) => sample.due);
  const met = samples.filter((sample) => sample.met);
  const completionRate = due.length > 0 ? Math.round((met.length / due.length) * 100) : 0;

  let lastCheckedAt: Timestamp | null = null;
  for (const checkin of checkins) {
    if (lastCheckedAt == null || checkin.checkedAt > lastCheckedAt) lastCheckedAt = checkin.checkedAt;
  }

  return {
    currentStreak: streaks.current,
    bestStreak: streaks.best,
    completionRate,
    duePeriods: due.length,
    metPeriods: met.length,
    attendedDays: habitAttendedDays(state, habit, 0, now + 1).size,
    totalCheckIns: checkins.length,
    lastCheckedAt,
  };
}

export function habitDueSpan(state: AppState, habit: Habit, from: Timestamp, to: Timestamp): Timestamp[] {
  const days: Timestamp[] = [];
  const spec = habitSpec(habit);
  for (let day = startOfDay(from); day <= to; day = addDays(day, 1)) {
    if (cadenceDueOn(spec, day)) days.push(day);
  }
  return days;
}

export function habitAnchorForPeriod(
  habit: Habit,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp,
): Timestamp | null {
  const spec = habitSpec(habit);
  for (let day = from; day < to; day = addDays(day, 1)) {
    if (day > now) break;
    if (cadenceDueOn(spec, day)) return day;
  }
  for (let day = now; day < to; day = addDays(day, 1)) {
    if (cadenceDueOn(spec, day)) return day;
  }
  return null;
}