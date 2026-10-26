import type { ID, Timestamp } from "../../types/common";

export type PlanSlotKind = "task" | "routine" | "habit" | "buffer" | "personal";

export interface PlanSlot {
  id: string;
  kind: PlanSlotKind;
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  taskId: ID | null;
  routineId: ID | null;
  habitId: ID | null;
  reason: string | null;
  locked: boolean;
  blockId: ID | null;
}

export interface UnplannedTask {
  taskId: ID;
  title: string;
  estimateMin: number | null;
  reason: string;
}

export interface PlanProposal {
  id: string;
  from: Timestamp;
  to: Timestamp;
  slots: PlanSlot[];
  plannedMin: number;
  unplanned: UnplannedTask[];
  generatedAt: Timestamp;
}

export type PlanChangeAction = "add" | "move";

export interface PlanChange {
  action: PlanChangeAction;
  slot: PlanSlot;
  blockId: ID | null;
  taskId: ID | null;
}

export interface PlanRejection {
  taskId: ID | null;
  blockId: ID | null;
  title: string | null;
  reason: string;
}

export interface PlanDiff {
  changes: PlanChange[];
  rejected: PlanRejection[];
}

export interface ApplyPlanResult {
  applied: number;
  rejected: PlanRejection[];
  createdBlockIds: ID[];
  movedBlockIds: ID[];
  updatedTaskIds: ID[];
}

export interface PlannerConflict {
  blockId: ID;
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  reason: string;
}

export interface PlanSummary {
  freeMin: number;
  plannedMin: number;
  taskSlots: number;
  bufferSlots: number;
  unplanned: number;
  windowLabel: string;
}