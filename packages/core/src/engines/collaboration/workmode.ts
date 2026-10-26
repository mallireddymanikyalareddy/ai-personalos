import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Shift, ShiftStatus } from "../../types/identity";
import type { ShiftPickup, ShiftSwap, TimeOffRequest } from "../../types/workmode";
import { startOfWeek } from "../date-utils";

const DAY = 86_400_000;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface EmployeeScheduleRow {
  memberId: ID;
  displayName: string;
  shifts: Array<{ id: ID; title: string; startsAt: Timestamp; endsAt: Timestamp; status: ShiftStatus }>;
  weekMinutes: number;
  shiftCount: number;
  timeOffHours: number;
  nextShiftAt: Timestamp | null;
}

export function buildEmployeeSchedule(
  state: AppState,
  memberId: ID,
  now: Timestamp = Date.now(),
): EmployeeScheduleRow | null {
  const member = state.members[memberId];
  if (!member) return null;
  const weekStart = startOfWeek(now, state.settings.weekStart);
  const weekEnd = weekStart + 7 * DAY;

  const shifts = Object.values(state.shifts)
    .filter((shift) => shift.memberId === memberId)
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((shift) => ({
      id: shift.id,
      title: shift.title,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      status: shift.status,
    }));

  const weekShifts = shifts.filter(
    (shift) => shift.startsAt >= weekStart && shift.startsAt < weekEnd,
  );

  const timeOffHours = Object.values(state.timeOffRequests)
    .filter((request) => request.memberId === memberId && request.status === "approved")
    .filter((request) => request.startsAt >= weekStart && request.startsAt < weekEnd)
    .reduce((sum, request) => sum + request.requestedHours, 0);

  return {
    memberId,
    displayName: member.displayName ?? "Unknown",
    shifts,
    weekMinutes: weekShifts.reduce((sum, shift) => sum + (shift.endsAt - shift.startsAt), 0) / 60000,
    shiftCount: weekShifts.length,
    timeOffHours,
    nextShiftAt: shifts.find((shift) => shift.startsAt >= now)?.startsAt ?? null,
  };
}

export interface ShiftValidation {
  ok: boolean;
  reason: string;
}

export function validateShift(
  state: AppState,
  memberId: ID,
  startsAt: Timestamp,
  endsAt: Timestamp,
  excludeShiftId: ID | null = null,
): ShiftValidation {
  if (endsAt <= startsAt) return { ok: false, reason: "The shift must end after it starts." };
  if (endsAt - startsAt > 16 * 3_600_000) return { ok: false, reason: "A shift cannot exceed 16 hours." };

  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = dayStart.getTime() + DAY;

  const approvedTimeOff = Object.values(state.timeOffRequests).filter(
    (request) =>
      request.memberId === memberId &&
      request.status === "approved" &&
      request.startsAt < dayEnd &&
      request.endsAt > dayStart.getTime(),
  );
  if (approvedTimeOff.length > 0) {
    return { ok: false, reason: "This member has approved time off covering that day." };
  }

  const conflicts = Object.values(state.shifts).filter(
    (shift) =>
      shift.id !== excludeShiftId &&
      shift.memberId === memberId &&
      shift.status !== "cancelled" &&
      shift.startsAt < endsAt &&
      shift.endsAt > startsAt,
  );
  if (conflicts.length > 0) {
    return { ok: false, reason: "This member already has a shift in that window." };
  }

  return { ok: true, reason: "" };
}

export interface SwapValidation extends ShiftValidation {
  targetMemberId?: ID;
}

export function validateShiftSwap(
  state: AppState,
  shiftId: ID,
  requesterId: ID,
  targetMemberId: ID | null,
): SwapValidation {
  const shift = state.shifts[shiftId];
  if (!shift) return { ok: false, reason: "That shift no longer exists." };
  if (shift.memberId !== requesterId) return { ok: false, reason: "Only the assigned member can swap this shift." };
  if (shift.startsAt < Date.now()) return { ok: false, reason: "This shift has already started." };

  const existing = Object.values(state.shiftSwaps).find(
    (swap) => swap.shiftId === shiftId && swap.status === "pending",
  );
  if (existing) return { ok: false, reason: "This shift already has a pending swap request." };

  if (targetMemberId == null) {
    return { ok: true, reason: "" };
  }

  if (targetMemberId === requesterId) return { ok: false, reason: "You cannot swap with yourself." };

  const target = state.shifts[shiftId];
  if (target && target.memberId === targetMemberId) {
    return { ok: false, reason: "That member is already assigned this shift." };
  }

  return validateShift(state, targetMemberId, shift.startsAt, shift.endsAt, shiftId);
}

