import { describe, expect, it } from "vitest";

import type { Timestamp } from "../../types/common";
import type { RecurrenceRule } from "../../types/task";
import { DAY_MS, addDays, startOfDay } from "../date-utils";
import {
  advanceRecurrence,
  nextOccurrence,
  occurrenceOrdinal,
  reconcileRecurringTask,
  recurrenceKey,
} from "./recurrence";

const MONDAY = new Date(2025, 0, 6).getTime();
const TUESDAY = addDays(MONDAY, 1);
const WEDNESDAY = addDays(MONDAY, 2);
const FRIDAY = addDays(MONDAY, 4);
const SATURDAY = addDays(MONDAY, 5);
const SUNDAY = addDays(MONDAY, 6);
const NEXT_MONDAY = addDays(MONDAY, 7);

describe("nextOccurrence", () => {
  it("daily advances by interval days", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1 };
    expect(nextOccurrence(rule, MONDAY)).toBe(TUESDAY);
  });

  it("daily with interval 3", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 3 };
    expect(nextOccurrence(rule, MONDAY)).toBe(addDays(MONDAY, 3));
  });

  it("weekdays skips Saturday and Sunday", () => {
    const rule: RecurrenceRule = { freq: "weekdays", interval: 1 };
    expect(nextOccurrence(rule, FRIDAY)).toBe(NEXT_MONDAY);
    expect(nextOccurrence(rule, SATURDAY)).toBe(NEXT_MONDAY);
    expect(nextOccurrence(rule, SUNDAY)).toBe(addDays(SUNDAY, 1));
  });

  it("weekly advances to next week same day", () => {
    const rule: RecurrenceRule = { freq: "weekly", interval: 1 };
    expect(nextOccurrence(rule, MONDAY)).toBe(NEXT_MONDAY);
  });

  it("weekly with daysOfWeek picks the next matching day", () => {
    const rule: RecurrenceRule = { freq: "weekly", interval: 1, daysOfWeek: [1, 3] };
    expect(nextOccurrence(rule, TUESDAY)).toBe(WEDNESDAY);
    expect(nextOccurrence(rule, WEDNESDAY)).toBe(NEXT_MONDAY);
  });

  it("monthly advances same day-of-month", () => {
    const rule: RecurrenceRule = { freq: "monthly", interval: 1 };
    const jan31 = new Date(2025, 0, 31).getTime();
    const feb28 = new Date(2025, 1, 28).getTime();
    expect(nextOccurrence(rule, jan31)).toBe(feb28);
  });

  it("monthly clamps Jan 31 to Feb 28 in non-leap year", () => {
    const rule: RecurrenceRule = { freq: "monthly", interval: 1 };
    const jan31 = new Date(2025, 0, 31).getTime();
    const result = nextOccurrence(rule, jan31);
    const d = new Date(result!);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it("monthly clamps Jan 31 to Feb 29 in leap year", () => {
    const rule: RecurrenceRule = { freq: "monthly", interval: 1 };
    const jan31Leap = new Date(2024, 0, 31).getTime();
    const result = nextOccurrence(rule, jan31Leap);
    const d = new Date(result!);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  it("yearly advances same month/day", () => {
    const rule: RecurrenceRule = { freq: "yearly", interval: 1 };
    const feb29Leap = new Date(2024, 1, 29).getTime();
    const result = nextOccurrence(rule, feb29Leap);
    const d = new Date(result!);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it("returns null when interval < 1", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 0 };
    expect(nextOccurrence(rule, MONDAY)).toBeNull();
  });

  it("returns null when candidate is at or after endsAt", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1, endsAt: TUESDAY };
    expect(nextOccurrence(rule, MONDAY)).toBeNull();
  });

  it("returns null when count is exceeded", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1, count: 2 };
    expect(nextOccurrence(rule, MONDAY, MONDAY)).toBe(TUESDAY);
    expect(nextOccurrence(rule, TUESDAY, MONDAY)).toBeNull();
  });
});

describe("occurrenceOrdinal", () => {
  it("daily ordinal is day difference / interval + 1", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1 };
    expect(occurrenceOrdinal(rule, MONDAY, TUESDAY)).toBe(2);
    expect(occurrenceOrdinal(rule, MONDAY, addDays(MONDAY, 5))).toBe(6);
  });

  it("monthly ordinal is month difference + 1", () => {
    const rule: RecurrenceRule = { freq: "monthly", interval: 1 };
    const jan = new Date(2025, 0, 15).getTime();
    const mar = new Date(2025, 2, 15).getTime();
    expect(occurrenceOrdinal(rule, jan, mar)).toBe(3);
  });
});

describe("advanceRecurrence", () => {
  it("returns next occurrence for a recurring task", () => {
    const task = {
      dueAt: MONDAY,
      scheduledAt: null,
      recurrence: { freq: "daily", interval: 1 } as RecurrenceRule,
      recurrenceOrdinal: 1,
    };
    const result = advanceRecurrence(task as never, MONDAY);
    expect(result.nextAt).toBe(TUESDAY);
    expect(result.exhausted).toBe(false);
  });

  it("returns exhausted when no recurrence rule", () => {
    const task = { dueAt: MONDAY, scheduledAt: null, recurrence: null, recurrenceOrdinal: 1 };
    const result = advanceRecurrence(task as never, MONDAY);
    expect(result.nextAt).toBeNull();
    expect(result.exhausted).toBe(true);
  });

  it("returns exhausted when count is reached", () => {
    const task = {
      dueAt: MONDAY,
      scheduledAt: null,
      recurrence: { freq: "daily", interval: 1, count: 1 } as RecurrenceRule,
      recurrenceOrdinal: 1,
    };
    const result = advanceRecurrence(task as never, MONDAY);
    expect(result.exhausted).toBe(true);
  });
});

describe("reconcileRecurringTask", () => {
  it("returns null for non-recurring tasks", () => {
    const task = { recurrence: null, dueAt: MONDAY, scheduledAt: null };
    expect(reconcileRecurringTask(task as never, TUESDAY)).toBeNull();
  });

  it("returns null when not overdue", () => {
    const task = {
      recurrence: { freq: "daily", interval: 1 } as RecurrenceRule,
      dueAt: TUESDAY,
      scheduledAt: null,
    };
    expect(reconcileRecurringTask(task as never, MONDAY)).toBeNull();
  });

  it("advances overdue recurring task to today", () => {
    const task = {
      recurrence: { freq: "daily", interval: 1 } as RecurrenceRule,
      dueAt: MONDAY,
      scheduledAt: null,
    };
    const result = reconcileRecurringTask(task as never, WEDNESDAY);
    expect(result).not.toBeNull();
    expect(result!.dueAt).toBe(WEDNESDAY);
  });

  it("advances multiple periods when far behind", () => {
    const task = {
      recurrence: { freq: "daily", interval: 1 } as RecurrenceRule,
      dueAt: MONDAY,
      scheduledAt: null,
    };
    const result = reconcileRecurringTask(task as never, addDays(MONDAY, 5));
    expect(result).not.toBeNull();
    expect(result!.dueAt).toBe(addDays(MONDAY, 5));
  });
});

describe("recurrenceKey", () => {
  it("produces stable keys for the same rule and anchor", () => {
    const rule: RecurrenceRule = { freq: "weekly", interval: 1, daysOfWeek: [1, 3] };
    expect(recurrenceKey(rule, MONDAY)).toBe(recurrenceKey(rule, MONDAY));
  });

  it("produces different keys for different anchors", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1 };
    expect(recurrenceKey(rule, MONDAY)).not.toBe(recurrenceKey(rule, TUESDAY));
  });
});
