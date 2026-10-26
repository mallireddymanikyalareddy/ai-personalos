import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import { PersonalOS } from "../../os";
import { createEvent } from "../../types/event";
import type { PlanningPreferences } from "../../types/profile";
import { createDefaultPlanningPreferences } from "../../types/profile";
import type { Task } from "../../types/task";
import { createTask } from "../../types/task";
import type { TimeBlock } from "../../types/time-block";
import { createTimeBlock } from "../../types/time-block";
import { MINUTE_MS, addDays } from "../date-utils";
import { applyPlan } from "./apply";
import { diffPlan } from "./diff";
import {
  findPlanConflicts,
  recalculatePlan,
} from "./recalc";
import { generatePlan } from "./scheduler";
import { enumerateDayWindows, findPlanningWindows } from "./windows";

function makeState(): AppState {
  return createInitialState();
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return { ...createTask({ title: "Test task" }), ...overrides };
}

function makeBlock(overrides: Partial<TimeBlock> = {}): TimeBlock {
  return {
    ...createTimeBlock({
      title: overrides.title ?? "Focus",
      startsAt: overrides.startsAt ?? DAY_START,
      endsAt: overrides.endsAt ?? DAY_START + 30 * MINUTE_MS,
    }),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<import("../../types/event").CalendarEvent> = {}) {
  return {
    ...createEvent({
      title: "Meeting",
      startsAt: DAY_START + 60 * MINUTE_MS,
      endsAt: DAY_START + 120 * MINUTE_MS,
    }),
    ...overrides,
  };
}

function makePrefs(overrides: Partial<PlanningPreferences> = {}): PlanningPreferences {
  return createDefaultPlanningPreferences();
}

const MON = new Date(2025, 0, 6).getTime();
const NOW = MON + 9 * 60 * MINUTE_MS;
const DAY_START = MON + 9 * 60 * MINUTE_MS;
const DAY_END = MON + 17 * 60 * MINUTE_MS;
const TOMORROW = addDays(MON, 1);

interface TaskSeeds {
  report: Task;
  email: Task;
  review: Task;
}

function seedTasks(state: AppState): TaskSeeds {
  const report = makeTask({
    id: "report",
    title: "Urgent report",
    priority: 4,
    dueAt: MON + 23 * 60 * MINUTE_MS,
    estimateMin: 90,
  });
  const email = makeTask({
    id: "email",
    title: "Reply email",
    priority: 1,
    dueAt: MON + 23 * 60 * MINUTE_MS,
    estimateMin: 30,
  });
  const review = makeTask({
    id: "review",
    title: "Weekly review",
    priority: 2,
    dueAt: TOMORROW + 12 * 60 * MINUTE_MS,
    estimateMin: 60,
  });
  state.tasks["report"] = report;
  state.tasks["email"] = email;
  state.tasks["review"] = review;
  return { report, email, review };
}

describe("enumerateDayWindows", () => {
  it("respects working hours and weekdays", () => {
    const prefs = makePrefs();
    const windows = enumerateDayWindows(prefs, MON, TOMORROW + 12 * 60 * MINUTE_MS);
    expect(windows).toHaveLength(2);
    expect(windows[0].from).toBe(DAY_START);
    expect(windows[0].to).toBe(DAY_END);
  });

  it("excludes weekend days", () => {
    const sat = new Date(2025, 0, 11).getTime();
    const sun = new Date(2025, 0, 12).getTime();
    const prefs = makePrefs();
    const windows = enumerateDayWindows(prefs, sat, sun);
    expect(windows).toHaveLength(0);
  });

  it("clamps partial windows to the requested range", () => {
    const prefs = makePrefs();
    const to = DAY_START + 2 * 60 * MINUTE_MS;
    const windows = enumerateDayWindows(prefs, NOW, to);
    expect(windows).toHaveLength(1);
    expect(windows[0].from).toBe(NOW);
    expect(windows[0].to).toBe(to);
  });
});

describe("findPlanningWindows", () => {
  it("finds free windows excluding events and blocks", () => {
    const state = makeState();
    const event = makeEvent({
      id: "e1",
      title: "Standup",
      startsAt: DAY_START + 60 * MINUTE_MS,
      endsAt: DAY_START + 120 * MINUTE_MS,
    });
    state.events["e1"] = event;
    const slots = findPlanningWindows(state, makePrefs(), DAY_START, DAY_END, 30);
    expect(slots).toHaveLength(2);
  });
});

describe("generatePlan", () => {
  it("schedules due tasks into the earliest free slot", () => {
    const state = makeState();
    seedTasks(state);
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const tasks = proposal.slots.filter((slot) => slot.taskId === "report");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].startsAt).toBe(NOW);
    expect(tasks[0].endsAt).toBe(NOW + 90 * MINUTE_MS);
    expect(proposal.plannedMin).toBe(180);
  });

  it("inserts a buffer between different tasks", () => {
    const state = makeState();
    seedTasks(state);
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const buffers = proposal.slots.filter((slot) => slot.kind === "buffer");
    expect(buffers.length).toBeGreaterThan(0);
    const report = proposal.slots.find((slot) => slot.taskId === "report");
    const email = proposal.slots.find((slot) => slot.taskId === "email");
    expect(report!.endsAt).toBeLessThanOrEqual(email!.startsAt);
  });

  it("does not schedule in the past for today", () => {
    const state = makeState();
    const task = makeTask({ id: "t1", title: "Deep work", priority: 3, dueAt: MON + 23 * 60 * MINUTE_MS, estimateMin: 60 });
    state.tasks["t1"] = task;
    const proposal = generatePlan(state, DAY_START, DAY_START + 4 * 60 * MINUTE_MS, {
      prefs: makePrefs(),
      now: NOW + 30 * MINUTE_MS,
    });
    const slot = proposal.slots.find((s) => s.taskId === "t1");
    expect(slot!.startsAt).toBe(NOW + 30 * MINUTE_MS);
  });

  it("keeps blocked tasks out of the plan", () => {
    const state = makeState();
    seedTasks(state);
    state.tasks["blocked"] = makeTask({
      id: "blocked",
      title: "Blocked task",
      priority: 4,
      dueAt: MON + 23 * 60 * MINUTE_MS,
      estimateMin: 30,
      dependsOn: ["blocker"],
    });
    state.tasks["blocker"] = makeTask({
      id: "blocker",
      title: "Pending blocker",
      priority: 0,
      dueAt: null,
      estimateMin: null,
    });
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const blocked = proposal.unplanned.find((task) => task.taskId === "blocked");
    expect(blocked).toBeDefined();
    expect(blocked!.reason).toContain("Waiting on");
  });

  it("places dependencies before their dependents", () => {
    const state = makeState();
    seedTasks(state);
    state.tasks["base"] = makeTask({
      id: "base",
      title: "Base work",
      priority: 4,
      dueAt: MON + 23 * 60 * MINUTE_MS,
      estimateMin: 60,
    });
    state.tasks["derived"] = makeTask({
      id: "derived",
      title: "Derived work",
      priority: 4,
      dueAt: MON + 23 * 60 * MINUTE_MS,
      estimateMin: 30,
      dependsOn: ["base"],
    });
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const base = proposal.slots.find((s) => s.taskId === "base");
    const derived = proposal.slots.find((s) => s.taskId === "derived");
    expect(base!.startsAt).toBeLessThan(derived!.startsAt);
  });

  it("reports no-free-time when the planning window is full", () => {
    const state = makeState();
    state.events["e1"] = makeEvent({
      id: "e1",
      title: "Team meeting",
      startsAt: DAY_START,
      endsAt: DAY_END - 2 * 60 * MINUTE_MS,
    });
    state.tasks["huge"] = makeTask({
      id: "huge",
      title: "Monster task",
      priority: 0,
      dueAt: null,
      estimateMin: 300,
    });
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const huge = proposal.unplanned.find((task) => task.taskId === "huge");
    expect(huge).toBeDefined();
    expect(huge!.reason).toContain("No free time");
  });

  it("returns an empty plan when planning is disabled", () => {
    const state = makeState();
    seedTasks(state);
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: { ...makePrefs(), enabled: false },
      now: NOW,
    });
    expect(proposal.slots).toHaveLength(0);
    expect(proposal.unplanned).toHaveLength(0);
  });

  it("skips tasks that already have a block in the window", () => {
    const state = makeState();
    seedTasks(state);
    state.timeBlocks["tb1"] = makeBlock({
      id: "tb1",
      title: "Already planned",
      startsAt: DAY_START,
      endsAt: DAY_START + 30 * MINUTE_MS,
      taskId: "report",
    });
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    expect(proposal.slots.some((s) => s.taskId === "report")).toBe(false);
  });
});

