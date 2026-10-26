import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { createBlock } from "../notebook/blocks";
import {
  actionItemBlocks,
  buildNotesWorkspace,
  noteChecklist,
  noteChecklistItems,
  notePreview,
  noteTaskCandidates,
  noteToTaskInputs,
  projectPlanBlocks,
  tidyNoteBlocks,
  tidyNoteText,
  noteToMarkdown,
} from "./workspace";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS({ storage: undefined });
  os.clearAll();
});

describe("notes workspace folders and tags", () => {
  it("lists all notes, archive and each folder with live counts", () => {
    const work = os.addFolder({ name: "Work" }, NOW - 30 * DAY);
    os.addNote({ title: "A", folderId: work.id });
    os.addNote({ title: "B", folderId: work.id });
    os.addNote({ title: "C" });
    const archived = os.addNote({ title: "Old" });
    os.archiveNote(archived.id);

    const workspace = buildNotesWorkspace(os.getState(), NOW);
    const byName = new Map(workspace.folders.map((folder) => [folder.name, folder]));

    expect(byName.get("All Notes")!.count).toBe(3);
    expect(byName.get("Archive")!.count).toBe(1);
    expect(byName.get("Work")!.count).toBe(2);
    expect(workspace.counts).toEqual({ all: 3, archived: 1, trashed: 0, pinned: 0 });
  });

  it("counts tags across active notes only", () => {
    os.addNote({ title: "A", tags: ["work", "nextjs"] });
    os.addNote({ title: "B", tags: ["work"] });
    const archived = os.addNote({ title: "C", tags: ["work"] });
    os.archiveNote(archived.id);

    const workspace = buildNotesWorkspace(os.getState(), NOW);
    const tags = new Map(workspace.tags.map((row) => [row.tag, row.count]));

    expect(tags.get("work")).toBe(2);
    expect(tags.get("nextjs")).toBe(1);
  });
});

