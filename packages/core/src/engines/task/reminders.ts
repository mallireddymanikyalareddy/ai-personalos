import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Reminder, ReminderMethod } from "../../types/reminder";
import type { Task } from "../../types/task";

export interface TaskReminderInput {
  at?: Timestamp | null;
  offsetMin?: number | null;
  method?: ReminderMethod;
  message?: string;
}

export function resolveReminderFireAt(
  input: TaskReminderInput,
  task: Task,
): Timestamp | null {
  if (input.at != null) return input.at;
  if (input.offsetMin != null) {
    const base = task.dueAt ?? task.scheduledAt;
    if (base != null) return base + input.offsetMin * 60_000;
  }
  return null;
}

export function selectRemindersForTask(state: AppState, taskId: ID): Reminder[] {
  return Object.values(state.reminders)
    .filter((reminder) => reminder.taskId === taskId)
    .sort((a, b) => a.fireAt - b.fireAt);
}

export function selectPendingReminders(state: AppState, now: Timestamp): Reminder[] {
  return Object.values(state.reminders)
    .filter((reminder) => reminder.firedAt == null && reminder.fireAt <= now)
    .sort((a, b) => a.fireAt - b.fireAt);
}

export function markReminderFired(reminder: Reminder, now: Timestamp): Reminder {
  return { ...reminder, firedAt: now };
}

export function resolveRemindersForTask(
  state: AppState,
  taskId: ID,
  now: Timestamp,
): Reminder[] {
  return selectRemindersForTask(state, taskId)
    .filter((reminder) => reminder.firedAt == null)
    .map((reminder) => markReminderFired(reminder, now));
}

export function reminderSatisfied(reminder: Reminder): boolean {
  return reminder.firedAt != null;
}