describe("diffPlan", () => {
  it("turns a proposal into add changes", () => {
    const state = makeState();
    seedTasks(state);
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const diff = diffPlan(state, proposal);
    expect(diff.rejected).toHaveLength(0);
    expect(diff.changes.length).toBeGreaterThan(0);
    expect(diff.changes.every((change) => change.action === "add")).toBe(true);
  });

  it("rejects slots that are no longer available", () => {
    const state = makeState();
    seedTasks(state);
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const event = makeEvent({
      id: "e1",
      title: "Sprint",
      startsAt: NOW,
      endsAt: NOW + 120 * MINUTE_MS,
    });
    state.events["e1"] = event;
    const diff = diffPlan(state, proposal);
    expect(diff.rejected.length).toBeGreaterThan(0);
  });
});

describe("applyPlan", () => {
  it("creates blocks and schedules tasks", () => {
    const state = makeState();
    const seeds = seedTasks(state);
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: makePrefs(),
      now: NOW,
    });
    const diff = diffPlan(state, proposal);
    const store = {
      addTimeBlock: (input: Parameters<PersonalOS["addTimeBlock"]>[0]) => {
        const block = createTimeBlock(input);
        state.timeBlocks[block.id] = block;
        return block;
      },
      updateTimeBlock: (id: string, patch: Partial<import("../../types/time-block").TimeBlock>) => {
        const block = state.timeBlocks[id];
        if (!block) return null;
        state.timeBlocks[id] = { ...block, ...patch, updatedAt: Date.now() };
        return state.timeBlocks[id];
      },
      updateTask: (id: string, patch: Partial<Task>) => {
        const task = state.tasks[id];
        if (!task) return null;
        state.tasks[id] = { ...task, ...patch, updatedAt: Date.now() };
        return state.tasks[id];
      },
      getState: () => state,
    };
    const result = applyPlan(store, diff);
    expect(result.applied).toBeGreaterThan(0);
    expect(result.rejected).toHaveLength(0);
    const created = Object.values(state.timeBlocks).find(
      (block) => block.taskId === seeds.report.id,
    );
    expect(created).toBeDefined();
    expect(state.tasks["report"]!.scheduledAt).toBe(NOW);
  });
});

