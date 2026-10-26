import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import { buildNotebookWorkspace, notebookNotePreview } from "./workspace";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  os.clearAll();
});

function seedPage(input: {
  title: string;
  notebookId: string;
  body?: string;
  tags?: string[];
  ageDays?: number;
}) {
  const page = os.addPage(
    {
      notebookId: input.notebookId,
      title: input.title,
      body: input.body ?? "",
      tags: input.tags ?? [],
    },
    NOW - (input.ageDays ?? 1) * DAY,
  );
  os.updatePage(page.id, { lastEditedAt: NOW - (input.ageDays ?? 1) * DAY });
  return page;
}

describe("notebook workspace collections", () => {
  it("lists all notes, each notebook, archive and trash with counts", () => {
    const work = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    const archived = os.addNotebook({ title: "Old" }, NOW - 60 * DAY);
    os.updateNotebook(archived.id, { status: "archived" });
    seedPage({ title: "One", notebookId: work.id });
    seedPage({ title: "Two", notebookId: work.id });
    seedPage({ title: "Old note", notebookId: archived.id });
    const trashed = seedPage({ title: "Gone", notebookId: work.id });
    os.deletePage(trashed.id);

    const workspace = buildNotebookWorkspace(os.getState(), NOW);
    const byName = new Map(workspace.collections.map((row) => [row.name, row]));

    expect(byName.get("All Notes")!.count).toBe(3);
    expect(byName.get("Work")!.count).toBe(2);
    expect(byName.get("Archived")!.count).toBe(1);
    expect(byName.get("Trash")!.count).toBe(1);
  });

  it("filters by notebook, tag and query", () => {
    const work = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    const home = os.addNotebook({ title: "Home" }, NOW - 30 * DAY);
    seedPage({ title: "Roadmap", notebookId: work.id, tags: ["work"], body: "plan the launch" });
    seedPage({ title: "Groceries", notebookId: home.id, tags: ["personal"] });

    expect(
      buildNotebookWorkspace(os.getState(), NOW, { collectionId: work.id }).rows.map((r) => r.title),
    ).toEqual(["Roadmap"]);
    expect(
      buildNotebookWorkspace(os.getState(), NOW, { tag: "personal" }).rows.map((r) => r.title),
    ).toEqual(["Groceries"]);
    expect(
      buildNotebookWorkspace(os.getState(), NOW, { query: "launch" }).rows.map((r) => r.title),
    ).toEqual(["Roadmap"]);
  });

  it("shows trashed pages only in the trash collection", () => {
    const work = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    const page = seedPage({ title: "Gone", notebookId: work.id });
    os.deletePage(page.id);

    expect(buildNotebookWorkspace(os.getState(), NOW).rows).toHaveLength(0);
    expect(
      buildNotebookWorkspace(os.getState(), NOW, { collectionId: "trash" }).rows.map((r) => r.title),
    ).toEqual(["Gone"]);
  });
});

describe("notebook workspace rows and stats", () => {
  it("builds a row with preview, tags, notebook and word count", () => {
    const work = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    seedPage({
      title: "Launch plan",
      notebookId: work.id,
      body: "High level plan and milestones for the launch.",
      tags: ["work"],
    });

    const row = buildNotebookWorkspace(os.getState(), NOW).rows[0]!;
    expect(row.title).toBe("Launch plan");
    expect(row.preview).toContain("High level plan");
    expect(row.notebookTitle).toBe("Work");
    expect(row.tags).toEqual(["work"]);
    expect(row.wordCount).toBeGreaterThan(0);
  });

  it("counts notes, notebooks and words", () => {
    const work = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    seedPage({ title: "A", notebookId: work.id, body: "one two three" });

    const workspace = buildNotebookWorkspace(os.getState(), NOW);
    expect(workspace.stats.notes).toBe(1);
    expect(workspace.stats.notebooks).toBe(1);
    expect(workspace.stats.words).toBe(3);
  });

  it("counts tags and lists recent notes", () => {
    const work = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    seedPage({ title: "A", notebookId: work.id, tags: ["work"], ageDays: 3 });
    seedPage({ title: "B", notebookId: work.id, tags: ["work", "ideas"], ageDays: 1 });

    const workspace = buildNotebookWorkspace(os.getState(), NOW);
    const tags = new Map(workspace.tags.map((row) => [row.tag, row.count]));
    expect(tags.get("work")).toBe(2);
    expect(tags.get("ideas")).toBe(1);
    expect(workspace.recent[0]!.title).toBe("B");
  });

  it("merges notebooks that share a name into one collection entry", () => {
    const first = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    const second = os.addNotebook({ title: "work" }, NOW - 20 * DAY);
    seedPage({ title: "One", notebookId: first.id });
    seedPage({ title: "Two", notebookId: second.id });

    const workspace = buildNotebookWorkspace(os.getState(), NOW);
    const workEntries = workspace.collections.filter((row) => row.name.toLowerCase() === "work");
    expect(workEntries).toHaveLength(1);
    expect(workEntries[0]!.count).toBe(2);
  });

  it("keeps tags separate from notebooks", () => {
    const personal = os.addNotebook({ title: "Personal" }, NOW - 30 * DAY);
    seedPage({ title: "One", notebookId: personal.id, tags: ["personal"] });
    seedPage({ title: "Two", notebookId: personal.id, tags: ["personal", "work"] });

    const workspace = buildNotebookWorkspace(os.getState(), NOW);
    expect(workspace.collections.filter((row) => row.name === "Personal")).toHaveLength(1);
    expect(workspace.tags.find((row) => row.tag === "personal")!.count).toBe(2);
    expect(workspace.tags.find((row) => row.tag === "work")!.count).toBe(1);
  });

  it("returns an empty workspace with no notebooks", () => {
    const workspace = buildNotebookWorkspace(os.getState(), NOW);
    expect(workspace.rows).toHaveLength(0);
    expect(workspace.stats.notes).toBe(0);
    expect(workspace.collections[0]!.name).toBe("All Notes");
  });

  it("previews the page body", () => {
    const work = os.addNotebook({ title: "Work" }, NOW - 30 * DAY);
    const page = seedPage({ title: "A", notebookId: work.id, body: "a   b   c" });
    expect(notebookNotePreview(page)).toBe("a b c");
  });
});
