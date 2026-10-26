import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  buildEmployeeSchedule,
  buildTimeOffBalances,
  buildWeekCoverage,
  formatShiftRange,
  hoursBetween,
  selectOpenShifts,
} from "./workmode";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const DAY = 86_400_000;
const NEXT_MONDAY = (() => {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  return date;
})();
const MONDAY = NEXT_MONDAY.getTime();
const YEAR = NEXT_MONDAY.getFullYear();

function seedMembers(os: PersonalOS) {
  const me = os.addMember({ userId: "user_local", role: "member", displayName: "Ada" });
  const other = os.addMember({ userId: "user_ada", role: "member", displayName: "Grace" });
  return { me, other };
}

describe("Work Mode: shift scheduling", () => {
  it("schedules a shift for a member", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    const shift = os.addShift({ memberId: me.id, startsAt: MONDAY, endsAt: MONDAY + 8 * 3_600_000, title: "Morning" });

    expect(shift.status).toBe("scheduled");
    expect(os.shifts(me.id)).toHaveLength(1);
  });

  it("rejects overlapping shifts for the same member", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    os.addShift({ memberId: me.id, startsAt: MONDAY, endsAt: MONDAY + 8 * 3_600_000 });

    const verdict = os.checkShift(me.id, MONDAY + 4 * 3_600_000, MONDAY + 10 * 3_600_000);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/already has a shift/i);
  });

  it("allows the same window for different members", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    os.addShift({ memberId: me.id, startsAt: MONDAY, endsAt: MONDAY + 8 * 3_600_000 });

    expect(os.checkShift(other.id, MONDAY, MONDAY + 8 * 3_600_000).ok).toBe(true);
  });

  it("rejects a shift that overlaps approved time off", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    os.requestTimeOff({
      memberId: me.id,
      kind: "vacation",
      startsAt: MONDAY,
      endsAt: MONDAY + 5 * DAY,
      requestedHours: 40,
    });
    os.decideTimeOff(
      os.timeOffRequests(me.id)[0]!.id,
      true,
      me.id,
    );

    const verdict = os.checkShift(me.id, MONDAY + 2 * DAY, MONDAY + 2 * DAY + 8 * 3_600_000);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/time off/i);
  });

  it("rejects shifts that end before they start or overrun 16 hours", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    expect(os.checkShift(me.id, MONDAY + 8 * 3_600_000, MONDAY).reason).toMatch(/must end after/i);
    expect(os.checkShift(me.id, MONDAY, MONDAY + 20 * 3_600_000).reason).toMatch(/16 hours/i);
  });
});

describe("Work Mode: swap, release, pickup", () => {
  it("releases a shift and offers it for pickup", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    const shift = os.addShift({ memberId: me.id, startsAt: MONDAY + DAY, endsAt: MONDAY + DAY + 8 * 3_600_000 });

    os.releaseShift(shift.id);
    expect(os.shifts()[0]!.status).toBe("cancelled");

    const verdict = os.requestShiftPickup({ shiftId: shift.id, memberId: other.id }, MONDAY);
    expect(verdict.ok).toBe(true);

    os.respondShiftPickup(os.getState().shiftPickups[Object.keys(os.getState().shiftPickups)[0]!]!.id, true);
    expect(os.shifts()[0]!.memberId).toBe(other.id);
  });

  it("validates a swap target and reassigns on accept", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    const shift = os.addShift({ memberId: me.id, startsAt: MONDAY + DAY, endsAt: MONDAY + DAY + 8 * 3_600_000 });

    os.requestShiftSwap({ shiftId: shift.id, requesterId: me.id, targetMemberId: other.id }, MONDAY);
    const swap = os.shiftSwaps()[0]!;
    os.respondShiftSwap(swap.id, true);

    expect(os.shifts()[0]!.memberId).toBe(other.id);
    expect(os.getState().shiftSwaps[swap.id]!.status).toBe("accepted");
  });

  it("rejects a swap with yourself", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    const shift = os.addShift({ memberId: me.id, startsAt: MONDAY + DAY, endsAt: MONDAY + DAY + 8 * 3_600_000 });

    const verdict = os.requestShiftSwap({ shiftId: shift.id, requesterId: me.id, targetMemberId: me.id }, MONDAY);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/yourself/i);
  });

  it("rejects a second pending swap for the same shift", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    const shift = os.addShift({ memberId: me.id, startsAt: MONDAY + DAY, endsAt: MONDAY + DAY + 8 * 3_600_000 });

    expect(os.requestShiftSwap({ shiftId: shift.id, requesterId: me.id }, MONDAY).ok).toBe(true);
    expect(os.requestShiftSwap({ shiftId: shift.id, requesterId: me.id }, MONDAY + 1).ok).toBe(false);
  });

  it("only the assigned member can swap", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    const shift = os.addShift({ memberId: me.id, startsAt: MONDAY + DAY, endsAt: MONDAY + DAY + 8 * 3_600_000 });

    const verdict = os.requestShiftSwap({ shiftId: shift.id, requesterId: other.id }, MONDAY);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/assigned member/i);
  });

  it("lists open shifts with pending pickup counts", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    const shift = os.addShift({ memberId: me.id, startsAt: MONDAY + DAY, endsAt: MONDAY + DAY + 8 * 3_600_000 });

    os.requestShiftPickup({ shiftId: shift.id, memberId: other.id }, MONDAY);
    const open = os.openShifts(MONDAY);
    expect(open[0]!.pickups).toBe(1);
    expect(open[0]!.canPickUp).toBe(false);
  });
});

