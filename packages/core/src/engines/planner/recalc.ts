import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { PlanningPreferences } from "../../types/profile";
import { MINUTE_MS } from "../date-utils";
import { generatePlan } from "./scheduler";
import type {
  PlanProposal,
  PlanSlot,
  PlannerConflict,
  UnplannedTask,
} from "./types";
import { enumerateDayWindows } from "./windows";

interface Interval {
  startsAt: Timestamp;
  endsAt: Timestamp;
}

export function findPlanConflicts(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): PlannerConflict[] {
  const conflicts: PlannerConflict[] = [];
  const blocks = Object.values(state.timeBlocks).filter(
    (block) => block.startsAt < to && block.endsAt > from,
  );

  for (const block of blocks) {
    const eventOverlap = Object.values(state.events).some(
      (event) => event.startsAt < block.endsAt && event.endsAt > block.startsAt,
    );
    if (eventOverlap) {
      conflicts.push({
        blockId: block.id,
        title: block.title,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        reason: "Overlaps a calendar event",
      });
      continue;
    }
    const otherOverlap = blocks.some(
      (other) =>
        other.id !== block.id &&
        other.startsAt < block.endsAt &&
        other.endsAt > block.startsAt,
    );
    if (otherOverlap) {
      conflicts.push({
        blockId: block.id,
        title: block.title,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        reason: "Overlaps another time block",
      });
    }
  }

  return conflicts.sort((a, b) => a.startsAt - b.startsAt);
}

export function recalculatePlan(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  prefs: PlanningPreferences,
  now: Timestamp = Date.now(),
): PlanProposal {
  if (!prefs.enabled) {
    return {
      id: `recalc-${now}`,
      from,
      to,
      slots: [],
      plannedMin: 0,
      unplanned: [],
      generatedAt: now,
    };
  }

  const conflicts = findPlanConflicts(state, from, to);
  const movableIds = new Set(
    conflicts
      .filter((conflict) => state.timeBlocks[conflict.blockId]?.source === "ai")
      .map((conflict) => conflict.blockId),
  );

  const moved: PlanSlot[] = [];
  const unplanned: UnplannedTask[] = [];
  const movedTasks = new Set<ID>();
  const movedIntervals: Array<Interval & { blockId: ID }> = [];

  for (const conflict of conflicts) {
    const block = state.timeBlocks[conflict.blockId];
    if (!block || !movableIds.has(block.id)) continue;
    if (
      block.taskId != null &&
      (movedTasks.has(block.taskId) ||
        Object.values(state.timeBlocks).some(
          (other) =>
            other.id !== block.id &&
            other.taskId === block.taskId &&
            !movableIds.has(other.id),
        ))
    ) {
      continue;
    }

    const durationMin = (block.endsAt - block.startsAt) / MINUTE_MS;
    const target = findRelocationSlot(
      state,
      from,
      to,
      prefs,
      durationMin,
      now,
      movableIds,
      movedIntervals,
    );
    if (!target) {
      unplanned.push({
        taskId: block.taskId ?? block.id,
        title: block.title,
        estimateMin: durationMin,
        reason: "No free space after the schedule change",
      });
      continue;
    }
    movedIntervals.push({ blockId: block.id, startsAt: target.startsAt, endsAt: target.endsAt });
    if (block.taskId != null) movedTasks.add(block.taskId);
    moved.push({
      id: `move-${block.id}-${now}`,
      kind: blockKindFromBlock(block.kind),
      title: block.title,
      startsAt: target.startsAt,
      endsAt: target.endsAt,
      taskId: block.taskId,
      routineId: null,
      habitId: null,
      reason: "Rescheduled after a schedule change",
      locked: false,
      blockId: block.id,
    });
  }

  const virtual = buildVirtualState(state, movableIds, movedIntervals);
  const generated = generatePlan(virtual, from, to, { prefs, now });

  const slots = [...moved, ...generated.slots].sort((a, b) => a.startsAt - b.startsAt);
  const plannedMin = slots
    .filter((slot) => slot.kind !== "buffer")
    .reduce((sum, slot) => sum + (slot.endsAt - slot.startsAt) / MINUTE_MS, 0);

  return {
    id: `recalc-${now}`,
    from,
    to,
    slots,
    plannedMin,
    unplanned: [...unplanned, ...generated.unplanned],
    generatedAt: now,
  };
}

function buildVirtualState(
  state: AppState,
  movableIds: Set<ID>,
  movedIntervals: Array<Interval & { blockId: ID }>,
): AppState {
  const kept: Record<ID, (typeof state.timeBlocks)[ID]> = {};
  for (const [id, block] of Object.entries(state.timeBlocks)) {
    if (movableIds.has(id)) continue;
    kept[id] = block;
  }
  for (const entry of movedIntervals) {
    const original = state.timeBlocks[entry.blockId];
    if (!original) continue;
    kept[entry.blockId] = {
      ...original,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
    };
  }
  return { ...state, timeBlocks: kept };
}

function findRelocationSlot(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  prefs: PlanningPreferences,
  durationMin: number,
  now: Timestamp,
  movableIds: Set<ID>,
  movedIntervals: Array<Interval & { blockId: ID }>,
): { startsAt: Timestamp; endsAt: Timestamp } | null {
  const durationMs = durationMin * MINUTE_MS;
  for (const window of enumerateDayWindows(prefs, from, to)) {
    if (window.to <= now) continue;
    let cursor = Math.max(window.from, now);

    const busy: Interval[] = [];
    for (const event of Object.values(state.events)) {
      if (event.startsAt < window.to && event.endsAt > window.from) {
        busy.push({
          startsAt: Math.max(event.startsAt, window.from),
          endsAt: Math.min(event.endsAt, window.to),
        });
      }
    }
    for (const block of Object.values(state.timeBlocks)) {
      if (movableIds.has(block.id) && !movedIntervals.some((entry) => entry.blockId === block.id)) {
        continue;
      }
      if (block.startsAt < window.to && block.endsAt > window.from) {
        busy.push({
          startsAt: Math.max(block.startsAt, window.from),
          endsAt: Math.min(block.endsAt, window.to),
        });
      }
    }
    for (const entry of movedIntervals) {
      if (entry.startsAt < window.to && entry.endsAt > window.from) {
        busy.push({
          startsAt: Math.max(entry.startsAt, window.from),
          endsAt: Math.min(entry.endsAt, window.to),
        });
      }
    }
    busy.sort((a, b) => a.startsAt - b.startsAt);

    for (const period of busy) {
      if (period.endsAt <= cursor) continue;
      if (period.startsAt > cursor && period.startsAt - cursor >= durationMs) {
        return { startsAt: cursor, endsAt: cursor + durationMs };
      }
      cursor = Math.max(cursor, period.endsAt);
    }
    if (cursor + durationMs <= window.to) {
      return { startsAt: cursor, endsAt: cursor + durationMs };
    }
  }
  return null;
}

function blockKindFromBlock(kind: string): PlanSlot["kind"] {
  switch (kind) {
    case "routine":
      return "routine";
    case "buffer":
      return "buffer";
    case "personal":
      return "personal";
    default:
      return "task";
  }
}