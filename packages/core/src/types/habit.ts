import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";

export type HabitCadence = "daily" | "weekdays" | "weekly" | "monthly" | "custom";
export type HabitPeriod = "day" | "week";
export type HabitPriority = "low" | "medium" | "high";

export interface Habit extends EntityMeta {
  type: "habit";
  title: string;
  description: string | null;
  cadence: HabitCadence;
  daysOfWeek: number[];
  daysOfMonth: number[];
  targetPerPeriod: number;
  period: HabitPeriod;
  priority: HabitPriority;
  color: string | null;
  icon: string | null;
  goalId: ID | null;
  archived: boolean;
}

export interface NewHabitInput {
  title: string;
  description?: string | null;
  cadence?: HabitCadence;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  targetPerPeriod?: number;
  period?: HabitPeriod;
  priority?: HabitPriority;
  color?: string | null;
  icon?: string | null;
  goalId?: ID | null;
}

export function createHabit(input: NewHabitInput, now: Timestamp = Date.now()): Habit {
  const description = input.description?.trim() ?? "";
  return {
    type: "habit",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    description: description.length > 0 ? description : null,
    cadence: input.cadence ?? "daily",
    daysOfWeek: input.daysOfWeek ?? [],
    daysOfMonth: input.daysOfMonth ?? [],
    targetPerPeriod: input.targetPerPeriod ?? 1,
    period: input.period ?? "day",
    priority: input.priority ?? "medium",
    color: input.color ?? null,
    icon: input.icon ?? null,
    goalId: input.goalId ?? null,
    archived: false,
  };
}

export interface HabitCheckIn extends EntityMeta {
  type: "habit_checkin";
  habitId: ID;
  checkedAt: Timestamp;
  taskId: ID | null;
}

export function createHabitCheckIn(
  habitId: ID,
  checkedAt: Timestamp,
  taskId: ID | null = null,
  now: Timestamp = Date.now(),
): HabitCheckIn {
  return {
    type: "habit_checkin",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    habitId,
    checkedAt,
    taskId,
  };
}
