import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import type { ReminderMethod } from "../../types/reminder";
import type { Task } from "../../types/task";
import { createTask } from "../../types/task";
import { MINUTE_MS } from "../date-utils";
import {
  markReminderFired,
  resolveReminderFireAt,
  resolveRemindersForTask,
  selectPendingReminders,
  selectRemindersForTask,
} from "./reminders";

function makeState(): AppState {
  return createInitialState();
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return createTask({ title: "Test", ...overrides });
}

describe("resolveReminderFireAt", () => {
  it("returns absolute at when provided", () => {
    const task = makeTask({ dueAt: 1000000 });
    expect(resolveReminderFireAt({ at: 5000 }, task)).toBe(5000);
  });

  it("computes from offsetMin relative to dueAt", () => {
    const task = makeTask({ dueAt: 1000000 });
    expect(resolveReminderFireAt({ offsetMin: -30 }, task)).toBe(1000000 - 30 * MINUTE_MS);
  });

  it("computes from offsetMin relative to scheduledAt when no dueAt", () => {
    const task = makeTask({ dueAt: null, scheduledAt: 2000000 });
    expect(resolveReminderFireAt({ offsetMin: 15 }, task)).toBe(2000000 + 15 * MINUTE_MS);
  });

  it("returns null when no at or offsetMin", () => {
    const task = makeTask({ dueAt: 1000000 });
    expect(resolveReminderFireAt({}, task)).toBeNull();
  });
});

describe("selectRemindersForTask", () => {
  it("returns only reminders for the given task", () => {
    const state = makeState();
    const task = makeTask();
    const r1 = { id: "r1", taskId: task.id, fireAt: 1000, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    const r2 = { id: "r2", taskId: "other", fireAt: 2000, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    state.reminders["r1"] = r1 as never;
    state.reminders["r2"] = r2 as never;
    const result = selectRemindersForTask(state, task.id);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("r1");
  });

  it("sorts by fireAt", () => {
    const state = makeState();
    const task = makeTask();
    const r1 = { id: "r1", taskId: task.id, fireAt: 2000, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    const r2 = { id: "r2", taskId: task.id, fireAt: 1000, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    state.reminders["r1"] = r1 as never;
    state.reminders["r2"] = r2 as never;
    const result = selectRemindersForTask(state, task.id);
    expect(result[0]!.id).toBe("r2");
    expect(result[1]!.id).toBe("r1");
  });
});

describe("selectPendingReminders", () => {
  it("returns unfired reminders at or before now", () => {
    const state = makeState();
    const task = makeTask();
    const r1 = { id: "r1", taskId: task.id, fireAt: 500, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    const r2 = { id: "r2", taskId: task.id, fireAt: 1500, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    const r3 = { id: "r3", taskId: task.id, fireAt: 500, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: 400, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    state.reminders["r1"] = r1 as never;
    state.reminders["r2"] = r2 as never;
    state.reminders["r3"] = r3 as never;
    const result = selectPendingReminders(state, 1000);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("r1");
  });
});

describe("markReminderFired", () => {
  it("sets firedAt", () => {
    const reminder = { id: "r1", taskId: "t1", fireAt: 1000, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    const result = markReminderFired(reminder as never, 5000);
    expect(result.firedAt).toBe(5000);
  });
});

describe("resolveRemindersForTask", () => {
  it("marks all unfired reminders for a task as fired", () => {
    const state = makeState();
    const task = makeTask();
    const r1 = { id: "r1", taskId: task.id, fireAt: 1000, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: null, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    const r2 = { id: "r2", taskId: task.id, fireAt: 2000, method: "in_app" as ReminderMethod, message: "", eventId: null, habitId: null, firedAt: 500, createdAt: 0, updatedAt: 0, type: "reminder" as const };
    state.reminders["r1"] = r1 as never;
    state.reminders["r2"] = r2 as never;
    const result = resolveRemindersForTask(state, task.id, 3000);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("r1");
    expect(result[0]!.firedAt).toBe(3000);
  });
});
