import type { AppState } from "../../store/state";
import type { ID, TaskSort, Timestamp } from "../../types/common";
import type { Task, TaskStatus } from "../../types/task";
import { endOfDay, isSameDay, startOfDay } from "../date-utils";

export function allTasks(state: AppState): Task[] {
  return Object.values(state.tasks);
}

export function isOpen(task: Task): boolean {
  return task.status !== "done" && task.status !== "cancelled" && task.status !== "archived";
}

export function isActive(task: Task): boolean {
  return task.status === "open" || task.status === "in_progress";
}

export function isInInbox(task: Task): boolean {
  return task.status === "inbox";
}

export function topLevel(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.parentTaskId == null);
}

export function effectiveAt(task: Task): Timestamp | null {
  const dates: Timestamp[] = [];
  if (task.dueAt != null) dates.push(task.dueAt);
  if (task.scheduledAt != null) dates.push(task.scheduledAt);
  if (dates.length === 0) return null;
  return Math.min(...dates);
}

export function isOverdue(task: Task, now: Timestamp): boolean {
  return isOpen(task) && task.dueAt != null && task.dueAt < startOfDay(now);
}

export function isDueToday(task: Task, now: Timestamp): boolean {
  return isOpen(task) && task.dueAt != null && isSameDay(task.dueAt, now);
}

export function isScheduledToday(task: Task, now: Timestamp): boolean {
  return isOpen(task) && task.scheduledAt != null && isSameDay(task.scheduledAt, now);
}

export function plannedStatus(task: {
  status: TaskStatus;
  dueAt: Timestamp | null;
  scheduledAt: Timestamp | null;
  projectId: ID | null;
}): TaskStatus {
  if (task.status !== "inbox") return task.status;
  if (task.dueAt != null || task.scheduledAt != null || task.projectId != null) return "open";
  return "inbox";
}

function smartRank(task: Task, now: Timestamp): number {
  if (isOverdue(task, now)) return 0;
  if (isDueToday(task, now)) return 1;
  if (isScheduledToday(task, now)) return 2;
  if (effectiveAt(task) != null) return 3;
  return 4;
}

function effectiveOrInfinity(task: Task): Timestamp {
  return effectiveAt(task) ?? Number.POSITIVE_INFINITY;
}

export function compareTasks(a: Task, b: Task, mode: TaskSort, now: Timestamp): number {
  switch (mode) {
    case "smart": {
      const rank = smartRank(a, now) - smartRank(b, now);
      if (rank !== 0) return rank;
      const byPriority = b.priority - a.priority;
      if (byPriority !== 0) return byPriority;
      const byDate = effectiveOrInfinity(a) - effectiveOrInfinity(b);
      if (byDate !== 0) return byDate;
      return b.createdAt - a.createdAt;
    }
    case "due": {
      const byDate = effectiveOrInfinity(a) - effectiveOrInfinity(b);
      if (byDate !== 0) return byDate;
      const byPriority = b.priority - a.priority;
      if (byPriority !== 0) return byPriority;
      return b.createdAt - a.createdAt;
    }
    case "priority": {
      const byPriority = b.priority - a.priority;
      if (byPriority !== 0) return byPriority;
      const byDate = effectiveOrInfinity(a) - effectiveOrInfinity(b);
      if (byDate !== 0) return byDate;
      return b.createdAt - a.createdAt;
    }
    case "created":
      return b.createdAt - a.createdAt;
    case "title":
      return a.title.localeCompare(b.title);
    default:
      return 0;
  }
}

export function sortTasks(tasks: Task[], mode: TaskSort, now: Timestamp): Task[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, mode, now));
}

export function selectInboxTasks(state: AppState): Task[] {
  return topLevel(allTasks(state).filter(isInInbox)).sort((a, b) => b.createdAt - a.createdAt);
}

export function selectTodayTasks(state: AppState, now: Timestamp): Task[] {
  const tasks = topLevel(
    allTasks(state).filter(
      (task) =>
        isOpen(task) &&
        (isOverdue(task, now) || isDueToday(task, now) || isScheduledToday(task, now)),
    ),
  );
  return sortTasks(tasks, "smart", now);
}

export function selectOverdueTasks(state: AppState, now: Timestamp): Task[] {
  return sortTasks(topLevel(allTasks(state).filter((task) => isOverdue(task, now))), "due", now);
}

export function selectUpcomingTasks(state: AppState, now: Timestamp): Task[] {
  const limit = endOfDay(now);
  const tasks = topLevel(allTasks(state)).filter((task) => {
    const at = effectiveAt(task);
    return isOpen(task) && at != null && at > limit;
  });
  return sortTasks(tasks, "due", now);
}

export function selectActiveTasks(state: AppState, now: Timestamp): Task[] {
  return sortTasks(topLevel(allTasks(state).filter(isOpen)), "smart", now);
}

export function selectDoneTasks(state: AppState, limit = 50): Task[] {
  return allTasks(state)
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt))
    .slice(0, limit);
}

export function selectCompletedToday(state: AppState, now: Timestamp): Task[] {
  return allTasks(state)
    .filter((task) => task.status === "done" && task.completedAt != null && isSameDay(task.completedAt, now))
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

export function selectProjectTasks(state: AppState, projectId: ID, now: Timestamp): Task[] {
  const tasks = topLevel(allTasks(state)).filter(
    (task) => task.projectId === projectId && isOpen(task),
  );
  return sortTasks(tasks, "smart", now);
}

export function selectTaskChildren(state: AppState, taskId: ID): Task[] {
  return allTasks(state)
    .filter((task) => task.parentTaskId === taskId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function selectSubtaskProgress(state: AppState, taskId: ID): { done: number; total: number } {
  const children = selectTaskChildren(state, taskId);
  return {
    done: children.filter((child) => child.status === "done").length,
    total: children.length,
  };
}

export interface DayGroup {
  day: Timestamp;
  tasks: Task[];
}

export function groupTasksByDay(tasks: Task[]): DayGroup[] {
  const groups = new Map<Timestamp, Task[]>();
  for (const task of tasks) {
    const at = effectiveAt(task) ?? task.createdAt;
    const day = startOfDay(at);
    const bucket = groups.get(day);
    if (bucket) bucket.push(task);
    else groups.set(day, [task]);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, groupTasks]) => ({ day, tasks: groupTasks }));
}

export function selectAgenda(state: AppState, from: Timestamp, to: Timestamp, now: Timestamp): Task[] {
  const tasks = topLevel(allTasks(state)).filter((task) => {
    const at = effectiveAt(task);
    return isOpen(task) && at != null && at >= startOfDay(from) && at <= endOfDay(to);
  });
  return sortTasks(tasks, "due", now);
}
