import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import type { CalendarEvent } from "../../types/event";
import { createEvent } from "../../types/event";
import type { Task } from "../../types/task";
import { createTask } from "../../types/task";
import { MINUTE_MS } from "../date-utils";
import {
  detectImpossibleSchedules,
  detectInsufficientTime,
  detectOverlaps,
  detectTaskConflicts,
  validateEvent,
} from "./conflicts";

function makeState(): AppState {
  return createInitialState();
}

const MON = new Date(2025, 0, 5).getTime();

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return createEvent({ title: "Test", startsAt: MON, endsAt: MON + 3600000, ...overrides });
}

describe("detectOverlaps", () => {
  it("detects overlapping events", () => {
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 3600000 });
    const e2 = makeEvent({ id: "e2", startsAt: MON + 1800000, endsAt: MON + 5400000 });
    const overlaps = detectOverlaps([e1, e2]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.overlapMin).toBe(30);
  });

  it("returns empty for non-overlapping events", () => {
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 3600000 });
    const e2 = makeEvent({ id: "e2", startsAt: MON + 3600000, endsAt: MON + 7200000 });
    const overlaps = detectOverlaps([e1, e2]);
    expect(overlaps).toHaveLength(0);
  });
});

describe("detectTaskConflicts", () => {
  it("detects tasks due during an event", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 7200000 });
    const t1 = createTask({ title: "Task", dueAt: MON + 3600000, status: "open" });
    state.tasks[t1.id] = t1;
    state.events["e1"] = e1;
    const conflicts = detectTaskConflicts(state, e1);
    expect(conflicts).toHaveLength(1);
  });

  it("ignores done tasks", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 7200000 });
    const t1 = createTask({ title: "Task", dueAt: MON + 3600000, status: "done" });
    state.tasks[t1.id] = t1;
    state.events["e1"] = e1;
    const conflicts = detectTaskConflicts(state, e1);
    expect(conflicts).toHaveLength(0);
  });
});

describe("detectImpossibleSchedules", () => {
  it("detects events ending before they start", () => {
    const e1 = makeEvent({ id: "e1", startsAt: MON + 3600000, endsAt: MON });
    const impossible = detectImpossibleSchedules(makeState(), [e1]);
    expect(impossible).toHaveLength(1);
  });

  it("detects events exceeding 24 hours", () => {
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 25 * 60 * MINUTE_MS });
    const impossible = detectImpossibleSchedules(makeState(), [e1]);
    expect(impossible).toHaveLength(1);
  });
});

describe("detectInsufficientTime", () => {
  it("returns null when enough time is available", () => {
    const state = makeState();
    const result = detectInsufficientTime(state, MON, 60, 8, 18);
    expect(result).toBeNull();
  });

  it("returns insufficient when not enough time", () => {
    const state = makeState();
    const dayStart = new Date(MON).setHours(0, 0, 0, 0);
    const from = dayStart + 8 * 60 * MINUTE_MS;
    const e1 = makeEvent({ id: "e1", startsAt: from, endsAt: from + 10 * 60 * MINUTE_MS });
    state.events["e1"] = e1;
    const result = detectInsufficientTime(state, MON, 120, 8, 18);
    expect(result).not.toBeNull();
  });
});

describe("validateEvent", () => {
  it("returns validation result for an event", () => {
    const state = makeState();
    const e1 = makeEvent({ id: "e1", startsAt: MON, endsAt: MON + 3600000 });
    state.events["e1"] = e1;
    const result = validateEvent(state, e1);
    expect(result.overlaps).toHaveLength(0);
    expect(result.taskConflicts).toHaveLength(0);
    expect(result.impossible).toHaveLength(0);
  });
});
