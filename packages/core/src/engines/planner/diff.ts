import type { AppState } from "../../store/state";
import { MINUTE_MS } from "../date-utils";
import { isTimeAvailableExcluding } from "./scheduler";
import type { PlanChange, PlanDiff, PlanProposal, PlanSlot } from "./types";

interface ReservedInterval {
  startsAt: number;
  endsAt: number;
}

function intervalAvailable(
  state: AppState,
  slot: PlanSlot,
  blockId: string | null,
  reserved: ReservedInterval[],
): boolean {
  const busy = reserved.some(
    (period) => period.startsAt < slot.endsAt && period.endsAt > slot.startsAt,
  );
  if (busy) return false;
  return isTimeAvailableExcluding(state, slot.startsAt, slot.endsAt, blockId);
}

export function diffPlan(state: AppState, proposal: PlanProposal): PlanDiff {
  const changes: PlanChange[] = [];
  const rejected: PlanDiff["rejected"] = [];
  const reserved: ReservedInterval[] = [];

  for (const slot of proposal.slots) {
    const blockId = slot.blockId ?? null;

    if (slot.kind === "buffer" && blockId == null) {
      if (intervalAvailable(state, slot, null, reserved)) {
        reserved.push({ startsAt: slot.startsAt, endsAt: slot.endsAt });
        changes.push({ action: "add", slot, blockId: null, taskId: null });
      } else {
        rejected.push({
          taskId: null,
          blockId: null,
          title: "Buffer",
          reason: "Time is no longer available",
        });
      }
      continue;
    }

    if (blockId != null) {
      const existing = state.timeBlocks[blockId];
      if (!existing) {
        rejected.push({
          taskId: slot.taskId,
          blockId,
          title: slot.title,
          reason: "This block was removed while planning",
        });
        continue;
      }
      if (!intervalAvailable(state, slot, blockId, reserved)) {
        rejected.push({
          taskId: slot.taskId,
          blockId,
          title: slot.title,
          reason: "Time is no longer available",
        });
        continue;
      }
      reserved.push({ startsAt: slot.startsAt, endsAt: slot.endsAt });
      changes.push({ action: "move", slot, blockId, taskId: slot.taskId });
      continue;
    }

    const alreadyPlanned = Object.values(state.timeBlocks).some(
      (block) =>
        block.taskId === slot.taskId &&
        block.startsAt < slot.endsAt &&
        block.endsAt > slot.startsAt,
    );
    if (alreadyPlanned) {
      rejected.push({
        taskId: slot.taskId,
        blockId: null,
        title: slot.title,
        reason: "Already scheduled in this window",
      });
      continue;
    }
    if (!intervalAvailable(state, slot, null, reserved)) {
      rejected.push({
        taskId: slot.taskId,
        blockId: null,
        title: slot.title,
        reason: "Time is no longer available",
      });
      continue;
    }
    reserved.push({ startsAt: slot.startsAt, endsAt: slot.endsAt });
    changes.push({ action: "add", slot, blockId: null, taskId: slot.taskId });
  }

  return { changes, rejected };
}

export function proposalDurationMin(slot: PlanSlot): number {
  return (slot.endsAt - slot.startsAt) / MINUTE_MS;
}