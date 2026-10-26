import type { AppState } from "../../store/state";
import type { ID, Priority, Timestamp } from "../../types/common";
import type { PlanningPreferences } from "../../types/profile";
import type { Task } from "../../types/task";
import { startOfDay } from "../date-utils";
import { topoSort } from "../task/dependencies";
import { effectiveAt, isOpen, isOverdue, topLevel } from "../task/transitions";

export interface PlanCandidate {
  task: Task;
  estimateMin: number;
  priority: Priority;
  deadline: Timestamp | null;
  reason: string;
}

function priorityLabel(priority: Priority): string {
  switch (priority) {
    case 4:
      return "Urgent priority";
    case 3:
      return "High priority";
    case 2:
      return "Medium priority";
    default:
      return "";
  }
}

export function candidateReason(
  task: Task,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp,
): string {
  if (isOverdue(task, now)) return "Overdue";
  if (task.dueAt != null && task.dueAt <= to) {
    const diff = Math.ceil((task.dueAt - startOfDay(now)) / 86_400_000);
    if (diff === 0) return "Due today";
    if (diff === 1) return "Due tomorrow";
    return `Due ${new Date(task.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  const at = effectiveAt(task);
  if (at != null && at >= from && at <= to) return "In this window";
  const label = priorityLabel(task.priority);
  if (label) return label;
  if (task.goalIds.length > 0) return "Linked to a goal";
  return "Open";
}

function isPlacedInRange(
  state: AppState,
  taskId: ID,
  from: Timestamp,
  to: Timestamp,
): boolean {
  return Object.values(state.timeBlocks).some(
    (block) =>
      block.taskId === taskId && block.startsAt < to && block.endsAt > from,
  );
}

export function selectPlanCandidates(
  state: AppState,
  prefs: PlanningPreferences,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp,
): PlanCandidate[] {
  const tasks = topLevel(Object.values(state.tasks)).filter(isOpen);
  const candidates: PlanCandidate[] = [];

  for (const task of tasks) {
    if (isPlacedInRange(state, task.id, from, to)) continue;
    const inWindow =
      effectiveAt(task) != null && effectiveAt(task)! >= from && effectiveAt(task)! <= to;
    const pressured =
      isOverdue(task, now) ||
      (task.dueAt != null && task.dueAt <= to) ||
      (task.scheduledAt != null && task.scheduledAt >= from && task.scheduledAt <= to);
    const meaningful =
      task.priority >= 2 ||
      task.goalIds.length > 0 ||
      task.estimateMin != null ||
      task.routineId != null ||
      task.habitId != null;
    if (!(pressured || inWindow || meaningful)) continue;
    candidates.push({
      task,
      estimateMin: task.estimateMin ?? prefs.defaultEstimateMin,
      priority: task.priority,
      deadline: task.dueAt,
      reason: candidateReason(task, from, to, now),
    });
  }

  candidates.sort((a, b) => {
    const aOverdue = isOverdue(a.task, now) ? 0 : 1;
    const bOverdue = isOverdue(b.task, now) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const aDeadline = a.deadline ?? Number.POSITIVE_INFINITY;
    const bDeadline = b.deadline ?? Number.POSITIVE_INFINITY;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.estimateMin - a.estimateMin;
  });

  return topoSort(candidates.map((c) => c.task), state).flatMap((task) => {
    const candidate = candidates.find((c) => c.task.id === task.id);
    return candidate ? [candidate] : [];
  });
}

export function slotKindForTask(task: Task): "task" | "routine" | "habit" {
  if (task.routineId != null) return "routine";
  if (task.habitId != null) return "habit";
  return "task";
}