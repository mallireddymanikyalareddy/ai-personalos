import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import type { NoteBlock } from "../../types/note";
import type { Notebook, Page } from "../../types/knowledge";
import { createNotebook, createPage } from "../../types/knowledge";

import {
  appendBlock,
  blockText,
  blocksToMarkdown,
  canIndentBlock,
  changeBlockType,
  createBlock,
  cycleHeadingLevel,
  flattenBlocks,
  headingLevel,
  indentBlock,
  insertBlockAfter,
  isPageRefType,
  listNotebooks,
  listPages,
  mergeBlockWithPrevious,
  moveBlock,
  notebookStats,
  notebookTagIndex,
  notebookToMarkdown,
  outdentBlock,
  pageLinks,
  pageRefSuggestions,
  pageToMarkdown,
  pageToc,
  pagesLinkingTo,
  parseMentions,
  promoteNoteToPageInput,
  removeBlock,
  reorderPages,
  resolveRefTitle,
  safeFileName,
  searchNotebookPages,
  splitBlock,
  suggestedRelatedPages,
  toggleCheckList,
  tocTree,
  updateBlockContent,
} from "./index";

let seq = 0;

function makeNotebook(id: string, overrides: Partial<Notebook> = {}): Notebook {
  return { ...createNotebook({ title: "Research" }, 1), id, ...overrides };
}

function makePage(id: string, notebookId: string, overrides: Partial<Page> = {}): Page {
  seq += 1;
  return {
    ...createPage({ notebookId, title: id, body: "" }, seq),
    id,
    ...overrides,
  };
}

function stateWith(
  options: {
    notebooks?: Notebook[];
    pages?: Page[];
    notes?: Record<string, { id: string; title: string; status: string }>;
  } = {},
): AppState {
  const notebooks = options.notebooks ?? [makeNotebook("nb1")];
  const pages = options.pages ?? [
    makePage("p1", "nb1", {
      title: "Alpha",
      body: "first body",
      blocks: [{ id: "a1", type: "paragraph", content: "first body" }],
      tags: ["core"],
      wordCount: 2,
      searchVector: "alpha first body",
      lastEditedAt: 10,
    }),
    makePage("p2", "nb1", {
      title: "Beta",
      body: "second body",
      blocks: [{ id: "b1", type: "paragraph", content: "second body" }],
      tags: ["side"],
      wordCount: 2,
      searchVector: "beta second body",
      lastEditedAt: 20,
    }),
    makePage("p3", "nb1", {
      title: "Trashed",
      body: "gone",
      status: "trashed",
      trashedAt: 99,
      searchVector: "trashed gone",
      lastEditedAt: 30,
    }),
  ];

  return {
    notebooks: Object.fromEntries(notebooks.map((entry) => [entry.id, entry])),
    pages: Object.fromEntries(pages.map((entry) => [entry.id, entry])),
    notes: options.notes ?? {},
    tasks: {},
    events: {},
    goals: {},
    habits: {},
    lifeMemories: {},
    journalEntries: {},
    documents: {},
    meetings: {},
  } as unknown as AppState;
}

