import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBlock, type NoteBlock } from "@personalos/core";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { BlockEditor } from "./block-editor";
import { NotebookEditorModule } from "./notebook-editor";
import { NotebookModule } from "./notebook-module";
import { NotebookPagesModule } from "./notebook-pages-module";

afterEach(cleanup);

function wrap(node: React.ReactElement) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

beforeEach(() => {
  getOS().clearAll();
  getOS().hydrate();
});

describe("NotebookModule", () => {
  it("shows the empty state before any notebook exists", () => {
    wrap(<NotebookModule />);
    expect(screen.getByText("No notebooks yet")).toBeDefined();
  });

  it("creates a notebook through the dialog", () => {
    const os = getOS();
    wrap(<NotebookModule />);

    fireEvent.click(screen.getByRole("button", { name: /create a notebook/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Notebook title"), {
      target: { value: "Research log" },
    });
    fireEvent.change(within(dialog).getByLabelText("Notebook description"), {
      target: { value: "Long reads" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create notebook" }));

    const notebooks = Object.values(os.getState().notebooks);
    expect(notebooks).toHaveLength(1);
    expect(notebooks[0]!.title).toBe("Research log");
  });

  it("lists a notebook with its page and word counts", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Essays" });
    os.addPage({ notebookId: nb.id, title: "On attention", body: "one two three" });

    wrap(<NotebookModule />);
    const grid = screen.getByTestId("notebook-grid");
    expect(within(grid).getByText("Essays")).toBeDefined();
    expect(within(grid).getByText("1 pages")).toBeDefined();
  });

  it("filters notebooks by their page content", () => {
    const os = getOS();
    const a = os.addNotebook({ title: "Work" });
    os.addNotebook({ title: "Personal" });
    os.addPage({ notebookId: a.id, title: "Quarterly review", body: "budget forecast" });

    wrap(<NotebookModule />);
    fireEvent.change(screen.getByLabelText("Search notebooks"), { target: { value: "forecast" } });

    const grid = within(screen.getByTestId("notebook-grid"));
    expect(grid.getByText("Work")).toBeDefined();
    expect(grid.queryByText("Personal")).toBeNull();
  });

  it("archives a notebook from the manage list", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Old drafts" });

    wrap(<NotebookModule />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Old drafts" }));
    fireEvent.click(screen.getByRole("button", { name: /archive/i }));

    expect(os.getNotebook(nb.id)?.status).toBe("archived");
  });
});

describe("NotebookPagesModule", () => {
  it("reports a missing notebook instead of crashing", () => {
    wrap(<NotebookPagesModule notebookId="nope" />);
    expect(screen.getByText("Notebook not found")).toBeDefined();
  });

  it("creates a page in the notebook", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });

    wrap(<NotebookPagesModule notebookId={nb.id} />);
    fireEvent.click(screen.getByRole("button", { name: /new page/i }));

    expect(Object.values(os.getState().pages)).toHaveLength(1);
  });

  it("lists pages and hides trashed ones", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    const keep = os.addPage({ notebookId: nb.id, title: "Kept page" });
    const gone = os.addPage({ notebookId: nb.id, title: "Gone page" });
    os.deletePage(gone.id);

    wrap(<NotebookPagesModule notebookId={nb.id} />);
    expect(screen.getByText("Kept page")).toBeDefined();
    expect(screen.queryByText("Gone page")).toBeNull();
    expect(keep.status).toBe("active");
  });

  it("searches pages by title", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    os.addPage({ notebookId: nb.id, title: "Alpha draft" });
    os.addPage({ notebookId: nb.id, title: "Beta draft" });

    wrap(<NotebookPagesModule notebookId={nb.id} />);
    fireEvent.change(screen.getByLabelText("Search pages"), { target: { value: "alpha" } });

    expect(screen.getByText("Alpha draft")).toBeDefined();
    expect(screen.queryByText("Beta draft")).toBeNull();
  });

  it("filters pages by tag", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    os.addPage({ notebookId: nb.id, title: "Tagged page", tags: ["work"] });
    os.addPage({ notebookId: nb.id, title: "Plain page", tags: ["home"] });

    wrap(<NotebookPagesModule notebookId={nb.id} />);
    fireEvent.click(screen.getByRole("button", { name: "work" }));

    expect(screen.getByText("Tagged page")).toBeDefined();
    expect(screen.queryByText("Plain page")).toBeNull();
  });

  it("reorders pages when moving one up", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    os.addPage({ notebookId: nb.id, title: "First" });
    os.addPage({ notebookId: nb.id, title: "Second" });

    wrap(<NotebookPagesModule notebookId={nb.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Second up" }));

    expect(os.notebookPages(nb.id).map((page) => page.title)).toEqual(["Second", "First"]);
  });
});

