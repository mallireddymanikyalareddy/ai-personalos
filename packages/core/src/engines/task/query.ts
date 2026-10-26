import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import {
  allTasks,
  effectiveAt,
  isActive,
  isInInbox,
  isOpen,
  isOverdue,
  isDueToday,
  isScheduledToday,
  sortTasks,
  topLevel,
} from "./transitions";

export interface TaskQuery {
  status?: string[];
  priority?: number[];
  projectId?: ID | null;
  goalId?: ID | null;
  categoryId?: ID | null;
  assigneeId?: ID | null;
  habitId?: ID | null;
  tags?: string[];
  dueBefore?: Timestamp | null;
  dueAfter?: Timestamp | null;
  search?: string;
  includeArchived?: boolean;
  includeCancelled?: boolean;
  includeDone?: boolean;
  recurrenceId?: ID | null;
  parentTaskId?: ID | null;
}

export function queryTasks(state: AppState, query: TaskQuery): Task[] {
  let tasks = allTasks(state);

  if (!query.includeArchived) tasks = tasks.filter((t) => t.status !== "archived");
  if (!query.includeCancelled) tasks = tasks.filter((t) => t.status !== "cancelled");
  if (!query.includeDone) tasks = tasks.filter((t) => t.status !== "done");

  if (query.status && query.status.length > 0) {
    tasks = tasks.filter((t) => query.status!.includes(t.status));
  }
  if (query.priority && query.priority.length > 0) {
    tasks = tasks.filter((t) => query.priority!.includes(t.priority));
  }
  if (query.projectId !== undefined) {
    tasks = tasks.filter((t) => t.projectId === query.projectId);
  }
  if (query.goalId !== undefined) {
    tasks = tasks.filter((t) => t.goalIds.includes(query.goalId!));
  }
  if (query.categoryId !== undefined) {
    tasks = tasks.filter((t) => t.categoryId === query.categoryId);
  }
  if (query.assigneeId !== undefined) {
    tasks = tasks.filter((t) => t.assigneeId === query.assigneeId);
  }
  if (query.habitId !== undefined) {
    tasks = tasks.filter((t) => t.habitId === query.habitId);
  }
  if (query.tags && query.tags.length > 0) {
    tasks = tasks.filter((t) =>
      query.tags!.some((tag) => t.tags.includes(tag)),
    );
  }
  if (query.dueBefore != null) {
    tasks = tasks.filter((t) => t.dueAt != null && t.dueAt <= query.dueBefore!);
  }
  if (query.dueAfter != null) {
    tasks = tasks.filter((t) => t.dueAt != null && t.dueAt >= query.dueAfter!);
  }
  if (query.recurrenceId !== undefined) {
    tasks = tasks.filter((t) => t.recurrenceId === query.recurrenceId);
  }
  if (query.parentTaskId !== undefined) {
    tasks = tasks.filter((t) => t.parentTaskId === query.parentTaskId);
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }

  return tasks;
}

export function searchTasks(state: AppState, text: string): Task[] {
  return queryTasks(state, { search: text });
}

export function selectTasksByProject(state: AppState, projectId: ID): Task[] {
  return queryTasks(state, { projectId, includeDone: true, includeCancelled: true });
}

export function selectTasksByGoal(state: AppState, goalId: ID): Task[] {
  return queryTasks(state, { goalId, includeDone: true, includeCancelled: true });
}

export function selectTasksByAssignee(state: AppState, assigneeId: ID): Task[] {
  return queryTasks(state, { assigneeId, includeDone: true, includeCancelled: true });
}

export function selectTasksByTag(state: AppState, tag: string): Task[] {
  return queryTasks(state, { tags: [tag], includeDone: true, includeCancelled: true });
}

export function selectTasksByCategory(state: AppState, categoryId: ID): Task[] {
  return queryTasks(state, { categoryId, includeDone: true, includeCancelled: true });
}

export function selectTasksByHabit(state: AppState, habitId: ID): Task[] {
  return queryTasks(state, { habitId, includeDone: true, includeCancelled: true });
}

export function selectCalendarTasks(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): Task[] {
  return allTasks(state).filter((task) => {
    if (!isOpen(task)) return false;
    const at = effectiveAt(task);
    return at != null && at >= from && at <= to;
  });
}

export function selectPlannableTasks(state: AppState, now: Timestamp): Task[] {
  return sortTasks(
    topLevel(allTasks(state)).filter(
      (task) =>
        isOpen(task) &&
        (task.dueAt == null || isDueToday(task, now) || isOverdue(task, now)),
    ),
    "smart",
    now,
  );
}

export function selectFocusCandidates(state: AppState, now: Timestamp): Task[] {
  return sortTasks(
    topLevel(allTasks(state)).filter(
      (task) => isActive(task) && !isOverdue(task, now),
    ),
    "priority",
    now,
  ).slice(0, 5);
}

export interface CompletionStats {
  total: number;
  done: number;
  open: number;
  cancelled: number;
  archived: number;
  overdue: number;
  byPriority: Record<number, number>;
  byDay: Record<string, number>;
}

export function selectCompletionStats(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp,
): CompletionStats {
  const tasks = allTasks(state).filter(
    (t) => t.createdAt >= from && t.createdAt <= to,
  );
  const stats: CompletionStats = {
    total: tasks.length,
    done: 0,
    open: 0,
    cancelled: 0,
    archived: 0,
    overdue: 0,
    byPriority: {},
    byDay: {},
  };
  for (const task of tasks) {
    if (task.status === "done") stats.done += 1;
    if (task.status === "open" || task.status === "in_progress" || task.status === "inbox") stats.open += 1;
    if (task.status === "cancelled") stats.cancelled += 1;
    if (task.status === "archived") stats.archived += 1;
    if (isOverdue(task, now)) stats.overdue += 1;
    stats.byPriority[task.priority] = (stats.byPriority[task.priority] ?? 0) + 1;
    if (task.completedAt != null) {
      const day = new Date(task.completedAt).toISOString().slice(0, 10);
      stats.byDay[day] = (stats.byDay[day] ?? 0) + 1;
    }
  }
  return stats;
}

export interface GoalTaskProgress {
  total: number;
  done: number;
  open: number;
  overdue: number;
}

export function selectGoalTaskProgress(state: AppState, goalId: ID, now: Timestamp): GoalTaskProgress {
  const tasks = allTasks(state).filter((t) => t.goalIds.includes(goalId));
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    open: tasks.filter((t) => isOpen(t)).length,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
  };
}

export interface AITaskContext {
  inbox: Task[];
  today: Task[];
  overdue: Task[];
  upcoming: Task[];
  focus: Task[];
  blocked: Task[];
}

export function taskContextForAI(state: AppState, now: Timestamp): AITaskContext {
  const all = allTasks(state);
  return {
    inbox: all.filter(isInInbox),
    today: all.filter((t) => isDueToday(t, now) || isScheduledToday(t, now)),
    overdue: all.filter((t) => isOverdue(t, now)),
    upcoming: all.filter((t) => {
      const at = effectiveAt(t);
      return isOpen(t) && at != null && at > now;
    }),
    focus: selectFocusCandidates(state, now),
    blocked: all.filter((t) => t.dependsOn.length > 0),
  };
}
