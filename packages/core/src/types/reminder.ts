import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";

export type ReminderMethod = "in_app" | "push" | "email";

export interface Reminder extends EntityMeta {
  type: "reminder";
  fireAt: Timestamp;
  method: ReminderMethod;
  message: string;
  taskId: ID | null;
  eventId: ID | null;
  noteId: ID | null;
  meetingId: ID | null;
  habitId: ID | null;
  firedAt: Timestamp | null;
}

export interface NewReminderInput {
  fireAt: Timestamp;
  method?: ReminderMethod;
  message?: string;
  taskId?: ID | null;
  eventId?: ID | null;
  noteId?: ID | null;
  meetingId?: ID | null;
  habitId?: ID | null;
}

export function createReminder(input: NewReminderInput, now: Timestamp = Date.now()): Reminder {
  return {
    type: "reminder",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    fireAt: input.fireAt,
    method: input.method ?? "in_app",
    message: input.message ?? "",
    taskId: input.taskId ?? null,
    eventId: input.eventId ?? null,
    noteId: input.noteId ?? null,
    meetingId: input.meetingId ?? null,
    habitId: input.habitId ?? null,
    firedAt: null,
  };
}
