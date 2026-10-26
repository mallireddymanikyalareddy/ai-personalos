import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { PaperWorkspace } from "./paper-workspace";

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

function openPage(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Open ${name}` }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
}

function renderWorkspace() {
  return render(
    <ToastProvider>
      <PaperWorkspace />
    </ToastProvider>,
  );
}

function seedPage(input: {
  name: string;
  folderId?: string | null;
  tags?: string[];
  text?: string;
  favorite?: boolean;
  shared?: boolean;
  ageDays?: number;
}) {
  let notebook = os.paperNotebooks()[0];
  if (!notebook) {
    notebook = os.addPaperNotebook({ title: "Notebook" }, now - 30 * DAY);
    const autoPage = os.paperPages(notebook.id)[0];
    if (autoPage) os.deletePaperPage(autoPage.id);
  }
  const page = os.addPaperPage(
    {
      notebookId: notebook.id,
      name: input.name,
      kind: "typed",
      folderId: input.folderId ?? null,
      tags: input.tags ?? [],
      favorite: input.favorite ?? false,
      shared: input.shared ?? false,
      textContent: input.text ?? "",
    },
    now - (input.ageDays ?? 1) * DAY,
  );
  os.updatePaperPage(page.id, { updatedAt: now - (input.ageDays ?? 1) * DAY });
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
  vi.spyOn(window, "prompt").mockReturnValue("Meeting Notes");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the header, action cards, rails, grid and tools", () => {
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Digital Paper" })).toBeDefined();
    expect(screen.getByTestId("paper-folders")).toBeDefined();
    expect(screen.getByTestId("paper-tags")).toBeDefined();
    expect(screen.getByTestId("paper-grid")).toBeDefined();
    expect(screen.getByTestId("paper-assistant")).toBeDefined();
    expect(screen.getByTestId("paper-recent")).toBeDefined();
    expect(screen.getByTestId("paper-quick-capture")).toBeDefined();
    for (const id of ["quick", "template", "import", "scan", "summarize"]) {
      expect(screen.getByTestId(`paper-action-${id}`)).toBeDefined();
    }
  });

  it("lists folders and tags with live counts", () => {
    const folder = os.addPaperFolder({ name: "Work", color: "var(--chart-5)" }, now - 30 * DAY);
    seedPage({ name: "One", folderId: folder.id, tags: ["work"] });
    seedPage({ name: "Two", folderId: folder.id, tags: ["work", "ideas"] });

    renderWorkspace();

    const folders = within(screen.getByTestId("paper-folders"));
    expect(within(folders.getByTestId("paper-folder-Work")).getByText("2")).toBeDefined();

    const tags = within(screen.getByTestId("paper-tags"));
    expect(within(tags.getByTestId("paper-tag-work")).getByText("2")).toBeDefined();
  });
});

describe("page grid", () => {
  it("shows page cards with title, preview, tags and relative date", () => {
    seedPage({ name: "Launch plan", tags: ["work"], text: "High level plan and milestones.", ageDays: 0 });

    renderWorkspace();

    const card = screen.getByTestId("paper-card");
    expect(within(card).getByText("Launch plan")).toBeDefined();
    expect(within(card).getByText("High level plan and milestones.")).toBeDefined();
    expect(within(card).getByText("#work")).toBeDefined();
    expect(within(card).getByText(/Updated/)).toBeDefined();
  });

  it("filters by folder, tag and search", () => {
    const work = os.addPaperFolder({ name: "Work" }, now - 30 * DAY);
    seedPage({ name: "Roadmap", folderId: work.id, tags: ["work"] });
    seedPage({ name: "Groceries", tags: ["personal"] });

    renderWorkspace();

    fireEvent.click(screen.getByTestId("paper-folder-Work"));
    expect(screen.getAllByTestId("paper-card")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("paper-tag-personal"));
    expect(screen.getAllByTestId("paper-card")).toHaveLength(1);
    expect(within(screen.getByTestId("paper-card")).getByText("Groceries")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Search pages"), { target: { value: "zzz" } });
    expect(screen.queryAllByTestId("paper-card")).toHaveLength(0);
  });

  it("switches between the page views", () => {
    seedPage({ name: "Favourite", favorite: true });
    seedPage({ name: "Shared", shared: true });

    renderWorkspace();

    fireEvent.click(screen.getByTestId("paper-view-favorites"));
    expect(screen.getAllByTestId("paper-card")).toHaveLength(1);
    expect(within(screen.getByTestId("paper-card")).getByText("Favourite")).toBeDefined();

    fireEvent.click(screen.getByTestId("paper-view-shared"));
    expect(within(screen.getByTestId("paper-card")).getByText("Shared")).toBeDefined();
  });

  it("favourites and shares a page from the card menu", () => {
    const page = seedPage({ name: "Settable" });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Favourite Settable" }));
    expect(os.getPaperPage(page.id)?.favorite).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Share Settable" }));
    expect(os.getPaperPage(page.id)?.shared).toBe(true);
  });
});

describe("creating pages", () => {
  it("creates a quick note from the action card", () => {
    renderWorkspace();

    fireEvent.click(screen.getByTestId("paper-action-quick"));

    const pages = Object.values(os.getState().paperPages);
    expect(pages.some((page) => page.name === "Quick note")).toBe(true);
  });

  it("creates a template page from the action card", () => {
    renderWorkspace();

    fireEvent.click(screen.getByTestId("paper-action-template"));

    const pages = Object.values(os.getState().paperPages);
    expect(pages.some((page) => page.kind === "template")).toBe(true);
  });

  it("captures a quick note from the rail", () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Quick capture"), { target: { value: "Call the bank" } });
    fireEvent.click(screen.getByTestId("paper-capture-text"));

    const pages = Object.values(os.getState().paperPages);
    expect(pages.some((page) => page.textContent === "Call the bank")).toBe(true);
    expect(screen.getByTestId("paper-capture-text")).toBeDefined();
  });
});

describe("AI paper assistant", () => {
  it("summarizes the selected page", () => {
    seedPage({
      name: "Summary page",
      text: "First point about the launch. Second point about pricing. Third point about the team.",
    });

    renderWorkspace();

    openPage("Summary page");
    fireEvent.click(screen.getByTestId("paper-assistant-summarize"));

    const answer = screen.getByTestId("paper-assistant-answer").textContent ?? "";
    expect(answer).toContain("First point");
  });

  it("turns action items into real tasks", () => {
    seedPage({
      name: "Actions",
      text: "I will send the pricing sheet to finance today.\nWe should book the review call.",
    });

    renderWorkspace();

    openPage("Actions");
    fireEvent.click(screen.getByTestId("paper-assistant-tasks"));

    const tasks = Object.values(os.getState().tasks).map((task) => task.title);
    expect(tasks.some((title) => title.includes("pricing sheet"))).toBe(true);
    expect(tasks.some((title) => title.includes("review call"))).toBe(true);
  });

  it("rewrites the page into plain English", () => {
    const page = seedPage({ name: "Plain", text: "We are basically going to ship it." });

    renderWorkspace();

    openPage("Plain");
    fireEvent.click(screen.getByTestId("paper-assistant-improve"));

    expect(os.getPaperPage(page.id)?.textContent).toBe("We'll ship it.");
  });

  it("explains the document with its key terms", () => {
    seedPage({ name: "Terms", text: "automation pipeline deployment pipeline monitoring" });

    renderWorkspace();

    openPage("Terms");
    fireEvent.click(screen.getByTestId("paper-assistant-explain"));

    expect(screen.getByTestId("paper-assistant-answer").textContent).toContain("Key terms");
  });

  it("is disabled until a page is selected", () => {
    renderWorkspace();
    expect(screen.getByTestId("paper-assistant-summarize").hasAttribute("disabled")).toBe(true);
  });
});

describe("page editor and trash", () => {
  it("edits a page, recalculates words and saves the paper style", () => {
    const page = seedPage({ name: "Editable", text: "one two" });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Open Editable" }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renamed page" } });
    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "one two three four" },
    });
    fireEvent.change(screen.getByLabelText("Paper style"), { target: { value: "ruled" } });
    fireEvent.click(screen.getByTestId("paper-page-save"));

    const saved = os.getPaperPage(page.id)!;
    expect(saved.name).toBe("Renamed page");
    expect(saved.wordCount).toBe(4);
    expect(saved.template).toBe("ruled");
  });

  it("moves a page to trash and restores it from the trash folder", () => {
    const page = seedPage({ name: "Trash me" });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Open Trash me" }));
    fireEvent.click(screen.getByTestId("paper-page-trash"));
    expect(os.getPaperPage(page.id)?.status).toBe("trashed");

    fireEvent.click(screen.getByTestId("paper-folder-Trash"));
    const card = screen.getByTestId("paper-card");
    fireEvent.click(within(card).getByRole("button", { name: "Trash me options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore" }));

    expect(os.getPaperPage(page.id)?.status).toBe("active");
  });

  it("deletes a trashed page forever after confirmation", () => {
    const page = seedPage({ name: "Delete forever" });
    os.updatePaperPage(page.id, { status: "trashed" });

    renderWorkspace();
    fireEvent.click(screen.getByTestId("paper-folder-Trash"));
    const card = screen.getByTestId("paper-card");
    fireEvent.click(within(card).getByRole("button", { name: "Delete forever options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete forever" }));
    expect(os.getPaperPage(page.id)).not.toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "Delete forever options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Confirm delete forever" }));
    expect(os.getPaperPage(page.id)).toBeNull();
  });

  it("imports a text file as a page", async () => {
    renderWorkspace();
    const input = screen.getByLabelText("Import files") as HTMLInputElement;
    const file = new File(["hello world"], "notes.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        Object.values(os.getState().paperPages).some(
          (page) => page.name === "notes" && page.textContent === "hello world",
        ),
      ).toBe(true);
    });
  });

  it("loads sample papers only once", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Paper page options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load sample papers" }));
    const first = Object.keys(os.getState().paperPages).length;

    fireEvent.click(screen.getByRole("button", { name: "Paper page options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load sample papers" }));

    expect(Object.keys(os.getState().paperPages).length).toBe(first);
  });
});
describe("folders and previews", () => {
  it("renames and deletes a folder from its options menu", () => {
    const folder = os.addPaperFolder({ name: "Old folder" }, now - 10 * DAY);

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Old folder options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(os.paperFolders().find((entry) => entry.id === folder.id)?.name).toBe("Meeting Notes");

    fireEvent.click(screen.getByRole("button", { name: "Meeting Notes options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(os.paperFolders().some((entry) => entry.id === folder.id)).toBe(false);
  });

  it("renders a PDF preview inside the page editor", () => {
    const page = seedPage({ name: "Spec sheet" });
    const layer = os.paperLayers(page.id)[0]!;
    os.addPaperImage({
      notebookId: page.notebookId,
      pageId: page.id,
      layerId: layer.id,
      url: "blob:spec",
      name: "spec.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Open Spec sheet" }));

    expect(screen.getByText("PDF preview")).toBeDefined();
    expect(screen.getByTitle("spec.pdf")).toBeDefined();
  });

  it("opens the handwriting canvas from the page editor", async () => {
    seedPage({ name: "Sketch page" });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Open Sketch page" }));
    fireEvent.click(screen.getByTestId("paper-page-canvas"));

    expect(await screen.findByTestId("paper-canvas-dialog")).toBeDefined();
  });
});