describe("Work Mode: time off and approvals", () => {
  it("requests and approves time off", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);

    const verdict = os.requestTimeOff({
      memberId: me.id,
      kind: "vacation",
      startsAt: MONDAY + 7 * DAY,
      endsAt: MONDAY + 14 * DAY,
      requestedHours: 80,
    });
    expect(verdict.ok).toBe(true);

    const request = os.timeOffRequests()[0]!;
    expect(request.status).toBe("pending");

    const decided = os.decideTimeOff(request.id, true, other.id, "Enjoy")!;
    expect(decided.status).toBe("approved");
    expect(decided.approverId).toBe(other.id);
    expect(decided.decidedAt).not.toBeNull();
  });

  it("refuses overlapping pending time off", () => {
    const os = makeOS();
    const { me } = seedMembers(os);

    os.requestTimeOff({ memberId: me.id, kind: "sick", startsAt: MONDAY + DAY, endsAt: MONDAY + 3 * DAY, requestedHours: 24 });
    const verdict = os.requestTimeOff({ memberId: me.id, kind: "sick", startsAt: MONDAY + 2 * DAY, endsAt: MONDAY + 4 * DAY, requestedHours: 24 });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/pending request/i);
  });

  it("cannot approve the same request twice", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    os.requestTimeOff({ memberId: me.id, kind: "sick", startsAt: MONDAY + DAY, endsAt: MONDAY + 2 * DAY, requestedHours: 16 });
    const id = os.timeOffRequests()[0]!.id;

    os.decideTimeOff(id, true, other.id);
    expect(os.decideTimeOff(id, false, other.id)).toBeNull();
  });

  it("balances approved and pending hours per year", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    os.requestTimeOff({ memberId: me.id, kind: "vacation", startsAt: MONDAY + DAY, endsAt: MONDAY + 3 * DAY, requestedHours: 24 });
    os.requestTimeOff({ memberId: other.id, kind: "sick", startsAt: MONDAY + DAY, endsAt: MONDAY + 2 * DAY, requestedHours: 8 });
    const first = os.timeOffRequests().find((r) => r.memberId === me.id)!;
    os.decideTimeOff(first.id, true, me.id);

    const balances = os.timeOffBalances(YEAR);
    const mine = balances.find((row) => row.memberId === me.id)!;
    expect(mine.approvedHours).toBe(24);
    expect(balances.find((row) => row.memberId === other.id)!.pendingHours).toBe(8);
  });
});

describe("Work Mode: schedules and coverage", () => {
  it("builds a per-employee schedule", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    os.addShift({ memberId: me.id, startsAt: MONDAY, endsAt: MONDAY + 8 * 3_600_000 });
    os.addShift({ memberId: me.id, startsAt: MONDAY + 3 * DAY, endsAt: MONDAY + 3 * DAY + 4 * 3_600_000 });

    const schedule = os.employeeSchedule(me.id, MONDAY + DAY)!;
    expect(schedule.shifts).toHaveLength(2);
    expect(schedule.weekMinutes).toBe(720);
    expect(schedule.shiftCount).toBe(2);
  });

  it("builds a week coverage grid", () => {
    const os = makeOS();
    const { me, other } = seedMembers(os);
    os.addShift({ memberId: me.id, startsAt: MONDAY, endsAt: MONDAY + 8 * 3_600_000 });
    os.addShift({ memberId: other.id, startsAt: MONDAY, endsAt: MONDAY + 4 * 3_600_000 });

    const coverage = os.weekCoverage(MONDAY);
    expect(coverage).toHaveLength(7);
    expect(coverage[0]!.label).toBe("Mon");
    expect(coverage[0]!.shifts).toBe(2);
    expect(coverage[0]!.minutes).toBe(720);
    expect(coverage[0]!.members).toHaveLength(2);
  });

  it("keeps Work Mode data out of personal planning", () => {
    const os = makeOS();
    const { me } = seedMembers(os);
    os.addShift({ memberId: me.id, startsAt: MONDAY, endsAt: MONDAY + 8 * 3_600_000, title: "Cover desk" });
    os.addTask({ title: "Personal task", mode: "personal" });

    const shifts = os.shifts();
    expect(shifts).toHaveLength(1);
    expect(os.getTask(Object.keys(os.getState().tasks)[0]!)!.mode).toBe("personal");
    expect(shifts[0].title).toBe("Cover desk");
  });

  it("formats shift ranges and hours", () => {
    const start = new Date(2026, 9, 12, 9, 0, 0, 0).getTime();
    const end = new Date(2026, 9, 12, 17, 30, 0, 0).getTime();
    expect(formatShiftRange(start, end)).toContain("9:00");
    expect(hoursBetween(start, end)).toBe(8.5);
  });
});