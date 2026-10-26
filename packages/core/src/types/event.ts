import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";
import type { RecurrenceRule, TaskSource } from "./task";
import { DEFAULT_MODE, type Mode } from "./collaboration";

export interface Attendee {
  id: ID;
  name: string;
  email: string;
  status: "accepted" | "declined" | "tentative" | "needs_action";
  isOrganizer: boolean;
}

export interface CalendarEvent extends EntityMeta {
  type: "event";
  title: string;
  notes: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  allDay: boolean;
  location: string;
  projectId: ID | null;
  taskId: ID | null;
  calendarId: ID | null;
  source: TaskSource;
  attendees: Attendee[];
  categoryId: ID | null;
  color: string | null;
  recurrence: RecurrenceRule | null;
  recurrenceId: ID | null;
  recurrenceOrdinal: number;
  reminderIds: ID[];
  mode: Mode;
  sharedWith: ID[];
}

export interface NewEventInput {
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  notes?: string;
  allDay?: boolean;
  location?: string;
  projectId?: ID | null;
  taskId?: ID | null;
  calendarId?: ID | null;
  source?: TaskSource;
  attendees?: Attendee[];
  categoryId?: ID | null;
  color?: string | null;
  recurrence?: RecurrenceRule | null;
  recurrenceId?: ID | null;
  recurrenceOrdinal?: number;
  reminderIds?: ID[];
  mode?: Mode;
  sharedWith?: ID[];
}

export function createEvent(input: NewEventInput, now: Timestamp = Date.now()): CalendarEvent {
  return {
    type: "event",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    notes: input.notes ?? "",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay ?? false,
    location: input.location ?? "",
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    calendarId: input.calendarId ?? null,
    source: input.source ?? "manual",
    attendees: input.attendees ?? [],
    categoryId: input.categoryId ?? null,
    color: input.color ?? null,
    recurrence: input.recurrence ?? null,
    recurrenceId: input.recurrenceId ?? null,
    recurrenceOrdinal: input.recurrenceOrdinal ?? 1,
    reminderIds: input.reminderIds ?? [],
    mode: input.mode ?? DEFAULT_MODE,
    sharedWith: input.sharedWith ?? [],
  };
}
