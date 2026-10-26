import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { NotebookWorkspace } from "./notebook-workspace";

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

function renderWorkspace() {
  return render(
    <ToastProvider>
      <NotebookWorkspace />
    </ToastProvider>,
  );
}

function seedNote(input: {
  title: string;
  notebook?: string;
  body?: string;
  tags?: string[];
  ageDays?: number;
}) {
  const name = input.notebook ?? "Work";
  const notebook =
    os.notebooks().find((entry) => entry.title === name) ??
    os.addNotebook({ title: name }, now - 30 * DAY);
  const page = os.addPage(
    {
      notebookId: notebook.id,
      title: input.title,
      body: input.body ?? "",
      tags: input.tags ?? [],
    },
    now - (input.ageDays ?? 1) * DAY,
  );
  os.updatePage(page.id, { lastEditedAt: now - (input.ageDays ?? 1) * DAY });
  return page;
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  installMatchMedia();
  now = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
  vi.spyOn(window, "prompt").mockReturnValue("Reading");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the header, collections, tags, notes list and the rail", () => {
    seedNote({ title: "A note" });

    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Digital Notebook" })).toBeDefined();
    expect(screen.getByTestId("notebook-menu")).toBeDefined();
    expect(screen.getByTestId("notebook-menu")).toBeDefined();
    expect(screen.getByTestId("notebook-list")).toBeDefined();
    expect(screen.getByTestId("notebook-assistant")).toBeDefined();
    expect(screen.getByTestId("notebook-quick-capture")).toBeDefined();
    expect(screen.getByTestId("notebook-recent")).toBeDefined();
  });

  it("lists notebooks with counts and filters the list", () => {
    seedNote({ title: "Work note", notebook: "Work" });
    seedNote({ title: "Home note", notebook: "Home" });

    renderWorkspace();

    const collections = within(screen.getByTestId("notebook-menu"));
    expect(within(collections.getByTestId("notebook-collection-Work")).getByText("1")).toBeDefined();

    fireEvent.click(collections.getByTestId("notebook-collection-Home"));
    expect(screen.getAllByTestId("notebook-note-row")).toHaveLength(1);
    expect(within(screen.getByTestId("notebook-note-row")).getByText("Home note")).toBeDefined();
  });

  it("counts tags and filters by tag", () => {
    seedNote({ title: "A", tags: ["work"] });
    seedNote({ title: "B", tags: ["work", "ideas"] });

    renderWorkspace();

    const tags = within(screen.getByTestId("notebook-menu"));
    expect(within(tags.getByTestId("notebook-collection-Work")).getByText("2")).toBeDefined();

    fireEvent.click(tags.getByTestId("notebook-tag-ideas"));
    expect(screen.getAllByTestId("notebook-note-row")).toHaveLength(1);
  });
});

describe("note list and layouts", () => {
  it("shows a note with its preview, tags and date", () => {
    seedNote({
      title: "Launch plan",
      body: "Feature list, timelines and next steps for the platform.",
      tags: ["project"],
    });

    renderWorkspace();

    const row = screen.getByTestId("notebook-note-row");
    expect(within(row).getByText("Launch plan")).toBeDefined();
    expect(within(row).getByText(/Feature list/)).toBeDefined();
    expect(within(row).getByText("#project")).toBeDefined();
  });

  it("switches between list, grid and timeline", () => {
    seedNote({ title: "One" });

    renderWorkspace();

    fireEvent.click(screen.getByTestId("notebook-layout-grid"));
    expect(screen.getByTestId("notebook-grid")).toBeDefined();
    expect(screen.getByTestId("notebook-note-card")).toBeDefined();

    fireEvent.click(screen.getByTestId("notebook-layout-timeline"));
    expect(screen.getByTestId("notebook-timeline")).toBeDefined();

    fireEvent.click(screen.getByTestId("notebook-layout-list"));
    expect(screen.getByTestId("notebook-list")).toBeDefined();
  });

  it("searches notes", () => {
    seedNote({ title: "Roadmap" });
    seedNote({ title: "Groceries" });

    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "roadmap" } });
    expect(screen.getAllByTestId("notebook-note-row")).toHaveLength(1);
  });
});