describe("notebook blocks", () => {
  it("appends and inserts blocks relative to an anchor", () => {
    const a = createBlock("paragraph", "a");
    const b = createBlock("paragraph", "b");
    const withB = appendBlock([a], b);
    expect(withB.map((entry) => entry.id)).toEqual([a.id, b.id]);

    const c = createBlock("paragraph", "c");
    const inserted = insertBlockAfter(withB, b.id, c);
    expect(inserted.map((entry) => entry.content)).toEqual(["a", "b", "c"]);
  });

  it("updates block content at any depth", () => {
    const child = createBlock("paragraph", "child");
    const parent: NoteBlock = { ...createBlock("bulletList", "parent"), children: [child] };
    const updated = updateBlockContent([parent], child.id, "changed");
    expect(flattenBlocks(updated)[1]!.block.content).toBe("changed");
  });

  it("removes a nested block", () => {
    const child = createBlock("paragraph", "child");
    const blocks: NoteBlock[] = [{ ...createBlock("bulletList", "parent"), children: [child] }];
    expect(flattenBlocks(removeBlock(blocks, child.id))).toHaveLength(1);
  });

  it("indents a list item under the previous list item", () => {
    const first = createBlock("bulletList", "first");
    const second = createBlock("bulletList", "second");
    expect(canIndentBlock([first, second], second.id)).toBe(true);

    const indented = indentBlock([first, second], second.id);
    expect(indented).toHaveLength(1);
    expect(indented[0]!.children?.map((entry) => entry.content)).toEqual(["second"]);
  });

  it("refuses to indent past the start or onto a non-list block", () => {
    const first = createBlock("bulletList", "first");
    const second = createBlock("bulletList", "second");
    expect(canIndentBlock([first, second], first.id)).toBe(false);

    const heading = createBlock("heading", "h");
    const para = createBlock("paragraph", "p");
    expect(canIndentBlock([heading, para], para.id)).toBe(false);
  });

  it("outdents a nested block into the parent level", () => {
    const child = createBlock("bulletList", "child");
    const first: NoteBlock = { ...createBlock("bulletList", "first"), children: [child] };
    const second = createBlock("bulletList", "second");

    const outdented = outdentBlock([first, second], child.id);
    expect(outdented.map((entry) => entry.content)).toEqual(["first", "child", "second"]);
    expect(outdented[0]!.children).toBeUndefined();
  });

  it("moves blocks up and down within their sibling list", () => {
    const a = createBlock("paragraph", "a");
    const b = createBlock("paragraph", "b");
    const c = createBlock("paragraph", "c");
    const blocks = [a, b, c];

    expect(moveBlock(blocks, c.id, "up").map((entry) => entry.content)).toEqual(["a", "c", "b"]);
    expect(moveBlock(blocks, a.id, "up").map((entry) => entry.content)).toEqual(["a", "b", "c"]);
    expect(moveBlock(blocks, a.id, "down").map((entry) => entry.content)).toEqual(["b", "a", "c"]);
  });

  it("cycles heading levels within 1..6", () => {
    const heading = createBlock("heading", "Title");
    const once = cycleHeadingLevel([heading], heading.id);
    expect(headingLevel(once[0]!)).toBe(2);

    let bumped = once;
    for (let i = 0; i < 8; i += 1) {
      bumped = cycleHeadingLevel(bumped, heading.id, 1);
    }
    expect(headingLevel(bumped[0]!)).toBe(6);
  });

  it("drops children when a block becomes a divider", () => {
    const child = createBlock("paragraph", "child");
    const parent: NoteBlock = { ...createBlock("bulletList", "parent"), children: [child] };
    const changed = changeBlockType([parent], parent.id, "divider");
    expect(changed[0]!.type).toBe("divider");
    expect(changed[0]!.children).toBeUndefined();
  });

  it("toggles checklist state", () => {
    const item = createBlock("checkList", "task");
    const once = toggleCheckList([item], item.id);
    expect(once[0]!.attrs?.checked).toBe(true);
    expect(toggleCheckList(once, item.id)[0]!.attrs?.checked).toBe(false);
  });

  it("splits a block at the caret", () => {
    const text = createBlock("paragraph", "hello world");
    const result = splitBlock([text], text.id, 5);
    expect(flattenBlocks(result.blocks).map((entry) => entry.block.content)).toEqual([
      "hello",
      " world",
    ]);
    expect(result.blocks[1]!.id).toBe(result.nextId);
  });

  it("keeps list type when splitting a list item", () => {
    const item = createBlock("bulletList", "abc");
    expect(splitBlock([item], item.id, 1).blocks[1]!.type).toBe("bulletList");
  });

  it("merges a block with the previous sibling", () => {
    const a = createBlock("paragraph", "one ");
    const b = createBlock("paragraph", "two");
    expect(mergeBlockWithPrevious([a, b], b.id).map((entry) => entry.content)).toEqual(["one two"]);
  });

  it("concatenates nested text via blockText", () => {
    const child = createBlock("paragraph", "kid");
    const parent: NoteBlock = { ...createBlock("bulletList", "parent"), children: [child] };
    expect(blockText(parent)).toBe("parent kid");
  });
});

