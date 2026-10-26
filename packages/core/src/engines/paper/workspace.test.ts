import { beforeEach, describe, expect, it } from "vitest";

import type { ID } from "../../types/common";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import { buildPaperWorkspace, paperPreview, plainLanguageText } from "./workspace";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  os.clearAll();
});

let notebookId: ID | null = null;

function seedPage(input: {
  name: string;
  folderId?: string | null;
  tags?: string[];
  kind?: "handwritten" | "typed" | "template" | "scan" | "pdf" | "image";
  favorite?: boolean;
  shared?: boolean;
  text?: string;
  updatedAt?: number;
}) {
  if (notebookId == null) {
    const notebook = os.addPaperNotebook({ title: "Notebook" }, NOW - 30 * DAY);
    const autoPage = os.paperPages(notebook.id)[0];
    if (autoPage) os.deletePaperPage(autoPage.id);
    notebookId = notebook.id;
  }
  return os.addPaperPage(
    {
      notebookId,
      name: input.name,
      kind: input.kind ?? "typed",
      folderId: input.folderId ?? null,
      tags: input.tags ?? [],
      favorite: input.favorite ?? false,
      shared: input.shared ?? false,
      textContent: input.text ?? "",
    },
    input.updatedAt ?? NOW,
  );
}

describe("paper workspace folders and tags", () => {
  it("lists all pages, each folder and the trash with live counts", () => {
    const work = os.addPaperFolder({ name: "Work" }, NOW - 30 * DAY);
    seedPage({ name: "One", folderId: work.id });
    seedPage({ name: "Two", folderId: work.id });
    seedPage({ name: "Three" });

    const workspace = buildPaperWorkspace(os.getState(), NOW);
    const byName = new Map(workspace.folders.map((folder) => [folder.name, folder]));

    expect(byName.get("All Pages")!.count).toBe(3);
    expect(byName.get("Work")!.count).toBe(2);
    expect(byName.get("Trash")!.count).toBe(0);
  });

  it("counts tags across active pages only", () => {
    seedPage({ name: "A", tags: ["work", "nextjs"] });
    seedPage({ name: "B", tags: ["work"] });

    const workspace = buildPaperWorkspace(os.getState(), NOW);
    const tags = new Map(workspace.tags.map((row) => [row.tag, row.count]));
    expect(tags.get("work")).toBe(2);
    expect(tags.get("nextjs")).toBe(1);
  });

  it("filters by folder, tag, query and view", () => {
    const work = os.addPaperFolder({ name: "Work" }, NOW - 30 * DAY);
    seedPage({ name: "Roadmap", folderId: work.id, tags: ["work"] });
    seedPage({ name: "Groceries", tags: ["personal"], favorite: true });
    seedPage({ name: "Shared doc", tags: ["work"], shared: true });

    expect(buildPaperWorkspace(os.getState(), NOW, { folderId: work.id }).rows.map((r) => r.name)).toEqual([
      "Roadmap",
    ]);
    expect(buildPaperWorkspace(os.getState(), NOW, { tag: "personal" }).rows.map((r) => r.name)).toEqual([
      "Groceries",
    ]);
    expect(buildPaperWorkspace(os.getState(), NOW, { query: "grocer" }).rows.map((r) => r.name)).toEqual([
      "Groceries",
    ]);
    expect(buildPaperWorkspace(os.getState(), NOW, { view: "favorites" }).rows.map((r) => r.name)).toEqual([
      "Groceries",
    ]);
    expect(buildPaperWorkspace(os.getState(), NOW, { view: "shared" }).rows.map((r) => r.name)).toEqual([
      "Shared doc",
    ]);
  });
});

describe("paper workspace rows and stats", () => {
  it("builds a row with preview, word count, folder and notebook", () => {
    const folder = os.addPaperFolder({ name: "Work", color: "var(--chart-5)" }, NOW - 30 * DAY);
    seedPage({
      name: "Launch plan",
      folderId: folder.id,
      tags: ["work"],
      text: "High level plan, milestones and next steps for the launch.",
    });

    const row = buildPaperWorkspace(os.getState(), NOW).rows[0]!;
    expect(row.name).toBe("Launch plan");
    expect(row.preview).toContain("High level plan");
    expect(row.wordCount).toBeGreaterThan(0);
    expect(row.folderName).toBe("Work");
    expect(row.folderColor).toBe("var(--chart-5)");
    expect(row.notebookTitle).toBe("Notebook");
    expect(row.tags).toEqual(["work"]);
  });

  it("summarises pages, notebooks, kinds and words", () => {
    seedPage({ name: "A", kind: "typed" });
    seedPage({ name: "B", kind: "handwritten" });
    seedPage({ name: "C", kind: "scan" });
    seedPage({ name: "D", kind: "template", favorite: true, text: "one two three" });

    const workspace = buildPaperWorkspace(os.getState(), NOW);
    expect(workspace.stats.pages).toBe(4);
    expect(workspace.stats.typed).toBe(1);
    expect(workspace.stats.handwritten).toBe(1);
    expect(workspace.stats.scans).toBe(1);
    expect(workspace.stats.templates).toBe(1);
    expect(workspace.stats.favorites).toBe(1);
    expect(workspace.stats.words).toBe(3);
  });

  it("lists recent pages newest first", () => {
    seedPage({ name: "Old", updatedAt: NOW - 10 * DAY });
    seedPage({ name: "New", updatedAt: NOW - DAY });

    const workspace = buildPaperWorkspace(os.getState(), NOW);
    expect(workspace.recent[0]!.name).toBe("New");
  });

  it("returns an empty workspace with no pages", () => {
    const workspace = buildPaperWorkspace(os.getState(), NOW);
    expect(workspace.rows).toHaveLength(0);
    expect(workspace.stats.pages).toBe(0);
    expect(workspace.folders[0]!.name).toBe("All Pages");
  });
});

describe("paper helpers", () => {
  it("previews the page text", () => {
    const page = seedPage({ name: "A", text: "a   b   c" });
    expect(paperPreview(page)).toBe("a b c");
  });

  it("rewrites text into plain language", () => {
    expect(plainLanguageText("We are basically going to finish this in order to ship.")).toBe(
      "We'll finish this to ship.",
    );
  });
});
