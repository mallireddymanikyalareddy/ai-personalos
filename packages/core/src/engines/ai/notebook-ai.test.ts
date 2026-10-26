import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import type { Page } from "../../types/knowledge";

import { pageHeadingSummary, runNotebookAssistant } from "./notebook";

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "p1",
    type: "page",
    notebookId: "nb1",
    title: "Attention and the cost of switching",
    body: "",
    blocks: [
      { id: "b1", type: "heading", content: "Context", attrs: { level: 1 } },
      { id: "b2", type: "paragraph", content: "Task switching fragments attention and reduces throughput." },
      { id: "b3", type: "paragraph", content: "Attention recovers slowly, so every switch carries a tax." },
      { id: "b4", type: "heading", content: "Evidence", attrs: { level: 2 } },
      { id: "b5", type: "paragraph", content: "Batching similar work reduces the number of switches per hour." },
    ],
    tags: ["focus", "work"],
    folderId: null,
    icon: null,
    order: 1,
    status: "active",
    trashedAt: null,
    wordCount: 30,
    readingTimeMinutes: 1,
    searchVector: "attention",
    embedding: null,
    aiSummary: null,
    aiKeyPoints: [],
    aiEntities: [],
    relatedPageIds: [],
    refs: [],
    lastEditedAt: 100,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as Page;
}

function makeState(pages: Page[] = []): AppState {
  return {
    pages: Object.fromEntries(pages.map((page) => [page.id, page])),
    notebooks: {},
    notes: {},
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

describe("notebook assistant: outline", () => {
  it("produces a heading skeleton with a lead paragraph", () => {
    const result = runNotebookAssistant({ page: makePage(), action: "outline" }, makeState());
    expect(result.blocks).toBeDefined();
    const headings = result.blocks!.filter((block) => block.type === "heading");
    expect(headings.length).toBeGreaterThanOrEqual(4);
    expect(headings[0].content).toBe("Context");
    expect(result.blocks!.some((block) => block.type === "paragraph")).toBe(true);
  });

  it("uses the prompt as the focus of the lead line", () => {
    const result = runNotebookAssistant(
      { page: makePage(), action: "outline", prompt: "remote work" },
      makeState(),
    );
    const lead = result.blocks!.find((block) => block.type === "paragraph");
    expect(lead?.content).toContain("remote work");
  });

  it("falls back to the page title when no prompt is given", () => {
    const result = runNotebookAssistant({ page: makePage(), action: "outline" }, makeState());
    const lead = result.blocks!.find((block) => block.type === "paragraph");
    expect(lead?.content).toContain("Attention and the cost of switching");
  });
});

describe("notebook assistant: continue", () => {
  it("suggests three list items to push the page forward", () => {
    const result = runNotebookAssistant({ page: makePage(), action: "continue" }, makeState());
    const lists = result.blocks!.filter((block) => block.type === "bulletList");
    expect(lists).toHaveLength(3);
    expect(result.message).toContain("Continued");
  });

  it("anchors the continuation to the most recent heading", () => {
    const result = runNotebookAssistant({ page: makePage(), action: "continue" }, makeState());
    expect(result.blocks![0].content).toContain("Evidence");
  });
});

describe("notebook assistant: summarize", () => {
  it("summarises from the leading sentences", () => {
    const result = runNotebookAssistant({ page: makePage(), action: "summarize" }, makeState());
    expect(result.summary).toContain("Task switching fragments attention");
    expect(result.keyPoints?.length).toBeGreaterThan(0);
  });

  it("offers a proposal to persist the summary", () => {
    const result = runNotebookAssistant({ page: makePage(), action: "summarize" }, makeState());
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].capability).toBe("notebook_summarize");
    expect(result.proposals[0].risk).toBe("low");
  });

  it("explains itself when the page is empty", () => {
    const empty = makePage({ blocks: [] });
    const result = runNotebookAssistant({ page: empty, action: "summarize" }, makeState());
    expect(result.summary).toContain("still a sketch");
  });
});

describe("notebook assistant: backlinks", () => {
  it("reports when nothing is linked yet", () => {
    const page = makePage();
    const result = runNotebookAssistant({ page, action: "backlinks" }, makeState([page]));
    expect(result.message).toContain("No related pages yet");
    expect(result.proposals).toHaveLength(0);
  });

  it("proposes links to related pages in the same notebook", () => {
    const page = makePage();
    const sibling = makePage({
      id: "p2",
      title: "Deep work batching",
      tags: ["focus", "work"],
      blocks: [{ id: "x1", type: "paragraph", content: "Batching helps." }],
    });
    const result = runNotebookAssistant({ page, action: "backlinks" }, makeState([page, sibling]));
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].title).toBe("Link Deep work batching");
    expect(result.message).toContain("inbound page");
  });

  it("counts inbound links", () => {
    const page = makePage();
    const inbound = makePage({
      id: "p3",
      title: "Points here",
      tags: [],
      blocks: [{ id: "y1", type: "paragraph", content: "see [[page:p1]]" }],
    });
    const result = runNotebookAssistant({ page, action: "backlinks" }, makeState([page, inbound]));
    expect(result.message).toContain("1 inbound page");
  });
});

describe("notebook assistant: extract notes", () => {
  it("proposes a note per substantial sentence", () => {
    const result = runNotebookAssistant({ page: makePage(), action: "extract_notes" }, makeState());
    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.proposals[0].capability).toBe("create_note");
    expect(result.proposals.every((entry) => entry.risk === "low")).toBe(true);
  });

  it("says so when there is nothing to extract", () => {
    const stub = makePage({
      blocks: [{ id: "z1", type: "paragraph", content: "Hi." }],
    });
    const result = runNotebookAssistant({ page: stub, action: "extract_notes" }, makeState());
    expect(result.message).toContain("Nothing long enough");
    expect(result.proposals).toHaveLength(0);
  });
});

describe("page heading summary", () => {
  it("lists headings with levels in document order", () => {
    expect(pageHeadingSummary(makePage())).toEqual([
      { blockId: "b1", title: "Context", level: 1 },
      { blockId: "b4", title: "Evidence", level: 2 },
    ]);
  });
});