describe("load default data", () => {
  it("seeds notebooks and notes from the overflow menu", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Notebook page options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    const notebooks = Object.values(os.getState().notebooks);
    const pages = Object.values(os.getState().pages);
    expect(notebooks.length).toBeGreaterThan(5);
    expect(pages.length).toBeGreaterThan(8);
    expect(screen.getAllByTestId("notebook-note-row").length).toBeGreaterThan(8);
  });

  it("seeds the default set from the empty state", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Load default data" }));

    expect(Object.values(os.getState().pages).length).toBeGreaterThan(8);
  });
});

describe("quick capture and assistant", () => {
  it("captures a note from the rail", () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Quick capture note"), { target: { value: "Call the bank" } });
    fireEvent.click(screen.getByTestId("notebook-capture-save"));

    const pages = Object.values(os.getState().pages);
    expect(pages.map((page) => page.title)).toContain("Call the bank");
  });

  it("summarizes the selected note", () => {
    seedNote({ title: "Summary", body: "First point about the launch. Second point about pricing." });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open Summary" }));
    fireEvent.click(screen.getByTestId("notebook-assistant-summarize"));

    expect(screen.getByTestId("notebook-assistant-answer").textContent).toContain("First point");
  });

  it("turns the note into real tasks", () => {
    seedNote({
      title: "Actions",
      body: "I will send the pricing sheet to finance. We should book the review call.",
    });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open Actions" }));
    fireEvent.click(screen.getByTestId("notebook-assistant-tasks"));

    const tasks = Object.values(os.getState().tasks).map((task) => task.title);
    expect(tasks.some((title) => title.includes("pricing sheet"))).toBe(true);
    expect(tasks.some((title) => title.includes("review call"))).toBe(true);
  });

  it("explains the note with its key terms", () => {
    seedNote({ title: "Terms", body: "automation pipeline deployment pipeline monitoring" });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open Terms" }));
    fireEvent.click(screen.getByTestId("notebook-assistant-ideas"));

    expect(screen.getByTestId("notebook-assistant-answer").textContent).toContain("Key terms");
  });
});

