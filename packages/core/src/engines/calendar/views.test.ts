import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import type { CalendarEvent } from "../../types/event";
import { createEvent } from "../../types/event";
import type { TimeBlock } from "../../types/time-block";
import { createTimeBlock } from "../../types/time-block";
import type { Task } from "../../types/task";
import { createTask } from "../../types/task";
import { addDays, startOfDay, DAY_MS, MINUTE_MS } from "../date-utils";
import {
  buildAgendaView,
  buildDayView,
  buildMonthView,
  buildWeekView,
  buildYearView,
  selectEventsByCalendar,
  selectEventsByCategory,
  selectEventsInRange,
} from "./views";

function makeState(): AppState {
  return createInitialState();
}

const MON = new Date(2025, 0, 5).getTime();
const TUE = addDays(MON, 1);
const WED = addDays(MON, 2);
const THU = addDays(MON, 3);
const FRI = addDays(MON, 4);
const NOW = WED;

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return createEvent({ title: "Test", startsAt: MON, endsAt: MON + 3600000, ...overrides });
}

function makeBlock(overrides: Partial<TimeBlock> = {}): TimeBlock {
  return createTimeBlock({ title: "Focus", startsAt: MON, endsAt: MON + 3600000, ...overrides });
}

describe("selectEventsInRange", () => {
  it("returns events overlapping the range", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: TUE + 3600000 });
    const e2 = makeEvent({ id: "e2", startsAt: THU + 86400000, endsAt: THU + 90000000 });
    state.events["e1"] = e1;
    state.events["e2"] = e2;
    const result = selectEventsInRange(state, TUE, THU);
    expect(result).toHaveLength(1);
    expect(result[0]!.startsAt).toBe(MON);
  });

  it("includes events that start before but end within range", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: TUE + 3600000 });
    state.events["e1"] = e1;
    const result = selectEventsInRange(state, TUE, THU);
    expect(result).toHaveLength(1);
  });
});

describe("buildDayView", () => {
  it("returns events and blocks for the day", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1" });
    const b1 = makeBlock({ id: "b1" });
    state.events["e1"] = e1;
    state.timeBlocks["b1"] = b1;
    const day = buildDayView(state, MON, NOW);
    expect(day.events).toHaveLength(1);
    expect(day.timeBlocks).toHaveLength(1);
    expect(day.isToday).toBe(false);
  });

  it("marks today correctly", () => {
    const state = makeState();
    const day = buildDayView(state, WED, NOW);
    expect(day.isToday).toBe(true);
  });
});

describe("buildWeekView", () => {
  it("returns 7 days", () => {
    const state = makeState();
    const week = buildWeekView(state, MON, NOW);
    expect(week.days).toHaveLength(7);
  });
});

describe("buildMonthView", () => {
  it("returns weeks covering the month", () => {
    const state = makeState();
    const month = buildMonthView(state, new Date(2025, 0, 15).getTime(), NOW);
    expect(month.weeks.length).toBeGreaterThanOrEqual(4);
  });
});

describe("buildAgendaView", () => {
  it("returns agenda items for events in range", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 3600000 });
    state.events["e1"] = e1;
    const items = buildAgendaView(state, MON - 1000, TUE);
    expect(items).toHaveLength(1);
  });
});

describe("buildYearView", () => {
  it("returns 12 months", () => {
    const state = makeState();
    const year = buildYearView(state, 2025, NOW);
    expect(year.months).toHaveLength(12);
  });
});

describe("selectEventsByCalendar", () => {
  it("filters by calendar ID", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", calendarId: "cal1" });
    const e2 = makeEvent({ id: "e2", calendarId: "cal2" });
    state.events["e1"] = e1;
    state.events["e2"] = e2;
    const result = selectEventsByCalendar(state, "cal1");
    expect(result).toHaveLength(1);
  });
});

describe("selectEventsByCategory", () => {
  it("filters by category ID", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", categoryId: "cat1" });
    const e2 = makeEvent({ id: "e2", categoryId: "cat2" });
    state.events["e1"] = e1;
    state.events["e2"] = e2;
    const result = selectEventsByCategory(state, "cat1");
    expect(result).toHaveLength(1);
  });
});
