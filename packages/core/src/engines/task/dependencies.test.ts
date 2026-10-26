import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import type { Task } from "../../types/task";
import { createTask } from "../../types/task";
import {
  allDependencies,
  blockersOf,
  dependenciesFor,
  dependencyChain,
  isBlocked,
  topoSort,
  wouldCreateCycle,
} from "./dependencies";

function makeState(): AppState {
  return createInitialState();
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return createTask({ title: "Test", ...overrides });
}

describe("dependenciesFor", () => {
  it("returns direct dependencies", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B" });
    const c = makeTask({ title: "C", dependsOn: [a.id, b.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = dependenciesFor(state, c.id);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toContain(a.id);
    expect(result.map((t) => t.id)).toContain(b.id);
  });

  it("returns empty for unknown task", () => {
    const state = makeState();
    expect(dependenciesFor(state, "unknown")).toHaveLength(0);
  });
});

describe("allDependencies", () => {
  it("returns transitive closure", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    const c = makeTask({ title: "C", dependsOn: [b.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = allDependencies(state, c.id);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toContain(a.id);
    expect(result.map((t) => t.id)).toContain(b.id);
  });

  it("handles cycles gracefully", () => {
    const state = makeState();
    const a = makeTask({ title: "A", dependsOn: ["b"] });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = allDependencies(state, a.id);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

describe("blockersOf", () => {
  it("returns tasks that depend on the given task", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    const c = makeTask({ title: "C", dependsOn: [a.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = blockersOf(state, a.id);
    expect(result).toHaveLength(2);
  });
});

describe("isBlocked", () => {
  it("returns true when a dependency is open", () => {
    const state = makeState();
    const a = makeTask({ title: "A", status: "open" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(isBlocked(b, state)).toBe(true);
  });

  it("returns false when all dependencies are done", () => {
    const state = makeState();
    const a = makeTask({ title: "A", status: "done" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(isBlocked(b, state)).toBe(false);
  });

  it("returns false when dependency is cancelled", () => {
    const state = makeState();
    const a = makeTask({ title: "A", status: "cancelled" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(isBlocked(b, state)).toBe(false);
  });
});

describe("wouldCreateCycle", () => {
  it("detects direct cycle", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(wouldCreateCycle(state, a.id, [b.id])).toBe(true);
  });

  it("detects indirect cycle", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    const c = makeTask({ title: "C", dependsOn: [b.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    expect(wouldCreateCycle(state, a.id, [c.id])).toBe(true);
  });

  it("returns false for non-cycle", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    expect(wouldCreateCycle(state, a.id, [b.id])).toBe(false);
  });
});

describe("topoSort", () => {
  it("orders tasks so dependencies come first", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    const c = makeTask({ title: "C", dependsOn: [b.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = topoSort([c, b, a], state);
    expect(result.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
  });

  it("handles tasks with no dependencies", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B" });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    const result = topoSort([a, b], state);
    expect(result).toHaveLength(2);
  });
});

describe("dependencyChain", () => {
  it("returns the full chain from a task through its dependencies", () => {
    const state = makeState();
    const a = makeTask({ title: "A" });
    const b = makeTask({ title: "B", dependsOn: [a.id] });
    const c = makeTask({ title: "C", dependsOn: [b.id] });
    state.tasks[a.id] = a;
    state.tasks[b.id] = b;
    state.tasks[c.id] = c;
    const result = dependencyChain(state, c.id);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id)).toContain(a.id);
    expect(result.map((t) => t.id)).toContain(b.id);
    expect(result.map((t) => t.id)).toContain(c.id);
  });
});