export function validateShiftPickup(
  state: AppState,
  shiftId: ID,
  memberId: ID,
): ShiftValidation {
  const shift = state.shifts[shiftId];
  if (!shift) return { ok: false, reason: "That shift no longer exists." };
  if (shift.memberId === memberId) return { ok: false, reason: "You already have this shift." };

  const existing = Object.values(state.shiftPickups).find(
    (pickup) => pickup.shiftId === shiftId && pickup.memberId === memberId && pickup.status === "pending",
  );
  if (existing) return { ok: false, reason: "You already have a pending request for this shift." };

  return validateShift(state, memberId, shift.startsAt, shift.endsAt, shiftId);
}

export function validateTimeOff(
  state: AppState,
  memberId: ID,
  startsAt: Timestamp,
  endsAt: Timestamp,
  requestedHours: number,
): ShiftValidation {
  if (endsAt <= startsAt) return { ok: false, reason: "Time off must end after it starts." };
  if (requestedHours <= 0) return { ok: false, reason: "Requested hours must be greater than zero." };
  if (requestedHours > 500) return { ok: false, reason: "That request is larger than one working year." };
  if (endsAt < Date.now()) return { ok: false, reason: "You cannot request time off in the past." };

  const overlapping = Object.values(state.timeOffRequests).some(
    (request) =>
      request.memberId === memberId &&
      request.status === "pending" &&
      request.startsAt < endsAt &&
      request.endsAt > startsAt,
  );
  if (overlapping) return { ok: false, reason: "You already have a pending request in that range." };

  return { ok: true, reason: "" };
}

export function shiftMinutes(shift: Shift): number {
  return (shift.endsAt - shift.startsAt) / 60000;
}

export interface WeekCoverageRow {
  day: Timestamp;
  label: string;
  minutes: number;
  shifts: number;
  members: ID[];
}

export function buildWeekCoverage(state: AppState, now: Timestamp = Date.now()): WeekCoverageRow[] {
  const weekStart = startOfWeek(now, state.settings.weekStart);
  const rows: WeekCoverageRow[] = [];

  for (let index = 0; index < 7; index += 1) {
    const day = weekStart + index * DAY;
    const shifts = Object.values(state.shifts).filter(
      (shift) => shift.startsAt >= day && shift.startsAt < day + DAY,
    );
    rows.push({
      day,
      label: WEEKDAY_LABELS[index]!,
      minutes: Math.round(shifts.reduce((sum, shift) => sum + shiftMinutes(shift), 0)),
      shifts: shifts.length,
      members: [...new Set(shifts.map((shift) => shift.memberId))],
    });
  }

  return rows;
}

export interface OpenShiftRow {
  shift: Shift;
  memberName: string;
  pickups: number;
  canPickUp: boolean;
}

export function selectOpenShifts(state: AppState, now: Timestamp = Date.now()): OpenShiftRow[] {
  const pendingPickups = new Map<ID, number>();
  for (const pickup of Object.values(state.shiftPickups)) {
    if (pickup.status !== "pending") continue;
    pendingPickups.set(pickup.shiftId, (pendingPickups.get(pickup.shiftId) ?? 0) + 1);
  }

  return Object.values(state.shifts)
    .filter((shift) => shift.startsAt >= now)
    .filter((shift) => shift.status === "scheduled" || shift.status === "active")
    .map((shift) => ({
      shift,
      memberName: state.members[shift.memberId]?.displayName ?? "Unassigned",
      pickups: pendingPickups.get(shift.id) ?? 0,
      canPickUp: (pendingPickups.get(shift.id) ?? 0) === 0,
    }))
    .sort((a, b) => a.shift.startsAt - b.shift.startsAt);
}

export function pendingApprovals(state: AppState, approverId?: ID | null) {
  return Object.values(state.approvals)
    .filter((approval) => approval.status === "pending")
    .filter((approval) => approverId == null || approval.approverId === approverId)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
}

export interface TimeOffBalanceRow {
  memberId: ID;
  displayName: string;
  approvedHours: number;
  pendingHours: number;
}

export function buildTimeOffBalances(state: AppState, year: number): TimeOffBalanceRow[] {
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year + 1, 0, 1).getTime();

  const rows = new Map<ID, TimeOffBalanceRow>();
  for (const member of Object.values(state.members)) {
    rows.set(member.id, {
      memberId: member.id,
      displayName: member.displayName ?? "Unknown",
      approvedHours: 0,
      pendingHours: 0,
    });
  }

  for (const request of Object.values(state.timeOffRequests)) {
    const row = rows.get(request.memberId);
    if (!row) continue;
    if (request.startsAt >= yearStart && request.startsAt < yearEnd) {
      if (request.status === "approved") row.approvedHours += request.requestedHours;
      if (request.status === "pending") row.pendingHours += request.requestedHours;
    }
  }

  return [...rows.values()].sort((a, b) => b.approvedHours - a.approvedHours);
}

export function formatShiftRange(startsAt: Timestamp, endsAt: Timestamp): string {
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day.format(startsAt)} · ${time.format(startsAt)}–${time.format(endsAt)}`;
}

export function hoursBetween(startsAt: Timestamp, endsAt: Timestamp): number {
  return Math.round(((endsAt - startsAt) / 3_600_000) * 100) / 100;
}