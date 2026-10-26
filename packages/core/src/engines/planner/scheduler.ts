import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { PlanningPreferences } from "../../types/profile";
import type { Task } from "../../types/task";
import { MINUTE_MS, isSameDay } from "../date-utils";
import { selectPlanCandidates, slotKindForTask, type PlanCandidate } from "./candidates";
import type {
  PlanProposal,
  PlanSlot,
  PlanSummary,
  UnplannedTask,
} from "./types";
import { enumerateDayWindows, type DayWindow } from "./windows";

interface Interval {
  startsAt: Timestamp;
  endsAt: Timestamp;
  taskId: ID | null;
  blockId: ID | null;
}

function collectBusyIntervals(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  excludeBlockIds?: Set<ID>,
): Interval[] {
  const intervals: Interval[] = [];
  for (const event of Object.values(state.events)) {
    if (event.startsAt < to && event.endsAt > from) {
      intervals.push({
        startsAt: Math.max(event.startsAt, from),
        endsAt: Math.min(event.endsAt, to),
        taskId: null,
        blockId: null,
      });
    }
  }
  for (const block of Object.values(state.timeBlocks)) {
    if (excludeBlockIds?.has(block.id)) continue;
    if (block.startsAt < to && block.endsAt > from) {
      intervals.push({
        startsAt: Math.max(block.startsAt, from),
        endsAt: Math.min(block.endsAt, to),
        taskId: block.taskId,
        blockId: block.id,
      });
    }
  }
  return intervals.sort((a, b) => a.startsAt - b.startsAt);
}

export function isTimeAvailableExcluding(
  state: AppState,
  startsAt: Timestamp,
  endsAt: Timestamp,
  blockId: ID | null,
): boolean {
  const intervals = collectBusyIntervals(
    state,
    startsAt,
    endsAt,
    blockId ? new Set([blockId]) : undefined,
  );
  return intervals.every(
    (period) => period.endsAt <= startsAt || period.startsAt >= endsAt,
  );
}

interface DayPlanner {
  window: DayWindow;
  busy: Interval[];
  lastTaskId: ID | null;
  lastEndsAt: Timestamp | null;
}

function createDayPlanners(state: AppState, windows: DayWindow[], now: Timestamp): DayPlanner[] {
  return windows
    .filter((window) => window.to > now)
    .map((window) => ({
      window,
      busy: collectBusyIntervals(state, window.from, window.to),
      lastTaskId: null,
      lastEndsAt: null,
    }));
}

function firstFit(
  planner: DayPlanner,
  durationMin: number,
  now: Timestamp,
): Timestamp | null {
  let cursor = Math.max(planner.window.from, now);
  const durationMs = durationMin * MINUTE_MS;
  for (const period of planner.busy) {
    if (period.endsAt <= cursor) continue;
    if (period.startsAt > cursor && period.startsAt - cursor >= durationMs) {
      return cursor;
    }
    cursor = Math.max(cursor, period.endsAt);
  }
  if (cursor + durationMs <= planner.window.to) return cursor;
  return null;
}

function reserve(planner: DayPlanner, interval: Interval): void {
  const busy = [interval, ...planner.busy].sort((a, b) => a.startsAt - b.startsAt);
  const merged: Interval[] = [];
  for (const period of busy) {
    const last = merged[merged.length - 1];
    if (last && period.startsAt <= last.endsAt) {
      last.endsAt = Math.max(last.endsAt, period.endsAt);
      last.taskId = null;
      last.blockId = null;
    } else {
      merged.push({ ...period });
    }
  }
  planner.busy = merged;
  if (interval.taskId != null) {
    planner.lastTaskId = interval.taskId;
  }
  planner.lastEndsAt = Math.max(planner.lastEndsAt ?? 0, interval.endsAt);
}

export interface GeneratePlanOptions {
  prefs: PlanningPreferences;
  now?: Timestamp;
}

export function generatePlan(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  options: GeneratePlanOptions,
): PlanProposal {
  const prefs = options.prefs;
  const now = options.now ?? Date.now();

  if (!prefs.enabled) {
    return {
      id: `plan-${now}`,
      from,
      to,
      slots: [],
      plannedMin: 0,
      unplanned: [],
      generatedAt: now,
    };
  }

  const candidates = selectPlanCandidates(state, prefs, from, to, now);
  // A single-day plan is explicitly about that day, so it should still work on
  // a weekend even when the user's working days are Mon-Fri.
  const singleDay = isSameDay(from, Math.max(from, to - 1));
  const planners = createDayPlanners(
    state,
    enumerateDayWindows(prefs, from, to, { ignoreWorkDays: singleDay }),
    now,
  );
  const slots: PlanSlot[] = [];
  const unplanned: UnplannedTask[] = [];

  const world = {
    candidateIds: new Set(candidates.map((c) => c.task.id)),
    placedIds: new Set<ID>(),
  };

  for (const candidate of candidates) {
    const blockers = blockedReasons(state, candidate, world);
    if (blockers) {
      unplanned.push({
        taskId: candidate.task.id,
        title: candidate.task.title,
        estimateMin: candidate.estimateMin,
        reason: blockers,
      });
      continue;
    }
    const placed = placeCandidate(planners, candidate, prefs, now, slots.length);
    if (placed.length === 0) {
      unplanned.push({
        taskId: candidate.task.id,
        title: candidate.task.title,
        estimateMin: candidate.estimateMin,
        reason: "No free time in the planning window",
      });
      continue;
    }
    world.placedIds.add(candidate.task.id);
    slots.push(...placed);
  }

  const plannedMin = slots
    .filter((slot) => slot.kind !== "buffer")
    .reduce((sum, slot) => sum + (slot.endsAt - slot.startsAt) / MINUTE_MS, 0);

  return {
    id: `plan-${now}`,
    from,
    to,
    slots: slots.sort((a, b) => a.startsAt - b.startsAt),
    plannedMin,
    unplanned,
    generatedAt: now,
  };
}

