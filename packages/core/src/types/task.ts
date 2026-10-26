import type { EntityMeta, ID, Priority, Timestamp } from "./common";
import { newId } from "./common";
import { DEFAULT_MODE, type Mode } from "./collaboration";

export type TaskStatus =
  | "inbox"
  | "open"
  | "in_progress"
  | "review"
  | "done"
  | "cancelled"
  | "archived";

export type TaskSource = "manual" | "capture" | "ai" | "habit" | "import" | "integration";

export type RecurrenceFrequency = "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  freq: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[];
  endsAt?: Timestamp | null;
  count?: number | null;
}

export interface Task extends EntityMeta {
  type: "task";
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: Timestamp | null;
  scheduledAt: Timestamp | null;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  estimateMin: number | null;
  projectId: ID | null;
  goalIds: ID[];
  milestoneId: ID | null;
  parentTaskId: ID | null;
  habitId: ID | null;
  routineId: ID | null;
  calendarId: ID | null;
  lifeAreaId: ID | null;
  categoryId: ID | null;
  assigneeId: ID | null;
  workspaceId: ID | null;
  tags: string[];
  reminderIds: ID[];
  recurrence: RecurrenceRule | null;
  recurrenceId: ID | null;
  recurrenceOrdinal: number;
  dependsOn: ID[];
  source: TaskSource;
  order: number;
  mode: Mode;
}

export interface NewTaskInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueAt?: Timestamp | null;
  scheduledAt?: Timestamp | null;
  estimateMin?: number | null;
  projectId?: ID | null;
  goalIds?: ID[];
  milestoneId?: ID | null;
  parentTaskId?: ID | null;
  habitId?: ID | null;
  routineId?: ID | null;
  calendarId?: ID | null;
  lifeAreaId?: ID | null;
  categoryId?: ID | null;
  assigneeId?: ID | null;
  workspaceId?: ID | null;
  tags?: string[];
  source?: TaskSource;
  order?: number;
  recurrence?: RecurrenceRule | null;
  recurrenceId?: ID | null;
  recurrenceOrdinal?: number;
  dependsOn?: ID[];
  mode?: Mode;
}

export function createTask(input: NewTaskInput, now: Timestamp = Date.now()): Task {
  return {
    type: "task",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    notes: input.notes ?? "",
    status: input.status ?? "inbox",
    priority: input.priority ?? 0,
    dueAt: input.dueAt ?? null,
    scheduledAt: input.scheduledAt ?? null,
    startedAt: null,
    completedAt: null,
    estimateMin: input.estimateMin ?? null,
    projectId: input.projectId ?? null,
    goalIds: input.goalIds ?? [],
    milestoneId: input.milestoneId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    habitId: input.habitId ?? null,
    routineId: input.routineId ?? null,
    calendarId: input.calendarId ?? null,
    lifeAreaId: input.lifeAreaId ?? null,
    categoryId: input.categoryId ?? null,
    assigneeId: input.assigneeId ?? null,
    workspaceId: input.workspaceId ?? null,
    tags: input.tags ?? [],
    reminderIds: [],
    recurrence: input.recurrence ?? null,
    recurrenceId: input.recurrenceId ?? null,
    recurrenceOrdinal: input.recurrenceOrdinal ?? 1,
    dependsOn: input.dependsOn ?? [],
    source: input.source ?? "manual",
    order: input.order ?? now,
    mode: input.mode ?? DEFAULT_MODE,
  };
}