describe("the left menu", () => {
  it("keeps notebooks and tags in separate sections", () => {
    seedNote({ title: "A note", tags: ["work"] });

    renderWorkspace();

    const menu = screen.getByTestId("notebook-menu");
    expect(within(menu).getByTestId("notebook-collections")).toBeDefined();
    expect(within(menu).getByTestId("notebook-tags")).toBeDefined();
    expect(within(menu).getByRole("heading", { name: "Notebooks" })).toBeDefined();
    expect(within(menu).getByRole("heading", { name: "Tags" })).toBeDefined();
  });

  it("shows an icon in front of every notebook", () => {
    seedNote({ title: "A note", notebook: "Work" });

    renderWorkspace();

    const collections = screen.getByTestId("notebook-collections");
    const work = within(collections).getByTestId("notebook-collection-Work");
    expect(work.querySelector("svg")).not.toBeNull();
  });

  it("prefixes every tag with a hash", () => {
    seedNote({ title: "A note", tags: ["work"] });

    renderWorkspace();

    const tag = within(screen.getByTestId("notebook-tags")).getByTestId("notebook-tag-work");
    expect(tag.textContent).toContain("#");
    expect(tag.textContent).toContain("work");
  });

  it("has no vertical scroll on the menu", () => {
    renderWorkspace();
    const menu = screen.getByTestId("notebook-menu");
    expect(menu.className).not.toContain("overflow-y-auto");
    expect(menu.className).not.toContain("max-h-");
  });

  it("counts notes for every entry, including archived notebooks", () => {
    const work = os.addNotebook({ title: "Work" }, now - 30 * DAY);
    const archived = os.addNotebook({ title: "Old" }, now - 60 * DAY);
    os.updateNotebook(archived.id, { status: "archived" });
    os.addPage({ notebookId: work.id, title: "Kept", body: "kept" });
    os.addPage({ notebookId: archived.id, title: "Archived note", body: "archived" });

    renderWorkspace();

    const collections = screen.getByTestId("notebook-collections");
    expect(within(within(collections).getByTestId("notebook-collection-Work")).getByText("1")).toBeDefined();
    expect(within(within(collections).getByTestId("notebook-collection-Archived")).getByText("1")).toBeDefined();
    expect(within(within(collections).getByTestId("notebook-collection-All Notes")).getByText("2")).toBeDefined();
  });

  it("merges notebooks that share a name so nothing is listed twice", () => {
    const first = os.addNotebook({ title: "Personal" }, now - 30 * DAY);
    const second = os.addNotebook({ title: "Personal" }, now - 20 * DAY);
    os.addPage({ notebookId: first.id, title: "One", body: "a" });
    os.addPage({ notebookId: second.id, title: "Two", body: "b" });

    renderWorkspace();

    const collections = screen.getByTestId("notebook-collections");
    expect(collections.querySelectorAll('[data-testid="notebook-collection-Personal"]')).toHaveLength(1);
    expect(within(within(collections).getByTestId("notebook-collection-Personal")).getByText("2")).toBeDefined();
  });

  it("keeps a notebook and a tag of the same name in their own sections", () => {
    const personal = os.addNotebook({ title: "Personal" }, now - 30 * DAY);
    os.addPage({ notebookId: personal.id, title: "In notebook", body: "a", tags: ["personal"] });

    renderWorkspace();

    expect(screen.getByTestId("notebook-collection-Personal")).toBeDefined();
    expect(screen.getByTestId("notebook-tag-personal")).toBeDefined();
  });

  it("keeps the default notebooks in a deliberate order", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Notebook page options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    const names = Array.from(
      screen.getByTestId("notebook-menu").querySelectorAll("li > button > span:nth-child(2)"),
    ).map((node) => node.textContent);
    expect(names.slice(0, 4)).toEqual(["All Notes", "Personal", "Work", "Projects"]);
  });

  it("does not create duplicate notebooks when the default data is loaded twice", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Notebook page options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));
    fireEvent.click(screen.getByRole("button", { name: "Notebook page options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    const titles = Object.values(os.getState().notebooks).map((notebook) => notebook.title);
    expect(titles.filter((title) => title === "Personal")).toHaveLength(1);
    expect(titles.filter((title) => title === "Work")).toHaveLength(1);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("editing and deleting notes", () => {
  it("opens the editor from the note title", () => {
    seedNote({ title: "Editable", body: "first draft" });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open Editable" }));

    const title = screen.getByLabelText("Title") as HTMLInputElement;
    expect(title.value).toBe("Editable");
    expect((screen.getByLabelText("Content") as HTMLTextAreaElement).value).toBe("first draft");
  });

  it("saves an edited title, body and tag", () => {
    const page = seedNote({ title: "Before", body: "old body" });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open Before" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "After" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "new body" } });
    fireEvent.change(screen.getByLabelText("Add tag"), { target: { value: "edited" } });
    fireEvent.keyDown(screen.getByLabelText("Add tag"), { key: "Enter" });
    fireEvent.click(screen.getByTestId("notebook-editor-save"));

    const updated = os.getPage(page.id)!;
    expect(updated.title).toBe("After");
    expect(updated.body).toBe("new body");
    expect(updated.tags).toContain("edited");
    expect(updated.wordCount).toBe(2);
  });

  it("edits a note from the row menu", () => {
    seedNote({ title: "Menu edit" });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Menu edit options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit note" }));

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Menu edit");
  });

  it("moves a note to trash from the row menu", () => {
    const page = seedNote({ title: "Throwaway" });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Throwaway options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to trash" }));

    expect(os.getPage(page.id)?.status).toBe("trashed");
    expect(screen.queryByText("Throwaway")).toBeNull();
  });

  it("deletes a note permanently from the editor", () => {
    const page = seedNote({ title: "Erase me" });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open Erase me" }));
    fireEvent.click(screen.getByRole("button", { name: /Move to trash/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm move to trash/ }));

    expect(os.getPage(page.id)?.status).toBe("trashed");
  });

  it("removes a tag from the editor", () => {
    const page = seedNote({ title: "Tagged", tags: ["work"] });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open Tagged" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove tag work" }));

    expect(os.getPage(page.id)?.tags).toEqual([]);
  });
});