function blockedReasons(
  state: AppState,
  candidate: PlanCandidate,
  world: { candidateIds: Set<ID>; placedIds: Set<ID> },
): string | null {
  const pending: string[] = [];
  for (const depId of candidate.task.dependsOn) {
    const dep = state.tasks[depId];
    if (!dep || !isOpenTask(dep)) continue;
    if (world.candidateIds.has(depId)) {
      if (!world.placedIds.has(depId)) pending.push(dep.title);
    } else {
      pending.push(dep.title);
    }
  }
  return pending.length > 0 ? `Waiting on: ${pending.join(", ")}` : null;
}

function isOpenTask(task: Task): boolean {
  return (
    task.status !== "done" &&
    task.status !== "cancelled" &&
    task.status !== "archived"
  );
}

function placeCandidate(
  planners: DayPlanner[],
  candidate: PlanCandidate,
  prefs: PlanningPreferences,
  now: Timestamp,
  slotCount: number,
): PlanSlot[] {
  const parts = splitEstimate(Math.max(10, candidate.estimateMin));
  const slots: PlanSlot[] = [];
  const salt = `${candidate.task.id}-${now}-${slotCount}`;

  for (const part of parts) {
    const placedPart = tryPlacePart(planners, candidate, prefs, now, part.durationMin, salt, slots);
    if (!placedPart) {
      return slots.length > 0 ? slots : [];
    }
  }
  return slots;
}

function tryPlacePart(
  planners: DayPlanner[],
  candidate: PlanCandidate,
  prefs: PlanningPreferences,
  now: Timestamp,
  durationMin: number,
  salt: string,
  slots: PlanSlot[],
): boolean {
  for (const planner of planners) {
    const needsBuffer =
      prefs.bufferMin > 0 &&
      planner.lastTaskId != null &&
      planner.lastTaskId !== candidate.task.id &&
      planner.lastEndsAt != null &&
      planner.lastEndsAt < planner.window.to;
    const extra = needsBuffer ? prefs.bufferMin : 0;
    const fitStart = firstFit(planner, durationMin + extra, now);
    if (fitStart == null) continue;

    let partStart = fitStart;
    if (needsBuffer) {
      const bufferEnd = fitStart + extra * MINUTE_MS;
      reserve(planner, {
        startsAt: fitStart,
        endsAt: bufferEnd,
        taskId: null,
        blockId: null,
      });
      slots.push({
        id: `buffer-${salt}-${slots.length}`,
        kind: "buffer",
        title: "Buffer",
        startsAt: fitStart,
        endsAt: bufferEnd,
        taskId: null,
        routineId: null,
        habitId: null,
        reason: "Recovery time between focus blocks",
        locked: false,
        blockId: null,
      });
      partStart = bufferEnd;
    }

    reserve(planner, {
      startsAt: partStart,
      endsAt: partStart + durationMin * MINUTE_MS,
      taskId: candidate.task.id,
      blockId: null,
    });
    slots.push({
      id: `slot-${salt}-${slots.length}`,
      kind: slotKindForTask(candidate.task),
      title: candidate.task.title,
      startsAt: partStart,
      endsAt: partStart + durationMin * MINUTE_MS,
      taskId: candidate.task.id,
      routineId: null,
      habitId: null,
      reason: candidate.reason,
      locked: false,
      blockId: null,
    });
    return true;
  }
  return false;
}

function splitEstimate(durationMin: number): Array<{ durationMin: number }> {
  const maxBlock = 180;
  if (durationMin <= maxBlock) return [{ durationMin }];
  const parts = Math.ceil(durationMin / maxBlock);
  const base = Math.floor(durationMin / parts);
  const result: Array<{ durationMin: number }> = [];
  let remaining = durationMin;
  for (let i = 0; i < parts; i++) {
    const part = i === parts - 1 ? remaining : base;
    result.push({ durationMin: part });
    remaining -= part;
  }
  return result;
}

export function summarizePlan(
  state: AppState,
  proposal: PlanProposal,
  prefs: PlanningPreferences,
): PlanSummary {
  const windows = enumerateDayWindows(prefs, proposal.from, proposal.to);
  const windowMin = windows.reduce((sum, win) => sum + (win.to - win.from) / MINUTE_MS, 0);
  const taskSlots = proposal.slots.filter((slot) => slot.kind === "task" || slot.kind === "routine" || slot.kind === "habit");
  const bufferSlots = proposal.slots.filter((slot) => slot.kind === "buffer").length;
  return {
    freeMin: Math.max(0, windowMin - totalBlockedMin(state, windows)),
    plannedMin: proposal.plannedMin,
    taskSlots: taskSlots.length,
    bufferSlots,
    unplanned: proposal.unplanned.length,
    windowLabel: windowLabel(proposal.from, proposal.to),
  };
}

function totalBlockedMin(state: AppState, windows: DayWindow[]): number {
  let total = 0;
  for (const window of windows) {
    const intervals = collectBusyIntervals(state, window.from, window.to);
    for (const period of intervals) total += period.endsAt - period.startsAt;
  }
  return total / MINUTE_MS;
}

function windowLabel(from: Timestamp, to: Timestamp): string {
  const fmt = (t: Timestamp) =>
    new Date(t).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  if (from === to) return fmt(from);
  return `${fmt(from)} \u2013 ${fmt(to)}`;
}