describe("findPlanConflicts", () => {
  it("reports blocks overlapping events", () => {
    const state = makeState();
    state.events["e1"] = makeEvent({ id: "e1", title: "Meeting", startsAt: DAY_START, endsAt: DAY_START + 60 * MINUTE_MS });
    state.timeBlocks["tb1"] = makeBlock({
      id: "tb1",
      title: "Focus",
      startsAt: DAY_START + 30 * MINUTE_MS,
      endsAt: DAY_START + 90 * MINUTE_MS,
      source: "ai",
    });
    const conflicts = findPlanConflicts(state, DAY_START, DAY_END);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toContain("event");
  });

  it("reports blocks overlapping other blocks", () => {
    const state = makeState();
    state.timeBlocks["tb1"] = makeBlock({ id: "tb1", title: "A", startsAt: DAY_START, endsAt: DAY_START + 60 * MINUTE_MS, source: "ai" });
    state.timeBlocks["tb2"] = makeBlock({ id: "tb2", title: "B", startsAt: DAY_START + 30 * MINUTE_MS, endsAt: DAY_START + 90 * MINUTE_MS, source: "manual" });
    const conflicts = findPlanConflicts(state, DAY_START, DAY_END);
    expect(conflicts).toHaveLength(2);
  });
});

describe("recalculatePlan", () => {
  it("proposes moving an AI block that now conflicts with an event", () => {
    const state = makeState();
    state.timeBlocks["tb1"] = makeBlock({
      id: "tb1",
      title: "Deep focus",
      startsAt: DAY_START,
      endsAt: DAY_START + 60 * MINUTE_MS,
      source: "ai",
      taskId: "t1",
    });
    state.tasks["t1"] = makeTask({ id: "t1", title: "Deep focus task" });
    state.events["e1"] = makeEvent({
      id: "e1",
      title: "New meeting",
      startsAt: DAY_START,
      endsAt: DAY_START + 60 * MINUTE_MS,
    });
    const proposal = recalculatePlan(state, DAY_START, DAY_END, makePrefs(), NOW);
    const moved = proposal.slots.find((slot) => slot.blockId === "tb1");
    expect(moved).toBeDefined();
    expect(moved!.startsAt).not.toBe(DAY_START);
    expect(moved!.reason).toContain("schedule change");
  });
});
describe("planner regressions", () => {
  it("never schedules into days that are already in the past", () => {
    const state = makeState();
    const wed = new Date(2025, 0, 8).getTime();
    const now = wed + 12 * 60 * MINUTE_MS;
    state.tasks["late"] = makeTask({
      id: "late",
      title: "Late task",
      priority: 4,
      dueAt: wed + 23 * 60 * MINUTE_MS,
      estimateMin: 60,
    });
    const proposal = generatePlan(state, MON, addDays(MON, 7), {
      prefs: makePrefs(),
      now,
    });
    expect(proposal.slots.length).toBeGreaterThan(0);
    expect(proposal.slots.every((slot) => slot.startsAt >= now)).toBe(true);
  });

  it("plans a single weekend day even when working days exclude weekends", () => {
    const state = makeState();
    const sat = new Date(2025, 0, 11).getTime();
    const now = sat + 9 * 60 * MINUTE_MS;
    state.tasks["weekend"] = makeTask({
      id: "weekend",
      title: "Weekend project",
      priority: 4,
      dueAt: sat + 23 * 60 * MINUTE_MS,
      estimateMin: 60,
    });
    const proposal = generatePlan(state, sat + 9 * 60 * MINUTE_MS, sat + 17 * 60 * MINUTE_MS, {
      prefs: makePrefs(),
      now,
    });
    expect(proposal.slots.some((slot) => slot.taskId === "weekend")).toBe(true);
  });

  it("gives every split part of a long task a unique id", () => {
    const state = makeState();
    state.tasks["marathon"] = makeTask({
      id: "marathon",
      title: "Marathon task",
      priority: 4,
      dueAt: MON + 23 * 60 * MINUTE_MS,
      estimateMin: 400,
    });
    const proposal = generatePlan(state, DAY_START, DAY_END, {
      prefs: { ...makePrefs(), bufferMin: 0 },
      now: NOW,
    });
    const ids = proposal.slots.map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not relocate conflicting blocks into the past", () => {
    const state = makeState();
    const wed = new Date(2025, 0, 8).getTime();
    const now = wed + 14 * 60 * MINUTE_MS;
    state.timeBlocks["tb1"] = makeBlock({
      id: "tb1",
      title: "Deep focus",
      startsAt: wed + 13 * 60 * MINUTE_MS,
      endsAt: wed + 14 * 60 * MINUTE_MS,
      source: "ai",
      taskId: "t1",
    });
    state.tasks["t1"] = makeTask({ id: "t1", title: "Deep focus task" });
    state.events["e1"] = makeEvent({
      id: "e1",
      title: "New meeting",
      startsAt: wed + 13 * 60 * MINUTE_MS,
      endsAt: wed + 14 * 60 * MINUTE_MS,
    });
    const proposal = recalculatePlan(state, MON, addDays(MON, 7), makePrefs(), now);
    expect(proposal.slots.every((slot) => slot.startsAt >= now)).toBe(true);
  });
});