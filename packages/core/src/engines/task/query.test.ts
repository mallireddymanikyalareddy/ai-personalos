import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import type { Task } from "../../types/task";
import { createTask } from "../../types/task";
import { startOfDay } from "../date-utils";
import {
  queryTasks,
  searchTasks,
  selectCalendarTasks,
  selectCompletionStats,
  selectFocusCandidates,
  selectGoalTaskProgress,
  selectPlannableTasks,
  selectTasksByAssignee,
  selectTasksByCategory,
  selectTasksByGoal,
  selectTasksByHabit,
  selectTasksByProject,
  selectTasksByTag,
  taskContextForAI,
} from "./query";

function makeState(): AppState {
  return createInitialState();
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return createTask({ title: "Test", ...overrides });
}

describe("queryTasks", () => {
  it("filters by status", () => {
    const state = makeState();
    const a = makeTask({ title: "A", status: "open" });
    const b = makeTask({ title: "B", status: "done" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { status: ["open"] });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(a.id);
  });

  it("filters by priority", () => {
    const state = makeState();
    const a = makeTask({ title: "A", priority: 3 });
    const b = makeTask({ title: "B", priority: 1 });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { priority: [3] });
    expect(result).toHaveLength(1);
  });

  it("filters by projectId", () => {
    const state = makeState();
    const a = makeTask({ title: "A", projectId: "p1" });
    const b = makeTask({ title: "B", projectId: "p2" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { projectId: "p1" });
    expect(result).toHaveLength(1);
  });

  it("filters by goalId", () => {
    const state = makeState();
    const a = makeTask({ title: "A", goalIds: ["g1"] });
    const b = makeTask({ title: "B", goalIds: ["g2"] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { goalId: "g1" });
    expect(result).toHaveLength(1);
  });

  it("filters by tags", () => {
    const state = makeState();
    const a = makeTask({ title: "A", tags: ["urgent"] });
    const b = makeTask({ title: "B", tags: ["low"] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { tags: ["urgent"] });
    expect(result).toHaveLength(1);
  });

  it("filters by search text in title", () => {
    const state = makeState();
    const a = makeTask({ title: "Buy milk" });
    const b = makeTask({ title: "Walk dog" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { search: "milk" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(a.id);
  });

  it("filters by search text in notes", () => {
    const state = makeState();
    const a = makeTask({ title: "A", notes: "important meeting" });
    const b = makeTask({ title: "B", notes: "nothing" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { search: "important" });
    expect(result).toHaveLength(1);
  });

  it("filters by dueBefore", () => {
    const state = makeState();
    const now = Date.now();
    const a = makeTask({ title: "A", dueAt: now - 10000 });
    const b = makeTask({ title: "B", dueAt: now + 10000 });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, { dueBefore: now });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(a.id);
  });

  it("excludes archived by default", () => {
    const state = makeState();
    const a = makeTask({ title: "A", status: "archived" });
    const b = makeTask({ title: "B", status: "open" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = queryTasks(state, {});
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(b.id);
  });

  it("includes archived when requested", () => {
    const state = makeState();
    const a = makeTask({ title: "A", status: "archived" });
    state.tasks[a.id] = a;
    const result = queryTasks(state, { includeArchived: true });
    expect(result).toHaveLength(1);
  });
});

describe("searchTasks", () => {
  it("finds tasks by title substring", () => {
    const state = makeState();
    const a = makeTask({ title: "Quarterly report" });
    const b = makeTask({ title: "Daily standup" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(searchTasks(state, "quarterly")).toHaveLength(1);
    expect(searchTasks(state, "standup")).toHaveLength(1);
    expect(searchTasks(state, "report")).toHaveLength(1);
  });
});

describe("selectTasksByProject", () => {
  it("returns all tasks for a project including done", () => {
    const state = makeState();
    const a = makeTask({ title: "A", projectId: "p1", status: "done" });
    const b = makeTask({ title: "B", projectId: "p1", status: "open" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = selectTasksByProject(state, "p1");
    expect(result).toHaveLength(2);
  });
});

describe("selectTasksByGoal", () => {
  it("returns tasks linked to a goal", () => {
    const state = makeState();
    const a = makeTask({ title: "A", goalIds: ["g1"] });
    state.tasks[a.id] = a;
    expect(selectTasksByGoal(state, "g1")).toHaveLength(1);
    expect(selectTasksByGoal(state, "g2")).toHaveLength(0);
  });
});

describe("selectTasksByAssignee", () => {
  it("returns tasks assigned to a member", () => {
    const state = makeState();
    const a = makeTask({ title: "A", assigneeId: "m1" });
    const b = makeTask({ title: "B", assigneeId: "m2" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(selectTasksByAssignee(state, "m1")).toHaveLength(1);
  });
});

describe("selectTasksByTag", () => {
  it("returns tasks with a specific tag", () => {
    const state = makeState();
    const a = makeTask({ title: "A", tags: ["work"] });
    const b = makeTask({ title: "B", tags: ["home"] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(selectTasksByTag(state, "work")).toHaveLength(1);
  });
});

describe("selectTasksByCategory", () => {
  it("returns tasks in a category", () => {
    const state = makeState();
    const a = makeTask({ title: "A", categoryId: "c1" });
    state.tasks[a.id] = a;
    expect(selectTasksByCategory(state, "c1")).toHaveLength(1);
  });
});

describe("selectTasksByHabit", () => {
  it("returns tasks linked to a habit", () => {
    const state = makeState();
    const a = makeTask({ title: "A", habitId: "h1" });
    state.tasks[a.id] = a;
    expect(selectTasksByHabit(state, "h1")).toHaveLength(1);
  });
});

describe("selectCalendarTasks", () => {
  it("returns open tasks within a time range", () => {
    const state = makeState();
    const now = Date.now();
    const a = makeTask({ title: "A", dueAt: now, status: "open" });
    const b = makeTask({ title: "B", dueAt: now, status: "done" });
    const c = makeTask({ title: "C", dueAt: now + 86400000 * 7, status: "open" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = selectCalendarTasks(state, now - 1000, now + 1000);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(a.id);
  });
});

describe("selectPlannableTasks", () => {
  it("returns tasks with no due date or due today", () => {
    const state = makeState();
    const now = Date.now();
    const a = makeTask({ title: "A", dueAt: null });
    const b = makeTask({ title: "B", dueAt: now });
    const c = makeTask({ title: "C", dueAt: now + 86400000 * 7 });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = selectPlannableTasks(state, now);
    expect(result).toHaveLength(2);
  });
});

describe("selectFocusCandidates", () => {
  it("returns top priority active tasks", () => {
    const state = makeState();
    const now = Date.now();
    const a = makeTask({ title: "A", priority: 3, status: "open" });
    const b = makeTask({ title: "B", priority: 1, status: "open" });
    const c = makeTask({ title: "C", priority: 4, status: "done" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = selectFocusCandidates(state, now);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result[0]!.priority).toBeGreaterThanOrEqual(result[result.length - 1]!.priority);
  });
});

describe("selectCompletionStats", () => {
  it("aggregates completion statistics", () => {
    const state = makeState();
    const now = Date.now();
    const day = startOfDay(now);
    const a = makeTask({ title: "A", status: "done", completedAt: now, createdAt: now });
    const b = makeTask({ title: "B", status: "open", createdAt: now });
    const c = makeTask({ title: "C", status: "done", completedAt: now, createdAt: now });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const stats = selectCompletionStats(state, day - 1000, now + 1000, now);
    expect(stats.total).toBe(3);
    expect(stats.done).toBe(2);
    expect(stats.open).toBe(1);
    expect(stats.byPriority[0]).toBe(3);
  });
});

describe("selectGoalTaskProgress", () => {
  it("returns progress for tasks linked to a goal", () => {
    const state = makeState();
    const now = Date.now();
    const a = makeTask({ title: "A", goalIds: ["g1"], status: "done" });
    const b = makeTask({ title: "B", goalIds: ["g1"], status: "open" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const progress = selectGoalTaskProgress(state, "g1", now);
    expect(progress.total).toBe(2);
    expect(progress.done).toBe(1);
    expect(progress.open).toBe(1);
  });
});

describe("taskContextForAI", () => {
  it("returns a structured context for AI consumption", () => {
    const state = makeState();
    const now = Date.now();
    const a = makeTask({ title: "A", status: "inbox" });
    const b = makeTask({ title: "B", status: "open", dueAt: now });
    const c = makeTask({ title: "C", status: "done" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const ctx = taskContextForAI(state, now);
    expect(ctx.inbox).toHaveLength(1);
    expect(ctx.today.length).toBeGreaterThanOrEqual(1);
    expect(ctx.overdue).toHaveLength(0);
    expect(ctx.focus).toHaveLength(1);
    expect(ctx.blocked).toHaveLength(0);
  });
});
