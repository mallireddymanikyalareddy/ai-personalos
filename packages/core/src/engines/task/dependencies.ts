import type { AppState } from "../../store/state";
import type { ID } from "../../types/common";
import type { Task } from "../../types/task";
import { isOpen } from "./transitions";

export function dependenciesFor(state: AppState, taskId: ID): Task[] {
  const task = state.tasks[taskId];
  if (!task) return [];
  return task.dependsOn
    .map((id) => state.tasks[id])
    .filter((t): t is Task => t != null);
}

export function allDependencies(state: AppState, taskId: ID): Task[] {
  const result: Task[] = [];
  const visited = new Set<ID>();
  const root = state.tasks[taskId];
  if (!root) return result;
  const queue = [...root.dependsOn];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const task = state.tasks[id];
    if (!task) continue;
    result.push(task);
    queue.push(...task.dependsOn);
  }
  return result;
}

export function blockersOf(state: AppState, taskId: ID): Task[] {
  return Object.values(state.tasks).filter((task) =>
    task.dependsOn.includes(taskId),
  );
}

export function isBlocked(task: Task, state: AppState): boolean {
  return task.dependsOn.some((id) => {
    const dep = state.tasks[id];
    return dep != null && isOpen(dep);
  });
}

export function blockingReason(task: Task, state: AppState): string | null {
  if (!isBlocked(task, state)) return null;
  const open = task.dependsOn
    .map((id) => state.tasks[id])
    .filter((t): t is Task => t != null && isOpen(t));
  if (open.length === 0) return null;
  return `Blocked by: ${open.map((t) => t.title).join(", ")}`;
}

export function wouldCreateCycle(
  state: AppState,
  taskId: ID,
  newDeps: ID[],
): boolean {
  const visited = new Set<ID>();
  const queue = [...newDeps];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === taskId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    const task = state.tasks[id];
    if (task) queue.push(...task.dependsOn);
  }
  return false;
}

export function topoSort(tasks: Task[], state: AppState): Task[] {
  const taskIds = new Set(tasks.map((t) => t.id));
  const sorted: Task[] = [];
  const visited = new Set<ID>();
  const inProgress = new Set<ID>();

  const visit = (task: Task): void => {
    if (visited.has(task.id)) return;
    if (inProgress.has(task.id)) return;
    inProgress.add(task.id);
    for (const depId of task.dependsOn) {
      if (!taskIds.has(depId)) continue;
      const dep = state.tasks[depId];
      if (dep && taskIds.has(dep.id)) visit(dep);
    }
    inProgress.delete(task.id);
    visited.add(task.id);
    sorted.push(task);
  };

  for (const task of tasks) visit(task);
  return sorted;
}

export function dependencyChain(state: AppState, taskId: ID): Task[] {
  const chain: Task[] = [];
  const visited = new Set<ID>();
  const queue = [taskId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const task = state.tasks[id];
    if (!task) continue;
    chain.push(task);
    for (const depId of task.dependsOn) {
      if (!visited.has(depId)) queue.push(depId);
    }
  }
  return chain;
}
