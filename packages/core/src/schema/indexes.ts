import { startOfDay } from "../engines/date-utils";
import type { AppState } from "../store/state";
import type { ID, Timestamp } from "../types/common";
import type { CalendarEvent } from "../types/event";
import type { FocusSession } from "../types/engagement";
import type { Task } from "../types/task";

export const UNSCOPED_KEY = "_unscoped";

function pushMulti<K, T>(map: Map<K, T[]>, key: K, item: T): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(item);
  } else {
    map.set(key, [item]);
  }
}

export interface TaskIndexes {
  byStatus: Map<string, Task[]>;
  byProject: Map<ID, Task[]>;
  byGoal: Map<ID, Task[]>;
  byMilestone: Map<ID, Task[]>;
  byParent: Map<ID, Task[]>;
  byHabit: Map<ID, Task[]>;
  byRoutine: Map<ID, Task[]>;
  byLifeArea: Map<ID, Task[]>;
  byCalendar: Map<ID, Task[]>;
  byAssignee: Map<ID, Task[]>;
  byCategory: Map<ID, Task[]>;
  byWorkspace: Map<string, Task[]>;
  byTag: Map<string, Task[]>;
  byDueDay: Map<Timestamp, Task[]>;
}

export function buildTaskIndexes(tasks: Record<ID, Task>): TaskIndexes {
  const indexes: TaskIndexes = {
    byStatus: new Map(),
    byProject: new Map(),
    byGoal: new Map(),
    byMilestone: new Map(),
    byParent: new Map(),
    byHabit: new Map(),
    byRoutine: new Map(),
    byLifeArea: new Map(),
    byCalendar: new Map(),
    byAssignee: new Map(),
    byCategory: new Map(),
    byWorkspace: new Map(),
    byTag: new Map(),
    byDueDay: new Map(),
  };

  for (const task of Object.values(tasks)) {
    if (task.status != null) pushMulti(indexes.byStatus, task.status, task);
    if (task.projectId) pushMulti(indexes.byProject, task.projectId, task);
    for (const goalId of task.goalIds ?? []) pushMulti(indexes.byGoal, goalId, task);
    if (task.milestoneId) pushMulti(indexes.byMilestone, task.milestoneId, task);
    if (task.parentTaskId) pushMulti(indexes.byParent, task.parentTaskId, task);
    if (task.habitId) pushMulti(indexes.byHabit, task.habitId, task);
    if (task.routineId) pushMulti(indexes.byRoutine, task.routineId, task);
    if (task.lifeAreaId) pushMulti(indexes.byLifeArea, task.lifeAreaId, task);
    if (task.calendarId) pushMulti(indexes.byCalendar, task.calendarId, task);
    if (task.assigneeId) pushMulti(indexes.byAssignee, task.assigneeId, task);
    if (task.categoryId) pushMulti(indexes.byCategory, task.categoryId, task);
    pushMulti(indexes.byWorkspace, task.workspaceId ?? UNSCOPED_KEY, task);
    for (const tag of task.tags ?? []) pushMulti(indexes.byTag, tag.toLowerCase(), task);
    const anchor = task.dueAt ?? task.scheduledAt;
    if (anchor != null) pushMulti(indexes.byDueDay, startOfDay(anchor), task);
  }

  return indexes;
}

export function buildEventDayIndex(events: Record<ID, CalendarEvent>): Map<Timestamp, CalendarEvent[]> {
  const index = new Map<Timestamp, CalendarEvent[]>();
  for (const event of Object.values(events)) {
    pushMulti(index, startOfDay(event.startsAt), event);
  }
  return index;
}

export interface CompletionRecord {
  kind: "task" | "habit_checkin" | "focus_session";
  entityId: ID;
  habitId: ID | null;
  at: Timestamp;
}

export function buildCompletionHistory(state: AppState): CompletionRecord[] {
  const records: CompletionRecord[] = [];

  for (const task of Object.values(state.tasks)) {
    if (task.completedAt != null) {
      records.push({ kind: "task", entityId: task.id, habitId: task.habitId ?? null, at: task.completedAt });
    }
  }
  for (const checkin of Object.values(state.habitCheckins)) {
    records.push({ kind: "habit_checkin", entityId: checkin.id, habitId: checkin.habitId, at: checkin.checkedAt });
  }
  for (const session of Object.values(state.focusSessions)) {
    if (session.status === "completed" && session.endsAt != null) {
      records.push({ kind: "focus_session", entityId: session.id, habitId: null, at: session.endsAt });
    }
  }

  records.sort((a, b) => a.at - b.at);
  return records;
}

export interface OSIndexes {
  tasks: TaskIndexes;
  eventsByDay: Map<Timestamp, CalendarEvent[]>;
  completionHistory: CompletionRecord[];
}

export function buildIndexes(state: AppState): OSIndexes {
  return {
    tasks: buildTaskIndexes(state.tasks),
    eventsByDay: buildEventDayIndex(state.events),
    completionHistory: buildCompletionHistory(state),
  };
}
