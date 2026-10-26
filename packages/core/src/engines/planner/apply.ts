import type { AppState } from "../../store/state";
import type { ID } from "../../types/common";
import type { Task } from "../../types/task";
import type { TimeBlock, TimeBlockKind, TimeBlockSource } from "../../types/time-block";
import { isTimeAvailableExcluding } from "./scheduler";
import type { ApplyPlanResult, PlanChange, PlanDiff } from "./types";

export interface PlanApplyStore {
  addTimeBlock(input: {
    title: string;
    startsAt: number;
    endsAt: number;
    kind?: TimeBlockKind;
    taskId?: ID | null;
    source?: TimeBlockSource;
  }): TimeBlock;
  updateTimeBlock(id: ID, patch: Partial<TimeBlock>): TimeBlock | null;
  updateTask(id: ID, patch: Partial<Task>): Task | null;
  getState(): AppState;
}

export function blockKindForSlot(kind: PlanChange["slot"]["kind"]): TimeBlockKind {
  switch (kind) {
    case "routine":
    case "habit":
      return "routine";
    case "buffer":
      return "buffer";
    case "personal":
      return "personal";
    default:
      return "focus";
  }
}

export function applyPlan(
  store: PlanApplyStore,
  diff: PlanDiff,
): ApplyPlanResult {
  const result: ApplyPlanResult = {
    applied: 0,
    rejected: [],
    createdBlockIds: [],
    movedBlockIds: [],
    updatedTaskIds: [],
  };

  for (const change of diff.changes) {
    applyChange(store, change, result);
  }

  return result;
}

function applyChange(
  store: PlanApplyStore,
  change: PlanChange,
  result: ApplyPlanResult,
): void {
  const slot = change.slot;
  const state = store.getState();

  if (change.action === "move") {
    const block = state.timeBlocks[slot.blockId ?? ""];
    if (!block || !isTimeAvailableExcluding(state, slot.startsAt, slot.endsAt, block.id)) {
      result.rejected.push({
        taskId: slot.taskId,
        blockId: slot.blockId,
        title: slot.title,
        reason: "Time is no longer available",
      });
      return;
    }
    const updated = store.updateTimeBlock(block.id, {
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
    if (!updated) {
      result.rejected.push({
        taskId: slot.taskId,
        blockId: slot.blockId,
        title: slot.title,
        reason: "This block was removed while applying",
      });
      return;
    }
    result.applied += 1;
    result.movedBlockIds.push(block.id);
    if (slot.taskId != null) {
      store.updateTask(slot.taskId, { scheduledAt: slot.startsAt });
      result.updatedTaskIds.push(slot.taskId);
    }
    return;
  }

  if (slot.kind === "buffer") {
    if (!isTimeAvailableExcluding(state, slot.startsAt, slot.endsAt, null)) {
      result.rejected.push({
        taskId: null,
        blockId: null,
        title: "Buffer",
        reason: "Time is no longer available",
      });
      return;
    }
    const block = store.addTimeBlock({
      title: slot.title,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      kind: "buffer",
      source: "ai",
    });
    result.applied += 1;
    result.createdBlockIds.push(block.id);
    return;
  }

  if (!isTimeAvailableExcluding(state, slot.startsAt, slot.endsAt, slot.blockId)) {
    result.rejected.push({
      taskId: slot.taskId,
      blockId: slot.blockId,
      title: slot.title,
      reason: "Time is no longer available",
    });
    return;
  }
  const block = store.addTimeBlock({
    title: slot.title,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    kind: blockKindForSlot(slot.kind),
    taskId: slot.taskId,
    source: "ai",
  });
  result.applied += 1;
  result.createdBlockIds.push(block.id);
  if (slot.taskId != null) {
    store.updateTask(slot.taskId, { scheduledAt: slot.startsAt });
    result.updatedTaskIds.push(slot.taskId);
  }
}