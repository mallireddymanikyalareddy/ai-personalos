import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

describe("knowledge: notes", () => {
  it("creates a note with blocks and search vector", () => {
    const os = makeOS();
    const note = os.addNote({
      title: "Project kickoff",
      body: "We discussed the roadmap and milestones.",
      tags: ["work", "planning"],
    });

    expect(note.status).toBe("active");
    expect(note.blocks.length).toBeGreaterThan(0);
    expect(note.wordCount).toBeGreaterThan(0);
    expect(note.searchVector).toContain("roadmap");
  });

  it("soft-deletes then purges a note", () => {
    const os = makeOS();
    const note = os.addNote({ title: "Trash me" });

    os.deleteNote(note.id);
    expect(os.getNote(note.id)?.status).toBe("trashed");
    expect(os.getNote(note.id)?.trashedAt).not.toBeNull();

    os.deleteNote(note.id);
    expect(os.getNote(note.id)).toBeNull();
  });

  it("archives and restores a note", () => {
    const os = makeOS();
    const note = os.addNote({ title: "Archive me" });

    os.archiveNote(note.id);
    expect(os.getNote(note.id)?.status).toBe("archived");

    os.restoreNote(note.id);
    expect(os.getNote(note.id)?.status).toBe("active");
  });
});

describe("knowledge: notebooks, pages, folders", () => {
  it("creates a notebook and page", () => {
    const os = makeOS();
    const nb = os.addNotebook({ title: "Research" });
    const page = os.addPage({ notebookId: nb.id, title: "Semantic search", body: "Notes on embeddings." });

    expect(os.getNotebook(nb.id)?.title).toBe("Research");
    expect(os.getPage(page.id)?.notebookId).toBe(nb.id);
    expect(page.searchVector).toContain("embeddings");
  });

  it("builds a folder tree", () => {
    const os = makeOS();
    const root = os.addFolder({ name: "Work" });
    os.addFolder({ name: "Clients", parentId: root.id });

    const tree = os.getFolderTree();
    expect(tree).toHaveLength(1);
    expect(tree[0]!.folder.name).toBe("Work");
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.folder.name).toBe("Clients");
  });
});

describe("knowledge: search", () => {
  it("searches across notes", () => {
    const os = makeOS();
    os.addNote({ title: "Quarterly goals", body: "Ship the mobile app and grow revenue." });
    os.addNote({ title: "Groceries", body: "Buy oat milk and coffee." });

    const results = os.search({ query: "mobile app" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.title).toBe("Quarterly goals");
  });

  it("filters search by tags", () => {
    const os = makeOS();
    os.addNote({ title: "Roadmap", body: "Q4 plan", tags: ["work"] });
    os.addNote({ title: "Recipes", body: "Dinner ideas", tags: ["personal"] });

    const results = os.search({ query: "", tags: ["work"] });
    expect(results.some((r) => r.title === "Roadmap")).toBe(true);
    expect(results.some((r) => r.title === "Recipes")).toBe(false);
  });

  it("returns related items by shared tags", () => {
    const os = makeOS();
    os.addNote({ title: "A", tags: ["shared", "a"] });
    os.addNote({ title: "B", tags: ["shared", "b"] });
    os.addNote({ title: "C", tags: ["unrelated"] });

    const notes = Object.values(os.getState().notes);
    const a = notes.find((n) => n.title === "A")!;
    const related = os.getRelatedItems(a.id, "note");
    expect(related.some((r) => r.title === "B")).toBe(true);
  });
});

describe("knowledge: tagging", () => {
  it("suggests tags from content", () => {
    const os = makeOS();
    const tags = os.suggestTags("The project roadmap covers the mobile app launch for the client.");
    expect(tags.length).toBeGreaterThan(0);
  });

  it("extracts entities from text", () => {
    const os = makeOS();
    const entities = os.extractEntities("Email ada@example.com and visit https://example.com on 2026-01-15.");
    expect(entities.some((e) => e.type === "email")).toBe(true);
    expect(entities.some((e) => e.type === "url")).toBe(true);
    expect(entities.some((e) => e.type === "date")).toBe(true);
  });
});

describe("knowledge: relationships and embeddings", () => {
  it("links two notes with a relationship", () => {
    const os = makeOS();
    const a = os.addNote({ title: "A" });
    const b = os.addNote({ title: "B" });

    os.addKnowledgeRelationship({
      sourceType: "note",
      sourceId: a.id,
      targetType: "note",
      targetId: b.id,
      type: "references",
      confidence: 0.9,
    });

    const graph = os.getKnowledgeGraph();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.type).toBe("references");
  });

  it("runs semantic search after embedding rebuild", () => {
    const os = makeOS();
    os.addNote({ title: "Deep work", body: "Focus on the writing project without distraction." });
    os.rebuildAllEmbeddings();

    const results = os.semanticSearch("writing project");
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("knowledge: inbox", () => {
  it("creates and triages inbox items", () => {
    const os = makeOS();
    const item = os.addInboxItem({ kind: "web_clip", title: "Article on PKM", content: "Body" });

    expect(os.getInboxItems()).toHaveLength(1);
    os.triageInboxItem(item.id);
    expect(os.getInboxItem(item.id)?.status).toBe("triaged");
  });
});