describe("creating notes", () => {
  it("creates a note from the header button", () => {
    renderWorkspace();

    fireEvent.click(screen.getByTestId("notebook-new-note"));

    expect(Object.values(os.getState().pages)).toHaveLength(1);
  });
});





describe("notebook fixes", () => {
  it("restores a note from the trash collection", () => {
    const page = seedNote({ title: "Recover me" });
    os.deletePage(page.id);

    renderWorkspace();
    fireEvent.click(screen.getByTestId("notebook-collection-Trash"));
    fireEvent.click(screen.getByRole("button", { name: "Recover me options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore note" }));

    expect(os.getPage(page.id)?.status).toBe("active");
  });

  it("permanently deletes a trashed note", () => {
    const page = seedNote({ title: "Gone forever" });
    os.deletePage(page.id);

    renderWorkspace();
    fireEvent.click(screen.getByTestId("notebook-collection-Trash"));
    fireEvent.click(screen.getByRole("button", { name: "Gone forever options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete forever" }));

    expect(os.getPage(page.id)).toBeNull();
  });

  it("creates a note in the selected notebook", () => {
    const reading = os.addNotebook({ title: "Reading" }, now - 20 * DAY);

    renderWorkspace();
    fireEvent.click(screen.getByTestId("notebook-collection-Reading"));
    fireEvent.click(screen.getByTestId("notebook-new-note"));

    const created = Object.values(os.getState().pages).find(
      (page) => page.notebookId === reading.id,
    );
    expect(created).toBeDefined();
  });

  it("opens the editor from the timeline view", () => {
    seedNote({ title: "Timeline note" });

    renderWorkspace();
    fireEvent.click(screen.getByTestId("notebook-layout-timeline"));
    fireEvent.click(screen.getByRole("button", { name: "Timeline note" }));

    expect(screen.getByLabelText("Title")).toBeDefined();
  });

  it("renames and archives a notebook from its menu", () => {
    const notebook = os.addNotebook({ title: "Old notebook" }, now - 20 * DAY);

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Old notebook notebook options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(os.getNotebook(notebook.id)?.title).toBe("Reading");

    fireEvent.click(screen.getByRole("button", { name: "Reading notebook options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive notebook" }));
    expect(os.getNotebook(notebook.id)?.status).toBe("archived");
  });

  it("formats quick capture text with the toolbar", () => {
    renderWorkspace();
    const area = screen.getByLabelText("Quick capture note") as HTMLTextAreaElement;

    fireEvent.change(area, { target: { value: "hello" } });
    area.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect((screen.getByLabelText("Quick capture note") as HTMLTextAreaElement).value).toBe(
      "**hello**",
    );
  });

  it("uses the full note body for the assistant", () => {
    seedNote({
      title: "Long note",
      body: `${"filler ".repeat(40)}I will send the invoice.`,
    });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Open Long note" }));
    fireEvent.click(screen.getByTestId("notebook-assistant-tasks"));

    expect(
      Object.values(os.getState().tasks).some((task) => task.title.includes("invoice")),
    ).toBe(true);
  });
});