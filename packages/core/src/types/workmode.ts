import type { ID, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";

export type ShiftRequestType = "swap" | "pickup" | "release" | "time_off";

export type ShiftRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "approved"
  | "cancelled"
  | "expired";

export type TimeOffKind = "vacation" | "sick" | "personal" | "bereavement" | "unpaid";

export const TIME_OFF_KIND_LABELS: Record<TimeOffKind, string> = {
  vacation: "Vacation",
  sick: "Sick leave",
  personal: "Personal",
  bereavement: "Bereavement",
  unpaid: "Unpaid",
};

export interface ShiftSwap extends CanonicalEntity {
  type: "shift_swap";
  shiftId: ID;
  requesterId: ID;
  targetMemberId: ID | null;
  notes: string;
  requiresApproval: boolean;
  status: ShiftRequestStatus;
  respondedAt: Timestamp | null;
  responseNote: string;
}

export interface NewShiftSwapInput extends CanonicalInput {
  shiftId: ID;
  requesterId: ID;
  targetMemberId?: ID | null;
  notes?: string;
  requiresApproval?: boolean;
}

export function createShiftSwap(input: NewShiftSwapInput, now: Timestamp = Date.now()): ShiftSwap {
  return {
    ...createCanonicalBase(input, now),
    type: "shift_swap",
    shiftId: input.shiftId,
    requesterId: input.requesterId,
    targetMemberId: input.targetMemberId ?? null,
    notes: input.notes ?? "",
    requiresApproval: input.requiresApproval ?? true,
    status: "pending",
    respondedAt: null,
    responseNote: "",
  };
}

export interface ShiftPickup extends CanonicalEntity {
  type: "shift_pickup";
  shiftId: ID;
  memberId: ID;
  notes: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  respondedAt: Timestamp | null;
}

export interface NewShiftPickupInput extends CanonicalInput {
  shiftId: ID;
  memberId: ID;
  notes?: string;
}

export function createShiftPickup(input: NewShiftPickupInput, now: Timestamp = Date.now()): ShiftPickup {
  return {
    ...createCanonicalBase(input, now),
    type: "shift_pickup",
    shiftId: input.shiftId,
    memberId: input.memberId,
    notes: input.notes ?? "",
    status: "pending",
    respondedAt: null,
  };
}

export interface TimeOffRequest extends CanonicalEntity {
  type: "time_off";
  memberId: ID;
  kind: TimeOffKind;
  startsAt: Timestamp;
  endsAt: Timestamp;
  requestedHours: number;
  reason: string;
  status: ShiftRequestStatus;
  approverId: ID | null;
  decidedAt: Timestamp | null;
  decisionNote: string;
  balanceHoursAfter: number | null;
}

export interface NewTimeOffInput extends CanonicalInput {
  memberId: ID;
  kind: TimeOffKind;
  startsAt: Timestamp;
  endsAt: Timestamp;
  requestedHours: number;
  reason?: string;
}

export function createTimeOffRequest(input: NewTimeOffInput, now: Timestamp = Date.now()): TimeOffRequest {
  return {
    ...createCanonicalBase(input, now),
    type: "time_off",
    memberId: input.memberId,
    kind: input.kind,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    requestedHours: input.requestedHours,
    reason: input.reason ?? "",
    status: "pending",
    approverId: null,
    decidedAt: null,
    decisionNote: "",
    balanceHoursAfter: null,
  };
}

export interface MemberAvailability {
  memberId: ID;
  displayName: string;
  role: string;
  scheduledMinutes: number;
  shiftCount: number;
  timeOffHours: number;
  pendingSwaps: number;
  pendingPickups: number;
  nextShiftAt: Timestamp | null;
}

export interface ShiftCoverage {
  day: Timestamp;
  scheduledMinutes: number;
  requiredMinutes: number;
  gap: number;
  understaffed: boolean;
  members: ID[];
}

export type WeekDayCoverage = {
  weekday: number;
  label: string;
  minutes: number;
  shifts: number;
};

export const WEEKDAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface EmployeeSchedule {
  memberId: ID;
  shifts: Array<{ id: ID; title: string; startsAt: Timestamp; endsAt: Timestamp; status: string }>;
  totalMinutes: number;
  weekMinutes: number;
  timeOffHours: number;
}
