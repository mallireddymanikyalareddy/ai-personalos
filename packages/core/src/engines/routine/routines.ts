import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { Routine, RoutineStep } from "../../types/planning";
import { startOfDay } from "../date-utils";
import { findHabitOccurrenceTask } from "../habit/habits";
import { cadenceDueOn, type CadenceSpec } from "../repeat/cadence";

export function routineSpec(routine: Routine): CadenceSpec {
  return {
    cadence: routine.cadence,
    daysOfWeek: routine.daysOfWeek,
    anchor: routine.createdAt,
  };
}

export function activeRoutines(state: AppState): Routine[] {
  return Object.values(state.routines).filter((routine) => routine.status === "active");
}

export function routineDueOn(state: AppState, routine: Routine, dayStart: Timestamp): boolean {
  return cadenceDueOn(routineSpec(routine), dayStart);
}

export interface RoutineItem {
  step: RoutineStep;
  taskId: string | null;
  habitId: string | null;
  title: string;
  durationMin: number | null;
}

export function resolveRoutineItems(
  state: AppState,
  routine: Routine,
  dayStart: Timestamp,
): RoutineItem[] {
  const items: RoutineItem[] = [];
  const dayFrom = startOfDay(dayStart);
  const dayTo = dayFrom + 86_400_000;
  for (const step of routine.steps) {
    let taskId: string | null = null;
    let habitId: string | null = null;
    let title = step.title || null;

    if (step.taskId != null && state.tasks[step.taskId]) {
      taskId = step.taskId;
      title = title ?? state.tasks[step.taskId]!.title;
    } else if (step.habitId != null) {
      const habit = state.habits[step.habitId];
      if (habit) {
        habitId = step.habitId;
        title = title ?? habit.title;
        const occurrence = findHabitOccurrenceTask(state, habit, dayStart);
        taskId = occurrence?.id ?? null;
      }
    } else {
      const materialized = Object.values(state.tasks).find(
        (task) =>
          task.routineId === routine.id &&
          task.title === step.title &&
          task.dueAt != null &&
          task.dueAt >= dayFrom &&
          task.dueAt < dayTo &&
          task.status !== "cancelled" &&
          task.status !== "archived",
      );
      taskId = materialized?.id ?? null;
    }

    items.push({
      step,
      taskId,
      habitId,
      title: title ?? "Untitled step",
      durationMin: step.durationMin,
    });
  }
  return items;
}

export function routineCompleteOn(
  state: AppState,
  routine: Routine,
  dayStart: Timestamp,
): boolean {
  const items = resolveRoutineItems(state, routine, dayStart);
  if (items.length === 0) return false;
  const bound = { from: startOfDay(dayStart), to: startOfDay(dayStart) + 86_400_000 };
  return items.every((item) => {
    if (item.taskId == null) return false;
    const task = state.tasks[item.taskId];
    return (
      task != null &&
      task.status === "done" &&
      task.completedAt != null &&
      task.completedAt >= bound.from &&
      task.completedAt < bound.to
    );
  });
}

export interface RoutineStats {
  total: number;
  resolved: number;
  doneToday: number;
  completeToday: boolean;
}

export function routineStats(
  state: AppState,
  routine: Routine,
  dayStart: Timestamp,
): RoutineStats {
  const items = resolveRoutineItems(state, routine, dayStart);
  const resolved = items.filter((item) => item.taskId != null);
  const bound = { from: startOfDay(dayStart), to: startOfDay(dayStart) + 86_400_000 };
  const doneToday = resolved.filter((item) => {
    const task = state.tasks[item.taskId!];
    return task != null && task.status === "done" && task.completedAt != null
      ? task.completedAt >= bound.from && task.completedAt < bound.to
      : false;
  }).length;
  return {
    total: items.length,
    resolved: resolved.length,
    doneToday,
    completeToday: items.length > 0 && doneToday === items.length,
  };
}