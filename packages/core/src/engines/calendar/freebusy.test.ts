import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import type { CalendarEvent } from "../../types/event";
import { createEvent } from "../../types/event";
import type { TimeBlock } from "../../types/time-block";
import { createTimeBlock } from "../../types/time-block";
import { MINUTE_MS, addDays, startOfDay } from "../date-utils";
import {
  findFreeSlots,
  findFreeSlotsForDay,
  isTimeAvailable,
  suggestTimeSlots,
  totalBusyMinutes,
  totalFreeMinutes,
} from "./freebusy";

function makeState(): AppState {
  return createInitialState();
}

const MON = new Date(2025, 0, 5).getTime();
const TUE = addDays(MON, 1);
const NOW = TUE;

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return createEvent({ title: "Test", startsAt: MON, endsAt: MON + 3600000, ...overrides });
}

function makeBlock(overrides: Partial<TimeBlock> = {}): TimeBlock {
  return createTimeBlock({ title: "Focus", startsAt: MON, endsAt: MON + 3600000, ...overrides });
}

describe("findFreeSlots", () => {
  it("returns empty slots between busy periods", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 3600000 });
    state.events["e1"] = e1;
    const slots = findFreeSlots(state, MON, MON + 7200000, 30);
    expect(slots.length).toBeGreaterThan(0);
  });

  it("returns no slots when fully booked", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 7200000 });
    state.events["e1"] = e1;
    const slots = findFreeSlots(state, MON, MON + 7200000, 30);
    expect(slots).toHaveLength(0);
  });

  it("respects minDurationMin", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 1800000 });
    state.events["e1"] = e1;
    const slots = findFreeSlots(state, MON, MON + 3600000, 45);
    expect(slots.every((s) => s.durationMin >= 45)).toBe(true);
  });
});

describe("findFreeSlotsForDay", () => {
  it("returns slots within working hours", () => {
    const state = makeState();
    const dayStart = startOfDay(MON);
    const from = dayStart + 8 * 60 * MINUTE_MS;
    const to = dayStart + 18 * 60 * MINUTE_MS;
    const e1 = makeEvent({ id: "e1", startsAt: from + 60 * MINUTE_MS, endsAt: from + 120 * MINUTE_MS });
    state.events["e1"] = e1;
    const slots = findFreeSlotsForDay(state, MON, 8, 18, 30);
    expect(slots.length).toBeGreaterThan(0);
  });
});

describe("isTimeAvailable", () => {
  it("returns true when no conflicts", () => {
    const state = makeState();
    expect(isTimeAvailable(state, MON, MON + 3600000)).toBe(true);
  });

  it("returns false when event exists", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 3600000 });
    state.events["e1"] = e1;
    expect(isTimeAvailable(state, MON + 1800000, MON + 5400000)).toBe(false);
  });
});

describe("totalFreeMinutes", () => {
  it("calculates total free time", () => {
    const state = makeState();
    const total = totalFreeMinutes(state, MON, MON + 7200000, 30);
    expect(total).toBe(120);
  });
});

describe("totalBusyMinutes", () => {
  it("calculates total busy time", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 3600000 });
    state.events["e1"] = e1;
    const busy = totalBusyMinutes(state, MON, MON + 7200000);
    expect(busy).toBe(60);
  });
});

describe("suggestTimeSlots", () => {
  it("suggests slots for a given duration", () => {
    const state = makeState();
    const slots = suggestTimeSlots(state, MON, 60, 8, 18);
    expect(slots.every((s) => s.durationMin >= 60)).toBe(true);
  });
});
