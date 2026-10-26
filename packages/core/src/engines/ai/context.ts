import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import { aiActor, canUserRead, userActor } from "./access";
import { nowWindow } from "./access";
import type { AIContextBundle } from "./types";

function countOpenTasks(tasks: readonly Task[]): number {
  let count = 0;
  for (const task of tasks) {
    if (
      task.status === "open" ||
      task.status === "in_progress" ||
      task.status === "inbox" ||
      task.status === "review"
    ) count += 1;
  }
  return count;
}

function countOverdue(tasks: readonly Task[], now: Timestamp): number {
  let count = 0;
  for (const task of tasks) {
    const isOpen = task.status === "open" || task.status === "in_progress" || task.status === "review";
    if (isOpen && task.dueAt != null && task.dueAt < now) count += 1;
  }
  return count;
}

function countDueBetween(tasks: readonly Task[], from: Timestamp, to: Timestamp): number {
  let count = 0;
  for (const task of tasks) {
    const isOpen = task.status !== "done" && task.status !== "cancelled" && task.status !== "archived";
    if (isOpen && task.dueAt != null && task.dueAt >= from && task.dueAt < to) count += 1;
  }
  return count;
}

function countActive(collection: readonly { archived?: boolean; status?: string }[]): number {
  let count = 0;
  for (const item of collection) {
    if (item.archived === true) continue;
    if (item.status === "archived" || item.status === "trashed") continue;
    count += 1;
  }
  return count;
}

function countEventsBetween(
  events: readonly { startsAt: Timestamp }[],
  from: Timestamp,
  to: Timestamp,
): number {
  let count = 0;
  for (const event of events) {
    if (event.startsAt >= from && event.startsAt < to) count += 1;
  }
  return count;
}

function readableItems<T>(state: AppState, items: Record<string, T>): T[] {
  return Object.values(items).filter((item) =>
    canUserRead(state, item as { ownerId?: string | null }),
  );
}

export function buildAIContext(state: AppState, now: Timestamp = Date.now()): AIContextBundle {
  const actor = userActor();

  const ownedCounts: Record<string, number> = {};
  let authorized = 0;
  let denied = 0;

  const sources: Array<[string, Record<string, unknown>]> = [
    ["tasks", state.tasks as unknown as Record<string, unknown>],
    ["events", state.events as unknown as Record<string, unknown>],
    ["notes", state.notes as unknown as Record<string, unknown>],
    ["goals", state.goals as unknown as Record<string, unknown>],
    ["habits", state.habits as unknown as Record<string, unknown>],
    ["meetings", state.meetings as unknown as Record<string, unknown>],
    ["transcripts", state.transcripts as unknown as Record<string, unknown>],
    ["recordings", state.recordings as unknown as Record<string, unknown>],
    ["projects", state.projects as unknown as Record<string, unknown>],
    ["journalEntries", state.journalEntries as unknown as Record<string, unknown>],
    ["lifeMemories", state.lifeMemories as unknown as Record<string, unknown>],
    ["pages", state.pages as unknown as Record<string, unknown>],
    ["documents", state.documents as unknown as Record<string, unknown>],
  ];

  const authorizedIds: string[] = [];
  for (const [name, items] of sources) {
    let owned = 0;
    for (const item of Object.values(items)) {
      const entity = item as { id?: string; ownerId?: string | null };
      if (!entity.id) continue;
      if (canUserRead(state, { ownerId: entity.ownerId })) {
        authorized += 1;
        owned += 1;
        authorizedIds.push(entity.id);
      } else {
        denied += 1;
      }
    }
    ownedCounts[name] = owned;
  }

  const windows = nowWindow(now);
  const readableTasks = readableItems(state, state.tasks);
  const readableEvents = readableItems(state, state.events);
  const readableMeetings = readableItems(state, state.meetings);
  const readableGoals = readableItems(state, state.goals);
  const readableHabits = readableItems(state, state.habits);
  const readableNotes = readableItems(state, state.notes);

  const bundle: AIContextBundle = {
    now,
    actor,
    counts: {
      openTasks: countOpenTasks(readableTasks),
      overdueTasks: countOverdue(readableTasks, now),
      todayTasks: countDueBetween(readableTasks, windows.today.from, windows.today.to),
      activeGoals: readableGoals.filter((goal) => goal.status === "active").length,
      activeHabits: countActive(readableHabits),
      notes: readableNotes.filter((note) => note.status === "active").length,
      todayEvents: countEventsBetween(readableEvents, windows.today.from, windows.today.to),
      todayMeetings: countEventsBetween(readableMeetings, windows.today.from, windows.today.to),
      trashedNotes: readableNotes.filter((note) => note.status === "trashed").length,
    },
    authorizedIds,
    authorizedTypes: ownedCounts,
    windows,
    access: {
      tasks: ownedCounts.tasks > 0 || state.tasks !== undefined,
      calendar: ownedCounts.events > 0 || state.events !== undefined,
      goals: ownedCounts.goals > 0 || state.goals !== undefined,
      habits: ownedCounts.habits > 0 || state.habits !== undefined,
      notes: ownedCounts.notes > 0 || state.notes !== undefined,
      meetings: ownedCounts.meetings > 0 || state.meetings !== undefined,
      lifeMemory: ownedCounts.lifeMemories > 0 || state.lifeMemories !== undefined,
      preferences: state.profile !== undefined,
    },
    deniedCount: denied,
  };

  void aiActor;
  return bundle;
}

export function contextSummary(bundle: AIContextBundle): string {
  const c = bundle.counts;
  const parts = [
    `${c.openTasks} open task${c.openTasks === 1 ? "" : "s"}`,
    `${c.overdueTasks} overdue`,
    `${c.todayTasks} due today`,
    `${c.activeGoals} active goal${c.activeGoals === 1 ? "" : "s"}`,
    `${c.activeHabits} active habit${c.activeHabits === 1 ? "" : "s"}`,
    `${c.notes} note${c.notes === 1 ? "" : "s"}`,
  ];
  return parts.join(" · ");
}