describe("BlockEditor", () => {
  function Harness({ initial }: { initial: NoteBlock[] }) {
    const [blocks, setBlocks] = React.useState(initial);
    return (
      <div>
        <BlockEditor blocks={blocks} onChange={setBlocks} />
        <output data-testid="count">{blocks.length}</output>
      </div>
    );
  }

  it("renders one control per top-level block", () => {
    wrap(
      <Harness
        initial={[
          { id: "a", type: "paragraph", content: "First line" },
          { id: "b", type: "heading", content: "A heading", attrs: { level: 1 } },
        ]}
      />,
    );
    expect(screen.getByLabelText("Paragraph")).toBeDefined();
    expect(screen.getByLabelText("Heading level 1")).toBeDefined();
  });

  it("updates content as you type", () => {
    const onChange = vi.fn();
    wrap(
      <BlockEditor
        blocks={[{ id: "a", type: "paragraph", content: "Hello" }]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Paragraph"), { target: { value: "Hello there" } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0]![0] as NoteBlock[];
    expect(next[0]!.content).toBe("Hello there");
  });

  it("splits a paragraph when Enter is pressed", () => {
    render(
      <ToastProvider>
        <Harness initial={[{ id: "a", type: "paragraph", content: "onetwo" }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Paragraph");
    (input as HTMLTextAreaElement).setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("removes a block", () => {
    render(
      <ToastProvider>
        <Harness
          initial={[
            { id: "a", type: "paragraph", content: "One" },
            { id: "b", type: "paragraph", content: "Two" },
          ]}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Remove block" })[0]!);
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("changes a block type from the type menu", () => {
    const onChange = vi.fn();
    wrap(
      <BlockEditor blocks={[{ id: "a", type: "paragraph", content: "Make me a quote" }]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change block type" }));
    fireEvent.click(screen.getByRole("button", { name: "Quote" }));

    const next = onChange.mock.calls[0]![0] as NoteBlock[];
    expect(next[0]!.type).toBe("blockquote");
  });

  it("toggles a checklist item", () => {
    const onChange = vi.fn();
    wrap(
      <BlockEditor blocks={[{ id: "a", type: "checkList", content: "Do it" }]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle checked" }));

    const next = onChange.mock.calls[0]![0] as NoteBlock[];
    expect(next[0]!.attrs?.checked).toBe(true);
  });

  it("offers a seed control when there are no blocks", () => {
    const onChange = vi.fn();
    wrap(<BlockEditor blocks={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add your first block/i }));

    const next = onChange.mock.calls[0]![0] as NoteBlock[];
    expect(next).toHaveLength(1);
  });
});

describe("NotebookEditorModule", () => {
  it("shows a not-found state for a missing page", () => {
    wrap(<NotebookEditorModule notebookId="nb1" pageId="nope" />);
    expect(screen.getByText("Page not found")).toBeDefined();
  });

  it("edits the page title", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    const page = os.addPage({ notebookId: nb.id, title: "Draft" });

    wrap(<NotebookEditorModule notebookId={nb.id} pageId={page.id} />);
    fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Final draft" } });

    expect(os.getPage(page.id)?.title).toBe("Final draft");
  });

  it("adds and removes tags", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    const page = os.addPage({ notebookId: nb.id, title: "Draft" });

    wrap(<NotebookEditorModule notebookId={nb.id} pageId={page.id} />);
    fireEvent.change(screen.getByLabelText("Add tag"), { target: { value: "urgent" } });
    fireEvent.keyDown(screen.getByLabelText("Add tag"), { key: "Enter" });

    expect(os.getPage(page.id)?.tags).toContain("urgent");

    fireEvent.click(screen.getByRole("button", { name: "Remove tag urgent" }));
    expect(os.getPage(page.id)?.tags).not.toContain("urgent");
  });

  it("shows a table of contents once there are two headings", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    const page = os.addPage({ notebookId: nb.id, title: "Structured" });
    os.updatePageBlocks(page.id, [
      { ...createBlock("heading", "Alpha"), attrs: { level: 1 } },
      { ...createBlock("heading", "Beta"), attrs: { level: 2 } },
    ]);

    wrap(<NotebookEditorModule notebookId={nb.id} pageId={page.id} />);
    expect(screen.getByRole("complementary", { name: "Table of contents" })).toBeDefined();
  });

  it("lists inbound backlinks", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    const target = os.addPage({ notebookId: nb.id, title: "Target page" });
    const source = os.addPage({ notebookId: nb.id, title: "Source page" });
    os.addPageRef(source.id, { type: "page", id: target.id, label: "Target page" });

    wrap(<NotebookEditorModule notebookId={nb.id} pageId={target.id} />);
    expect(screen.getByTestId("notebook-links")).toBeDefined();
    expect(screen.getAllByText("Source page").length).toBeGreaterThan(0);
  });

  it("inserts assistant outline blocks into the page", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    const page = os.addPage({ notebookId: nb.id, title: "Essay" });

    wrap(<NotebookEditorModule notebookId={nb.id} pageId={page.id} />);
    fireEvent.click(screen.getByRole("button", { name: /outline/i }));
    fireEvent.click(screen.getByRole("button", { name: /insert into page/i }));

    const updated = os.getPage(page.id)!;
    expect(updated.blocks.length).toBeGreaterThan(1);
    expect(updated.blocks.some((block) => block.type === "heading")).toBe(true);
  });

  it("moves the page to trash", () => {
    const os = getOS();
    const nb = os.addNotebook({ title: "Research" });
    const page = os.addPage({ notebookId: nb.id, title: "Doomed" });

    wrap(<NotebookEditorModule notebookId={nb.id} pageId={page.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Move page to trash" }));
    fireEvent.click(screen.getByRole("button", { name: "Move to trash" }));

    expect(os.getPage(page.id)?.status).toBe("trashed");
  });
});