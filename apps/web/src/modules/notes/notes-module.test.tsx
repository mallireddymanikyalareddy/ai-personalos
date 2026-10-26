import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { NotesModule } from "./notes-module";

const DAY = 86_400_000;

let os: ReturnType<typeof getOS>;
let now: number;

function installMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia,
  });
}

function renderNotes() {
  return render(
    <ToastProvider>
      <NotesModule />
    </ToastProvider>,
  );
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  installMatchMedia();
  now = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows folders, tags, list, editor and the tool rail with no notes", () => {
    renderNotes();

    expect(screen.getByRole("heading", { name: "Notes" })).toBeDefined();
    expect(screen.getByTestId("notes-folders")).toBeDefined();
    expect(screen.getByTestId("notes-tags")).toBeDefined();
    expect(screen.getByTestId("notes-list")).toBeDefined();
    expect(screen.getByTestId("notes-assistant")).toBeDefined();
    expect(screen.getByTestId("notes-quick-capture")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Note tools" })).toBeDefined();
    expect(screen.getByText("No notes yet")).toBeDefined();
  });

  it("loads the sample notes and populates every panel", () => {
    renderNotes();

    fireEvent.click(screen.getByRole("button", { name: /Load sample notes/i }));

    expect(Object.keys(os.getState().notes).length).toBeGreaterThan(8);
    expect(screen.getAllByTestId("note-list-item").length).toBeGreaterThan(8);
    expect(screen.getByTestId("notes-folder-Work")).toBeDefined();
    expect(screen.getByTestId("notes-folder-Projects")).toBeDefined();
    expect(screen.getByTestId("notes-tag-work")).toBeDefined();
  });
});

describe("folders and tags rails", () => {
  it("shows live counts and filters the list by folder", () => {
    const work = os.addFolder({ name: "Work" }, now - 30 * DAY);
    os.addNote({ title: "Work note", folderId: work.id });
    os.addNote({ title: "Other note" });

    renderNotes();

    const folder = screen.getByTestId("notes-folder-Work");
    expect(within(folder).getByText("1")).toBeDefined();

    fireEvent.click(folder);
    expect(screen.getAllByTestId("note-list-item")).toHaveLength(1);
    expect(screen.getByText("Work note")).toBeDefined();
  });

  it("counts tags and filters by tag", () => {
    os.addNote({ title: "A", tags: ["work", "nextjs"] });
    os.addNote({ title: "B", tags: ["work"] });

    renderNotes();

    const tag = screen.getByTestId("notes-tag-work");
    expect(within(tag).getByText("2")).toBeDefined();

    fireEvent.click(tag);
    expect(screen.getAllByTestId("note-list-item")).toHaveLength(2);

    fireEvent.click(screen.getByTestId("notes-tag-nextjs"));
    expect(screen.getAllByTestId("note-list-item")).toHaveLength(1);
    expect(screen.getByText("A")).toBeDefined();
  });

  it("creates a folder from the rail", () => {
    renderNotes();

    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Finance" } });
    fireEvent.click(screen.getByRole("button", { name: "Create folder" }));

    expect(Object.values(os.getState().folders).map((folder) => folder.name)).toContain("Finance");
  });
});