describe("notebook table of contents", () => {
  it("collects headings with levels and skips empties", () => {
    const blocks: NoteBlock[] = [
      { ...createBlock("heading", "Intro"), attrs: { level: 1 } },
      { ...createBlock("heading", "Detail"), attrs: { level: 2 } },
      { ...createBlock("heading", "   "), attrs: { level: 2 } },
      createBlock("paragraph", "body"),
    ];
    const toc = pageToc(blocks);
    expect(toc.map((entry) => entry.title)).toEqual(["Intro", "Detail"]);
    expect(toc[1]!.level).toBe(2);
  });

  it("nests deeper headings under shallower ones", () => {
    const tree = tocTree([
      { ...createBlock("heading", "One"), attrs: { level: 1 } },
      { ...createBlock("heading", "Two"), attrs: { level: 2 } },
      { ...createBlock("heading", "Three"), attrs: { level: 3 } },
      { ...createBlock("heading", "Back"), attrs: { level: 1 } },
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0]!.children[0]!.title).toBe("Two");
    expect(tree[0]!.children[0]!.children[0]!.title).toBe("Three");
    expect(tree[1]!.title).toBe("Back");
  });
});

describe("notebook markdown", () => {
  it("renders each block type", () => {
    const blocks: NoteBlock[] = [
      { ...createBlock("heading", "Title"), attrs: { level: 2 } },
      createBlock("paragraph", "Body text"),
      createBlock("bulletList", "first"),
      createBlock("orderedList", "second"),
      { ...createBlock("checkList", "done thing"), attrs: { checked: true } },
      createBlock("blockquote", "quoted"),
      { ...createBlock("codeBlock", "const x = 1"), attrs: { language: "ts" } },
      createBlock("divider", ""),
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain("## Title");
    expect(md).toContain("- first");
    expect(md).toContain("1. second");
    expect(md).toContain("- [x] done thing");
    expect(md).toContain("> quoted");
    expect(md).toContain("```ts");
    expect(md).toContain("---");
  });

  it("nests list children with indentation", () => {
    const child = createBlock("bulletList", "nested");
    const parent: NoteBlock = { ...createBlock("bulletList", "top"), children: [child] };
    expect(blocksToMarkdown([parent])).toBe("- top\n  - nested");
  });

  it("renders a page with title, tags, and optional toc", () => {
    const page = makePage("p1", "nb1", {
      title: "Alpha",
      tags: ["core"],
      blocks: [
        { ...createBlock("heading", "Alpha"), attrs: { level: 1 } },
        { ...createBlock("heading", "More"), attrs: { level: 2 } },
      ],
    });
    const md = pageToMarkdown(page, { toc: true });
    expect(md).toContain("# Alpha");
    expect(md).toContain("## Contents");
    expect(md).toContain("- [More](#more)");
    expect(md).toContain("#core");
  });

  it("renders a whole notebook with a page index", () => {
    const state = stateWith();
    const md = notebookToMarkdown(state.notebooks.nb1!, [
      state.pages.p1!,
      state.pages.p2!,
    ]);
    expect(md).toContain("# Research");
    expect(md).toContain("## Pages");
    expect(md).toContain("- [Alpha](#alpha)");
    expect(md).toContain("first body");
  });

  it("sanitizes filenames for export", () => {
    expect(safeFileName("Q1/Q2 plan")).toBe("Q1 Q2 plan");
    expect(safeFileName("   ")).toBe("untitled");
    expect(safeFileName("CON")).toBe("CON-page");
    expect(safeFileName("a:b*c?d")).toBe("a b c d");
  });
});

describe("notebook links", () => {
  it("validates ref types", () => {
    expect(isPageRefType("note")).toBe(true);
    expect(isPageRefType("life_memory")).toBe(true);
    expect(isPageRefType("banana")).toBe(false);
  });

  it("parses inline mentions and dedupes them", () => {
    const refs = parseMentions(
      "See [[note:n1|The Note]] and [[note:n1|The Note]] plus [[task:t1]] and [[bogus:x1]].",
    );
    expect(refs).toEqual([
      { type: "note", id: "n1", label: "The Note" },
      { type: "task", id: "t1", label: "" },
    ]);
  });

  it("merges explicit refs with inline mentions", () => {
    const page = makePage("p1", "nb1", {
      refs: [{ type: "note", id: "n1", label: "" }],
      blocks: [{ id: "m1", type: "paragraph", content: "link [[task:t1|Do the thing]]" }],
    });
    const links = pageLinks(page);
    expect(links).toHaveLength(2);
    expect(links.find((ref) => ref.type === "task")?.label).toBe("Do the thing");
  });

  it("finds inbound backlinks", () => {
    const state = stateWith({
      pages: [
        makePage("p1", "nb1", { title: "Alpha" }),
        makePage("p2", "nb1", {
          title: "Beta",
          blocks: [{ id: "x", type: "paragraph", content: "points at [[page:p1]]" }],
        }),
      ],
    });
    expect(pagesLinkingTo(state, { type: "page", id: "p1" }).map((entry) => entry.id)).toEqual([
      "p2",
    ]);
  });

  it("resolves a ref title from state", () => {
    const state = stateWith({ notes: { n1: { id: "n1", title: "A Note", status: "active" } } });
    expect(resolveRefTitle(state, { type: "note", id: "n1", label: "" })).toBe("A Note");
    expect(resolveRefTitle(state, { type: "note", id: "n9", label: "Fallback" })).toBe("Fallback");
  });

  it("suggests refs matching a query", () => {
    const state = stateWith({
      notes: { n1: { id: "n1", title: "Deep work notes", status: "active" } },
    });
    expect(pageRefSuggestions(state, "deep")).toEqual([
      { type: "note", id: "n1", label: "Deep work notes" },
    ]);
  });
});

describe("notebook queries", () => {
  it("lists active notebooks and hides archived", () => {
    const state = stateWith({
      notebooks: [makeNotebook("nb1"), makeNotebook("nb2", { title: "Old", status: "archived", order: 0 })],
    });
    expect(listNotebooks(state).map((entry) => entry.id)).toEqual(["nb1"]);
  });

  it("lists pages excluding trashed and ordered", () => {
    const state = stateWith();
    expect(listPages(state, "nb1").map((entry) => entry.id)).toEqual(["p1", "p2"]);
    expect(listPages(state, "nb1", true).map((entry) => entry.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("computes stats across pages", () => {
    const stats = notebookStats(stateWith(), "nb1");
    expect(stats.pageCount).toBe(2);
    expect(stats.wordCount).toBe(4);
    expect(stats.tagCount).toBe(2);
    expect(stats.lastEditedAt).toBe(20);
  });

  it("indexes tags across a notebook", () => {
    expect(notebookTagIndex(stateWith(), "nb1")).toEqual(["core", "side"]);
  });

  it("searches by title, vector, and tag", () => {
    const state = stateWith();
    expect(searchNotebookPages(state, "nb1", "beta").map((p) => p.id)).toEqual(["p2"]);
    expect(searchNotebookPages(state, "nb1", "second body").map((p) => p.id)).toEqual(["p2"]);
    expect(searchNotebookPages(state, "nb1", "core").map((p) => p.id)).toEqual(["p1"]);
    expect(searchNotebookPages(state, "nb1", "")).toHaveLength(2);
  });

  it("reorders pages by explicit id order", () => {
    expect(reorderPages(stateWith(), "nb1", ["p2", "p1"]).map((entry) => entry.id)).toEqual([
      "p2",
      "p1",
    ]);
  });

  it("suggests related pages by shared tags", () => {
    const state = stateWith({
      pages: [
        makePage("p1", "nb1", { title: "Alpha", tags: ["core"] }),
        makePage("p2", "nb1", { title: "Beta", tags: ["core", "side"] }),
      ],
    });
    expect(suggestedRelatedPages(state, state.pages.p1!).map((entry) => entry.id)).toEqual(["p2"]);
  });
});

describe("promote note to page", () => {
  it("builds page input from a note and keeps tags", () => {
    const note = {
      id: "n1",
      title: "  Essay draft  ",
      body: "Body text",
      blocks: [] as NoteBlock[],
      tags: ["writing"],
    } as never as Parameters<typeof promoteNoteToPageInput>[0];

    const input = promoteNoteToPageInput(note, "nb1");
    expect(input.title).toBe("Essay draft");
    expect(input.body).toBe("Body text");
    expect(input.tags).toEqual(["writing"]);
    expect(input.blocks).toHaveLength(1);
  });

  it("reuses existing note blocks when present", () => {
    const note = {
      id: "n2",
      title: "With blocks",
      body: "x",
      blocks: [createBlock("heading", "Intro")],
      tags: [],
    } as never as Parameters<typeof promoteNoteToPageInput>[0];

    const input = promoteNoteToPageInput(note, "nb1");
    expect(input.blocks).toHaveLength(1);
    expect(input.blocks![0]!.type).toBe("heading");
  });
});