import { describe, expect, it } from "vitest";

import {
  ALL_AREAS,
  AREAS,
  MORE_AREAS,
  MORE_KEYS,
  PRIMARY_AREAS,
  PRIMARY_KEYS,
  moreGroups,
} from "./routes";

const AREA_KEY_COLLECTIONS: Record<string, string> = {
  tasks: "task",
  calendar: "event",
  planner: "timeBlock",
  notes: "note",
  goals: "goal",
  habits: "habit",
  ai: "aiObject",
  templates: "template",
  rewards: "reward",
  notebook: "notebook",
  work: "project",
  memory: "memoryEntry",
  journal: "journalEntry",
};

describe("information architecture registry", () => {
  it("keeps every area exactly once with a unique slug", () => {
    const slugs = ALL_AREAS.map((area) => area.slug);
    const keys = ALL_AREAS.map((area) => area.key);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches the Stage 2 primary navigation", () => {
    expect(PRIMARY_KEYS).toEqual(["today", "calendar", "tasks", "goals", "habits", "notes", "ai"]);
    expect(PRIMARY_AREAS.map((area) => area.label)).toEqual([
      "Today",
      "Calendar",
      "Tasks",
      "Goals",
      "Habits",
      "Notes",
      "AI",
    ]);
  });

  it("matches the More destinations in order", () => {
    expect(MORE_KEYS).toEqual([
      "inbox",
      "focus",
      "meetings",
      "workmode",
      "memory",
      "journal",
      "planner",
      "insights",
      "work",
      "paper",
      "notebook",
      "templates",
      "rewards",
      "integrations",
      "settings",
    ]);
  });

  it("owns each entity in exactly one top-level area", () => {
    const seen = new Set<string>();
    for (const [key, entity] of Object.entries(AREA_KEY_COLLECTIONS)) {
      expect(AREAS[key]).toBeDefined();
      expect(seen.has(entity)).toBe(false);
      seen.add(entity);
    }
    expect(AREAS.tasks.slug).toBe("/tasks");
  });

  it("partitions every More area into exactly one group", () => {
    const grouped = moreGroups().flatMap((section) => section.areas.map((area) => area.key));
    expect(grouped.length).toBe(MORE_AREAS.length);
    expect(new Set(grouped).size).toBe(MORE_AREAS.length);
  });

  it("gives every placeholder area stage content and permissions", () => {
    for (const area of ALL_AREAS) {
      expect(area.permissions.length).toBeGreaterThan(0);
      if (area.status === "placeholder") {
        expect(area.placeholder?.stage).toBeTruthy();
        expect(area.placeholder?.bullets.length).toBeGreaterThan(0);
        expect(area.placeholder?.untilThen).toBeTruthy();
      }
    }
  });
});