describe("notes workspace rows", () => {
  it("builds a row with preview, words, reading time, icon and folder colour", () => {
    const folder = os.addFolder({ name: "Projects", color: "var(--chart-6)" }, NOW - 30 * DAY);
    os.addNote({
      title: "Next.js Project Plan",
      body: "Outline the key features and the tech stack for phase two of the platform.",
      folderId: folder.id,
      tags: ["work", "nextjs"],
      icon: "🚀",
    });

    const row = buildNotesWorkspace(os.getState(), NOW).rows[0]!;
    expect(row.title).toBe("Next.js Project Plan");
    expect(row.preview).toContain("Outline the key features");
    expect(row.wordCount).toBeGreaterThan(0);
    expect(row.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    expect(row.icon).toBe("🚀");
    expect(row.folderName).toBe("Projects");
    expect(row.folderColor).toBe("var(--chart-6)");
    expect(row.tags).toEqual(["work", "nextjs"]);
  });

  it("sorts pinned notes first then by the chosen order", () => {
    const oldest = os.addNote({ title: "Oldest" });
    const newest = os.addNote({ title: "Newest" });
    const pinned = os.addNote({ title: "Pinned", pinned: true });

    const state = os.getState();
    for (const [id, age] of [
      [oldest.id, 5],
      [newest.id, 1],
      [pinned.id, 3],
    ] as const) {
      state.notes[id]!.updatedAt = NOW - age * DAY;
      state.notes[id]!.createdAt = NOW - age * DAY;
    }

    const byUpdated = buildNotesWorkspace(state, NOW, { sort: "updated" });
    expect(byUpdated.rows.map((row) => row.title)).toEqual(["Pinned", "Newest", "Oldest"]);

    const byCreated = buildNotesWorkspace(state, NOW, { sort: "created" });
    expect(byCreated.rows.map((row) => row.title)).toEqual(["Pinned", "Newest", "Oldest"]);
  });

  it("filters by folder, tag, query and pinned", () => {
    const work = os.addFolder({ name: "Work" }, NOW - 30 * DAY);
    os.addNote({ title: "Roadmap", folderId: work.id, tags: ["work"] });
    os.addNote({ title: "Groceries", tags: ["personal"], pinned: true });

    expect(buildNotesWorkspace(os.getState(), NOW, { folderId: work.id }).rows.map((r) => r.title)).toEqual([
      "Roadmap",
    ]);
    expect(buildNotesWorkspace(os.getState(), NOW, { tag: "personal" }).rows.map((r) => r.title)).toEqual([
      "Groceries",
    ]);
    expect(buildNotesWorkspace(os.getState(), NOW, { query: "road" }).rows.map((r) => r.title)).toEqual([
      "Roadmap",
    ]);
    expect(buildNotesWorkspace(os.getState(), NOW, { pinnedOnly: true }).rows.map((r) => r.title)).toEqual([
      "Groceries",
    ]);
  });
});

describe("notes workspace detail", () => {
  it("exposes checklist progress, related content and linked tasks", () => {
    const project = os.addProject({ name: "MedoriQ Project" }, NOW - 40 * DAY);
    const goal = os.addGoal({ title: "Ship phase two" }, NOW - 40 * DAY);
    const note = os.addNote({
      title: "Next.js Project Plan",
      tags: ["nextjs", "work"],
      projectId: project.id,
      goalIds: [goal.id],
      blocks: [
        createBlock("heading", "Key Features"),
        { ...createBlock("checkList", "Authentication system"), attrs: { checked: true } },
        { ...createBlock("checkList", "Role-based dashboards"), attrs: { checked: true } },
        createBlock("checkList", "Integrate with backend APIs"),
      ],
    });
    os.addNote({ title: "Next.js Resources", tags: ["nextjs"] });

    const workspace = buildNotesWorkspace(os.getState(), NOW, { activeId: note.id });
    const active = workspace.active!;

    expect(active.checklist).toEqual({ done: 2, total: 3 });
    expect(active.related.some((item) => item.type === "project" && item.title === "MedoriQ Project")).toBe(true);
    expect(active.related.some((item) => item.type === "goal" && item.title === "Ship phase two")).toBe(true);
    expect(active.related.some((item) => item.type === "note" && item.title === "Next.js Resources")).toBe(true);
    expect(active.tasks).toEqual([]);
  });

  it("returns no active detail when nothing is selected", () => {
    os.addNote({ title: "A" });
    expect(buildNotesWorkspace(os.getState(), NOW).active).toBeNull();
  });
});

describe("note task extraction", () => {
  it("prefers checklist items, then lists, then the title", () => {
    const checklistNote = os.addNote({
      title: "With checklist",
      blocks: [createBlock("checkList", "Do the thing"), createBlock("checkList", "Do the other")],
    });
    expect(noteTaskCandidates(checklistNote)).toEqual(["Do the thing", "Do the other"]);

    const listNote = os.addNote({
      title: "With list",
      blocks: [createBlock("bulletList", "First"), createBlock("orderedList", "Second")],
    });
    expect(noteTaskCandidates(listNote)).toEqual(["First", "Second"]);

    const plain = os.addNote({ title: "Just a title" });
    expect(noteTaskCandidates(plain)).toEqual(["Just a title"]);
  });

  it("carries tags, project and goals into task inputs", () => {
    const project = os.addProject({ name: "Work" }, NOW - 40 * DAY);
    const goal = os.addGoal({ title: "Grow", category: "career" }, NOW - 40 * DAY);
    const note = os.addNote({
      title: "Plan",
      tags: ["work"],
      projectId: project.id,
      goalIds: [goal.id],
      blocks: [createBlock("checkList", "Step one")],
    });

    const inputs = noteToTaskInputs(note);
    expect(inputs).toEqual([
      { title: "Step one", tags: ["work"], projectId: project.id, goalIds: [goal.id], source: "ai" },
    ]);
    expect(noteChecklistItems(note)).toEqual([{ id: note.blocks[0]!.id, text: "Step one", checked: false }]);
    expect(noteChecklist(note)).toEqual({ done: 0, total: 1 });
  });

  it("converts a note into tasks and links them back", () => {
    const note = os.addNote({
      title: "Ship it",
      tags: ["work"],
      blocks: [createBlock("checkList", "Write the docs"), createBlock("checkList", "Review the docs")],
    });

    const created = os.convertNoteToTasks(note.id, NOW);
    expect(created).toHaveLength(2);
    expect(created.map((task) => task.title)).toEqual(["Write the docs", "Review the docs"]);
    expect(os.getNote(note.id)!.taskIds).toHaveLength(2);
    expect(Object.values(os.getState().tasks)).toHaveLength(2);

    const workspace = buildNotesWorkspace(os.getState(), NOW, { activeId: note.id });
    expect(workspace.active!.tasks.map((task) => task.title)).toEqual(["Write the docs", "Review the docs"]);
  });
});

describe("note text helpers", () => {
  it("tidies spacing and capitalises sentences", () => {
    expect(tidyNoteText("hello   world , next  sentence. ok")).toBe("Hello world, next sentence. Ok");
    expect(tidyNoteText("line one\n\n\n\nline two")).toBe("Line one\n\nline two");
  });

  it("tidies every block", () => {
    const blocks = tidyNoteBlocks([createBlock("paragraph", "some   text .")]);
    expect(blocks[0]!.content).toBe("Some text.");
  });

  it("turns lists into checklists for action items", () => {
    const blocks = actionItemBlocks([
      createBlock("bulletList", "One"),
      createBlock("orderedList", "Two"),
      createBlock("paragraph", "Keep"),
    ]);
    expect(blocks.map((block) => block.type)).toEqual(["checkList", "checkList", "paragraph"]);
    expect(blocks[0]!.attrs).toEqual({ checked: false });
  });

  it("builds a project plan template", () => {
    const blocks = projectPlanBlocks();
    expect(blocks[0]!.type).toBe("heading");
    expect(blocks.filter((block) => block.type === "checkList")).toHaveLength(5);
  });

  it("builds a short preview from the body", () => {
    const note = os.addNote({ title: "T", body: "a   b   c" });
    expect(notePreview(note)).toBe("a b c");
  });
});
describe("note versions, backlinks and export", () => {
  it("records a version on each block change and restores it", () => {
    const note = os.addNote({ title: "History", body: "One" }, NOW);
    os.updateNoteBlocks(
      note.id,
      [{ id: "b1", type: "paragraph", content: "Two" }],
      NOW + 1000,
    );
    os.updateNoteBlocks(
      note.id,
      [{ id: "b1", type: "paragraph", content: "Three" }],
      NOW + 2000,
    );

    const updated = os.getNote(note.id)!;
    expect(updated.versions).toHaveLength(2);
    expect(updated.versions[0]!.blocks[0]!.content).toBe("Two");

    const restored = os.restoreNoteVersion(note.id, updated.versions[1]!.id)!;
    expect(restored.blocks[0]!.content).toBe("One");
    expect(restored.versions).toHaveLength(3);
  });

  it("does not add a version when the blocks are unchanged", () => {
    const note = os.addNote({ title: "Stable", body: "Same" }, NOW);
    os.updateNoteBlocks(note.id, note.blocks, NOW + 1000);
    expect(os.getNote(note.id)!.versions).toHaveLength(0);
  });

  it("finds backlinks from [[wiki links]] and explicit relations", () => {
    const target = os.addNote({ title: "Launch Plan" }, NOW);
    os.addNote({ title: "Notes", body: "See [[launch plan]] for context" }, NOW);
    const explicit = os.addNote({ title: "Related" }, NOW);
    os.updateNote(explicit.id, { relatedNoteIds: [target.id] });

    const workspace = buildNotesWorkspace(os.getState(), NOW, { activeId: target.id });
    const titles = workspace.active!.backlinks.map((row) => row.title).sort();
    expect(titles).toEqual(["Notes", "Related"]);
  });

  it("exports a note as markdown with title, tags and body", () => {
    const note = os.addNote({ title: "Export Me", body: "Hello world", tags: ["work"] }, NOW);
    const markdown = noteToMarkdown(note);
    expect(markdown).toContain("# Export Me");
    expect(markdown).toContain("#work");
    expect(markdown).toContain("Hello world");
  });

  it("adds and lists note reminders", () => {
    const note = os.addNote({ title: "Remind", body: "" }, NOW);
    os.addNoteReminder(note.id, NOW + DAY, NOW);
    const reminders = os.noteReminders(note.id);
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.noteId).toBe(note.id);

    os.removeReminder(reminders[0]!.id);
    expect(os.noteReminders(note.id)).toHaveLength(0);
  });
});