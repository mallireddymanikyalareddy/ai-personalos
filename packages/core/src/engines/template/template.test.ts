import { describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import { planTemplatePayload } from "../../types/planning";
import { BUILTIN_TEMPLATES } from "./catalog";

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();
const DAY = 86_400_000;

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

describe("Templates: catalog", () => {
  it("seeds the built-in catalog without duplicating it", () => {
    const os = makeOS();

    const created = os.seedTemplateCatalog(NOW);

    expect(created.length).toBe(BUILTIN_TEMPLATES.length);
    expect(os.templates().length).toBe(BUILTIN_TEMPLATES.length);
    expect(os.seedTemplateCatalog(NOW).length).toBe(0);
  });

  it("keeps every built-in template with a category, kind and items", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);

    for (const template of os.templates()) {
      expect(template.category).toBeTruthy();
      expect(template.templateKind).toBeTruthy();
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.items.length).toBeGreaterThan(0);
    }
  });

  it("lists the popular and featured templates", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);

    expect(os.popularTemplates().length).toBe(6);
    expect(os.featuredTemplates().map((template) => template.name)).toEqual([
      "Life Planner",
      "Project Tracker",
    ]);
  });
});

describe("Templates: library", () => {
  it("filters by category", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);

    const finance = os.templateLibrary({ category: "finance" });

    expect(finance.length).toBeGreaterThan(0);
    expect(finance.every((entry) => entry.template.category === "finance")).toBe(true);
  });

  it("searches by name, description and category", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);

    expect(os.templateLibrary({ query: "budget" })[0]?.template.name).toBe("Budget Planner");
    expect(os.templateLibrary({ query: "finance" }).length).toBeGreaterThan(0);
    expect(os.templateLibrary({ query: "nothing-here" })).toHaveLength(0);
  });

  it("sorts by name, popularity and usage", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);

    const byName = os.templateLibrary({ sort: "name" }).map((entry) => entry.template.name);
    expect([...byName].sort((a, b) => a.localeCompare(b))).toEqual(byName);

    const byPopular = os.templateLibrary({ sort: "popular" });
    expect(byPopular[0]?.template.popularity).toBeGreaterThanOrEqual(
      byPopular[byPopular.length - 1]!.template.popularity,
    );
  });

  it("counts the templates the user owns", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);

    const source = os.templates().find((template) => template.name === "Meeting Notes")!;
    os.duplicateTemplate(source.id, NOW);

    const counts = os.templateCounts();
    expect(counts.work).toBe(1);
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(1);
  });
});

describe("Templates: using a template", () => {
  it("creates real work items and records the usage", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);
    const template = os.templates().find((entry) => entry.name === "Meeting Notes")!;

    const result = os.useTemplate(template.id, NOW);

    expect(result.ok).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
    expect(Object.keys(os.getState().notes).length).toBe(1);
    expect(Object.keys(os.getState().tasks).length).toBe(1);
    expect(os.templateById(template.id)?.useCount).toBe(1);
    expect(os.templateById(template.id)?.lastUsedAt).toBe(NOW);
  });

  it("links tasks to the project the template created", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);
    const template = os.templates().find((entry) => entry.name === "Project Tracker")!;

    os.useTemplate(template.id, NOW);

    const project = Object.values(os.getState().projects)[0]!;
    const tasks = Object.values(os.getState().tasks);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.projectId === project.id)).toBe(true);
  });

  it("reports recently used templates", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);
    const template = os.templates().find((entry) => entry.name === "Weekly Plan")!;

    os.useTemplate(template.id, NOW);

    expect(os.recentlyUsedTemplates(NOW)[0]?.name).toBe("Weekly Plan");
  });

  it("refuses to use a template that no longer exists", () => {
    const os = makeOS();

    const result = os.useTemplate("missing", NOW);

    expect(result.ok).toBe(false);
    expect(result.created).toHaveLength(0);
  });
});

describe("Templates: creating your own", () => {
  it("duplicates an existing template into your own list", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);
    const source = os.templates().find((template) => template.name === "Habit Tracker")!;

    const copy = os.duplicateTemplate(source.id, NOW)!;

    expect(copy.builtin).toBe(false);
    expect(copy.name).toBe("Habit Tracker copy");
    expect(copy.createdFromId).toBe(source.id);
    expect(copy.items.length).toBe(source.items.length);
  });

  it("favourites and unfavourites a template", () => {
    const os = makeOS();
    os.seedTemplateCatalog(NOW);
    const template = os.templates()[0]!;

    expect(os.toggleTemplateFavorite(template.id, NOW)?.favorite).toBe(true);
    expect(os.toggleTemplateFavorite(template.id, NOW)?.favorite).toBe(false);
  });

  it("generates a template from a prompt", () => {
    const os = makeOS();

    const template = os.createTemplateFromPrompt("a weekly budget planner for my household", NOW)!;

    expect(template.source).toBe("ai");
    expect(template.category).toBe("finance");
    expect(template.items.length).toBeGreaterThan(0);
  });

  it("imports a template from JSON", () => {
    const os = makeOS();

    const result = os.importTemplate(
      JSON.stringify({
        name: "Imported plan",
        description: "From a file",
        category: "work",
        items: [{ kind: "task", title: "Do the thing" }],
      }),
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(result.template?.source).toBe("imported");
    expect(result.template?.items[0]?.title).toBe("Do the thing");
  });

  it("rejects a file that is not a template", () => {
    const os = makeOS();

    expect(os.importTemplate("not json", NOW).ok).toBe(false);
    expect(os.importTemplate(JSON.stringify({}), NOW).ok).toBe(false);
  });
});