describe("note list", () => {
  it("searches notes by title", () => {
    os.addNote({ title: "Project roadmap", body: "launch plan" });
    os.addNote({ title: "Groceries", body: "oat milk" });

    renderNotes();

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "roadmap" } });
    expect(screen.getAllByTestId("note-list-item")).toHaveLength(1);
    expect(screen.getByText("Project roadmap")).toBeDefined();
  });

  it("sorts by title", () => {
    os.addNote({ title: "Zebra" });
    os.addNote({ title: "Apple" });

    renderNotes();

    fireEvent.click(screen.getByRole("button", { name: "Sort notes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Title" }));

    const items = screen.getAllByTestId("note-list-item");
    expect(within(items[0]!).getByText("Apple")).toBeDefined();
  });

  it("filters to pinned notes", () => {
    os.addNote({ title: "Pinned one", pinned: true });
    os.addNote({ title: "Normal one" });

    renderNotes();

    fireEvent.click(screen.getByTestId("notes-filter"));
    expect(screen.getAllByTestId("note-list-item")).toHaveLength(1);
    expect(screen.getByText("Pinned one")).toBeDefined();
  });

  it("switches to grid layout", () => {
    os.addNote({ title: "One" });

    renderNotes();

    fireEvent.click(screen.getByTestId("notes-view-grid"));
    expect(screen.getByTestId("notes-view-grid").getAttribute("aria-pressed")).toBe("true");
  });

  it("pins, archives and deletes from the row menu", () => {
    const note = os.addNote({ title: "Actionable" });

    renderNotes();

    fireEvent.click(screen.getByRole("button", { name: /Actionable options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin note" }));
    expect(os.getNote(note.id)?.pinned).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Actionable options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive note" }));
    expect(os.getNote(note.id)?.status).toBe("archived");
  });
});

describe("note editor", () => {
  it("edits the title and shows a note header", () => {
    const note = os.addNote({ title: "Draft" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Draft" }));

    const editor = screen.getByTestId("note-editor");
    fireEvent.change(within(editor).getByLabelText("Note title"), { target: { value: "Final" } });
    expect(os.getNote(note.id)?.title).toBe("Final");
    expect(within(editor).getByTestId("note-updated").textContent).toContain("Last updated");
  });

  it("adds and removes a tag", () => {
    const note = os.addNote({ title: "Tagged" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Tagged" }));

    fireEvent.change(screen.getByLabelText("Add tag"), { target: { value: "nextjs" } });
    fireEvent.keyDown(screen.getByLabelText("Add tag"), { key: "Enter" });
    expect(os.getNote(note.id)?.tags).toEqual(["nextjs"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove tag nextjs" }));
    expect(os.getNote(note.id)?.tags).toEqual([]);
  });

  it("toggles a checklist item", () => {
    const note = os.addNote({ title: "Checklist" });
    os.updateNoteBlocks(note.id, [
      { id: "b1", type: "checkList", content: "Do the thing", attrs: { checked: false } },
    ]);

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Checklist" }));

    const box = screen.getByRole("button", { name: "Toggle checked" });
    fireEvent.click(box);
    const block = os.getNote(note.id)!.blocks[0]!;
    expect(block.attrs?.checked).toBe(true);
  });

  it("changes the block type from the toolbar", () => {
    const note = os.addNote({ title: "Blocks", body: "Some text" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Blocks" }));

    fireEvent.click(screen.getByRole("button", { name: "Block type" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Checklist" }));

    expect(os.getNote(note.id)!.blocks.some((block) => block.type === "checkList")).toBe(true);
  });

  it("renders a table block for the timeline", () => {
    const note = os.addNote({ title: "Timeline" });
    os.updateNoteBlocks(note.id, [
      {
        id: "t1",
        type: "table",
        content: "",
        attrs: {
          columns: ["Phase", "Status"],
          rows: [["Phase 1", "Done"]],
        },
      },
    ]);

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Timeline" }));

    const editor = screen.getByTestId("note-editor");
    expect(within(editor).getByText("Phase")).toBeDefined();
    expect(within(editor).getByText("Done")).toBeDefined();
  });

  it("pins from the editor header", () => {
    const note = os.addNote({ title: "Star me" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Star me" }));
    fireEvent.click(screen.getByTestId("note-star"));

    expect(os.getNote(note.id)?.pinned).toBe(true);
  });
});

describe("note details, related and quick capture", () => {
  it("shows created, updated, folder, tags, word count and reading time", () => {
    const folder = os.addFolder({ name: "Projects" }, now - 30 * DAY);
    os.addNote({ title: "Details", body: "one two three", folderId: folder.id, tags: ["work"] });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Details" }));

    const details = within(screen.getByTestId("notes-details"));
    expect(details.getByText("Created")).toBeDefined();
    expect(details.getByText("Word Count")).toBeDefined();
    expect(details.getByText("Reading Time")).toBeDefined();
    expect(details.getByText("3 words")).toBeDefined();
    expect(screen.getByTestId("note-folder-select").textContent).toContain("Projects");
  });

  it("lists related content and tasks from the note", () => {
    const project = os.addProject({ name: "MedoriQ Project" }, now - 40 * DAY);
    const note = os.addNote({ title: "Plan", projectId: project.id, tags: ["nextjs"] });
    os.addNote({ title: "Next.js Resources", tags: ["nextjs"] });
    os.convertNoteToTasks(note.id, now);

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Plan" }));

    const related = within(screen.getByTestId("notes-related"));
    expect(related.getByText("MedoriQ Project")).toBeDefined();
    expect(related.getByText("Next.js Resources")).toBeDefined();
    expect(related.getByTestId("note-task-count")).toBeDefined();
  });

  it("quick captures a note, task, event and idea", () => {
    renderNotes();

    fireEvent.change(screen.getByLabelText("Quick capture"), { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByTestId("notes-capture-task"));
    expect(Object.values(os.getState().tasks).map((task) => task.title)).toContain("Buy milk");

    fireEvent.change(screen.getByLabelText("Quick capture"), { target: { value: "Team sync" } });
    fireEvent.click(screen.getByTestId("notes-capture-event"));
    expect(Object.values(os.getState().events).map((event) => event.title)).toContain("Team sync");

    fireEvent.change(screen.getByLabelText("Quick capture"), { target: { value: "New idea" } });
    fireEvent.click(screen.getByTestId("notes-capture-idea"));
    expect(Object.values(os.getState().notes).map((note) => note.title)).toContain("New idea");
  });
});

describe("AI notes assistant", () => {
  it("summarizes the active note", () => {
    os.addNote({ title: "Summary", body: "The platform supports multiple roles. It uses Next.js. It scales well." });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Summary" }));
    fireEvent.click(screen.getByTestId("notes-assistant-summarize"));

    expect(screen.getByTestId("notes-assistant-answer").textContent!.length).toBeGreaterThan(0);
  });

  it("converts the note into tasks", () => {
    const note = os.addNote({ title: "Actionable plan" });
    os.updateNoteBlocks(note.id, [
      { id: "c1", type: "checkList", content: "Write the docs", attrs: { checked: false } },
      { id: "c2", type: "checkList", content: "Review the docs", attrs: { checked: false } },
    ]);

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Actionable plan" }));
    fireEvent.click(screen.getByTestId("notes-assistant-tasks"));

    const tasks = Object.values(os.getState().tasks).map((task) => task.title);
    expect(tasks).toContain("Write the docs");
    expect(tasks).toContain("Review the docs");
    expect(screen.getByTestId("notes-assistant-answer").textContent).toContain("2 tasks");
  });

  it("appends a project plan", () => {
    const note = os.addNote({ title: "Planning" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Planning" }));
    const before = os.getNote(note.id)!.blocks.length;
    fireEvent.click(screen.getByTestId("notes-assistant-plan"));

    expect(os.getNote(note.id)!.blocks.length).toBeGreaterThan(before);
    expect(os.getNote(note.id)!.blocks.some((block) => block.content === "Project plan")).toBe(true);
  });

  it("turns lists into action items", () => {
    const note = os.addNote({ title: "Lists" });
    os.updateNoteBlocks(note.id, [{ id: "l1", type: "bulletList", content: "Step one" }]);

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Lists" }));
    fireEvent.click(screen.getByTestId("notes-assistant-actions"));

    expect(os.getNote(note.id)!.blocks[0]!.type).toBe("checkList");
  });

  it("answers a reading-time question", () => {
    os.addNote({ title: "Long read", body: "word ".repeat(420) });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Long read" }));

    const input = screen.getByLabelText("Ask about this note");
    fireEvent.change(input, { target: { value: "how long to read" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByTestId("notes-assistant-answer").textContent).toContain("minute");
  });
});

describe("creating notes", () => {
  it("creates a note from the list", () => {
    renderNotes();

    fireEvent.click(screen.getByRole("button", { name: /Load sample notes/i }));
    const before = Object.keys(os.getState().notes).length;
    fireEvent.click(screen.getByLabelText("Search notes"));
    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "zzz-nomatch" } });
    fireEvent.click(screen.getByRole("button", { name: "New note" }));

    expect(Object.keys(os.getState().notes).length).toBe(before + 1);
  });

  it("keeps pinned notes first in the list", () => {
    os.addNote({ title: "Normal", updatedAt: now - DAY } as never);
    os.addNote({ title: "Pinned", pinned: true });

    renderNotes();
    const items = screen.getAllByTestId("note-list-item");
    expect(within(items[0]!).getByText("Pinned")).toBeDefined();
  });
});
describe("notes page fixes", () => {
  it("shows a trash folder and permanently deletes from it", () => {
    const note = os.addNote({ title: "Old draft" });
    os.deleteNote(note.id);

    renderNotes();

    fireEvent.click(screen.getByTestId("notes-folder-Trash"));
    expect(screen.getByText("Old draft")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Old draft options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete permanently" }));

    expect(os.getNote(note.id)).toBeNull();
  });

  it("restores a trashed note from the trash folder", () => {
    const note = os.addNote({ title: "Recover me" });
    os.deleteNote(note.id);

    renderNotes();
    fireEvent.click(screen.getByTestId("notes-folder-Trash"));
    fireEvent.click(screen.getByRole("button", { name: /Recover me options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore note" }));

    expect(os.getNote(note.id)?.status).toBe("active");
  });

  it("restores an archived note from the archive folder", () => {
    const note = os.addNote({ title: "Shelf it" });
    os.archiveNote(note.id);

    renderNotes();
    fireEvent.click(screen.getByTestId("notes-folder-Archive"));
    fireEvent.click(screen.getByRole("button", { name: /Shelf it options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore note" }));

    expect(os.getNote(note.id)?.status).toBe("active");
  });

  it("does not duplicate a tag added twice", () => {
    const note = os.addNote({ title: "Tagged twice" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Tagged twice" }));

    const input = screen.getByLabelText("Add tag");
    fireEvent.change(input, { target: { value: "ideas" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "#IDEAS" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(os.getNote(note.id)?.tags).toEqual(["ideas"]);
  });

  it("does not answer the note assistant while typing", () => {
    const note = os.addNote({ title: "Ask me", body: "Hello world" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Ask me" }));
    expect(note.id).toBeDefined();

    fireEvent.change(screen.getByLabelText("Ask about this note"), {
      target: { value: "how long" },
    });
    expect(screen.queryByTestId("notes-assistant-answer")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByTestId("notes-assistant-answer").textContent).toContain("minute");
  });
});
describe("note history, backlinks, drag, reminders", () => {
  it("records block versions and restores one from history", () => {
    const note = os.addNote({ title: "Versioned", body: "First draft" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Versioned" }));
    os.updateNoteBlocks(note.id, [
      { id: "b1", type: "paragraph", content: "Second draft" },
    ]);

    expect(os.getNote(note.id)!.versions.length).toBe(1);
    expect(os.getNote(note.id)!.blocks[0]?.content).toBe("Second draft");

    fireEvent.click(screen.getByRole("button", { name: "Note options" }));
    const restoreItem = screen
      .getAllByRole("menuitem")
      .find((item) => item.textContent?.startsWith("Restore"));
    expect(restoreItem).toBeDefined();
    fireEvent.click(restoreItem!);

    expect(os.getNote(note.id)!.blocks[0]?.content).toBe("First draft");
  });

  it("shows backlinks from notes that link with [[title]]", () => {
    const target = os.addNote({ title: "Project Atlas" });
    os.addNote({ title: "Meeting notes", body: "Discussed [[Project Atlas]] today" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Project Atlas" }));

    const panel = screen.getByTestId("notes-backlinks");
    expect(within(panel).getByText("Meeting notes")).toBeDefined();

    fireEvent.click(within(panel).getByTestId("note-backlink"));
    expect(screen.getByLabelText("Note title")).toHaveProperty("value", "Meeting notes");
    expect(target.id).toBeDefined();
  });

  it("moves a note into a folder by drag and drop", () => {
    const note = os.addNote({ title: "Draggable" });
    const folder = os.addFolder({ name: "Research" });

    renderNotes();

    const card = screen.getByTestId("note-list-item");
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (key: string, value: string) => {
        store[key] = value;
      },
      getData: (key: string) => store[key] ?? "",
      effectAllowed: "",
      dropEffect: "",
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("notes-folder-Research"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("notes-folder-Research"), { dataTransfer });

    expect(os.getNote(note.id)?.folderId).toBe(folder.id);
  });

  it("adds and removes a note reminder", () => {
    const note = os.addNote({ title: "Remind me" });

    renderNotes();
    fireEvent.click(screen.getByRole("button", { name: "Open Remind me" }));

    const input = screen.getByLabelText("Reminder time") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-10-12T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(os.noteReminders(note.id)).toHaveLength(1);
    expect(screen.getByTestId("note-reminder")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Remove reminder" }));
    expect(os.noteReminders(note.id)).toHaveLength(0);
  });
});