describe("Templates: plan templates", () => {
  const monday = new Date(2026, 9, 12, 9, 0, 0, 0).getTime();

  function seedMonday(os: PersonalOS) {
    const task = os.addTask({ title: "Deep work", estimateMin: 60 }, monday);
    os.addTimeBlock(
      {
        title: "Deep work",
        startsAt: monday + 9 * 3_600_000,
        endsAt: monday + 10 * 3_600_000,
        kind: "focus",
        taskId: task.id,
        source: "manual",
      },
      monday,
    );
    os.addTimeBlock(
      {
        title: "Admin",
        startsAt: monday + 13 * 3_600_000,
        endsAt: monday + 14 * 3_600_000,
        kind: "focus",
        source: "manual",
      },
      monday,
    );
    return task;
  }

  it("saves a day of blocks and replays it onto another day", () => {
    const os = makeOS();
    seedMonday(os);

    const template = os.savePlanTemplate({ name: "Monday template", from: monday, to: monday + DAY }, monday);

    expect(template.templateKind).toBe("plan");
    expect(planTemplatePayload(template)?.blocks).toHaveLength(2);

    const nextMonday = monday + 7 * DAY;
    const result = os.applyPlanTemplate(template.id, nextMonday, monday);

    expect(result.ok).toBe(true);
    expect(result.createdBlockIds).toHaveLength(2);
    const replayed = Object.values(os.getState().timeBlocks)
      .filter((block) => block.startsAt >= nextMonday)
      .map((block) => block.title)
      .sort();
    expect(replayed).toEqual(["Admin", "Deep work"]);
    expect(os.templateById(template.id)?.useCount).toBe(1);
  });

  it("skips template blocks that overlap existing plans", () => {
    const os = makeOS();
    seedMonday(os);
    const template = os.savePlanTemplate({ name: "Monday template", from: monday, to: monday + DAY }, monday);
    const nextMonday = monday + 7 * DAY;
    os.addTimeBlock(
      {
        title: "Standup",
        startsAt: nextMonday + 9 * 3_600_000,
        endsAt: nextMonday + 10 * 3_600_000,
        kind: "meeting",
        source: "manual",
      },
      monday,
    );

    const result = os.applyPlanTemplate(template.id, nextMonday, monday);

    expect(result.createdBlockIds).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("skips template blocks that are already in the past", () => {
    const os = makeOS();
    seedMonday(os);
    const template = os.savePlanTemplate({ name: "Monday template", from: monday, to: monday + DAY }, monday);
    for (const block of Object.values(os.getState().timeBlocks)) os.deleteTimeBlock(block.id);

    const result = os.applyPlanTemplate(template.id, monday, monday + 12 * 3_600_000);

    expect(result.createdBlockIds).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("links replayed blocks back to tasks that still exist", () => {
    const os = makeOS();
    const task = seedMonday(os);
    const template = os.savePlanTemplate({ name: "Monday template", from: monday, to: monday + DAY }, monday);
    const nextMonday = monday + 7 * DAY;

    os.applyPlanTemplate(template.id, nextMonday, monday);

    const linked = Object.values(os.getState().timeBlocks).find(
      (block) => block.taskId === task.id && block.startsAt >= nextMonday,
    );
    expect(linked).toBeDefined();
    expect(os.getTask(task.id)?.scheduledAt).toBe(nextMonday + 9 * 3_600_000);
  });

  it("keeps plan templates out of the general template library", () => {
    const os = makeOS();
    seedMonday(os);
    const template = os.savePlanTemplate({ name: "Monday template", from: monday, to: monday + DAY }, monday);

    expect(os.templateLibrary({ query: "Monday template" })).toHaveLength(0);
    expect(os.useTemplate(template.id, monday).ok).toBe(false);
  });});
describe("Templates: rich JSON import", () => {
  it("keeps item details, priority, tags and groups", () => {
    const os = makeOS();
    const result = os.importTemplate(
      JSON.stringify({
        name: "Detailed template",
        items: [
          {
            kind: "task",
            title: "Do the thing",
            detail: "With care",
            priority: 4,
            tags: ["work"],
            group: "phase-one",
          },
        ],
      }),
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(result.template?.items[0]).toMatchObject({
      title: "Do the thing",
      detail: "With care",
      priority: 4,
      tags: ["work"],
      group: "phase-one",
    });
  });
});