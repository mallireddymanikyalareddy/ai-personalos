import type { AppState } from "../../store/state";
import type { ID } from "../../types/common";
import type { Note } from "../../types/note";
import type { Page, Document, Transcript, Recording } from "../../types/knowledge";
import type { Folder } from "../../types/folder";

export interface SearchResult {
  id: ID;
  type: "note" | "page" | "document" | "journal_entry" | "transcript" | "recording";
  title: string;
  snippet: string;
  score: number;
  tags: string[];
  folderId: ID | null;
  notebookId: ID | null;
  updatedAt: number;
}

export interface SearchOptions {
  query: string;
  types?: SearchResult["type"][];
  tags?: string[];
  folderId?: ID | null;
  notebookId?: ID | null;
  status?: ("active" | "archived" | "trashed")[];
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
  sortBy?: "relevance" | "updated" | "created" | "title";
  sortOrder?: "asc" | "desc";
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

function computeBM25(
  queryTerms: string[],
  docText: string,
  docLength: number,
  avgDocLength: number,
  docFreq: Map<string, number>,
  totalDocs: number,
  k1 = 1.5,
  b = 0.75,
): number {
  let score = 0;
  for (const term of queryTerms) {
    const df = docFreq.get(term) ?? 0;
    if (df === 0) continue;
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
    const tf = (docText.toLowerCase().split(term).length - 1);
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
    score += idf * (numerator / denominator);
  }
  return score;
}

export function buildSearchIndex(state: AppState): SearchIndex {
  const docs: SearchDoc[] = [];
  const docFreq = new Map<string, number>();
  let totalLength = 0;

  const addDoc = (item: SearchDoc) => {
    docs.push(item);
    totalLength += item.length;
    const terms = new Set(tokenize(item.searchVector));
    for (const term of terms) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  };

  for (const note of Object.values(state.notes)) {
    if (note.status === "active") {
      addDoc({
        id: note.id,
        type: "note",
        title: note.title,
        searchVector: note.searchVector,
        tags: note.tags,
        folderId: note.folderId,
        notebookId: note.notebookId,
        updatedAt: note.updatedAt,
        length: note.wordCount,
      });
    }
  }

  for (const page of Object.values(state.pages)) {
    if (page.status === "active") {
      addDoc({
        id: page.id,
        type: "page",
        title: page.title,
        searchVector: page.searchVector,
        tags: page.tags,
        folderId: page.folderId,
        notebookId: page.notebookId,
        updatedAt: page.updatedAt,
        length: page.wordCount,
      });
    }
  }

  for (const doc of Object.values(state.documents)) {
    if (doc.status === "ready") {
      addDoc({
        id: doc.id,
        type: "document",
        title: doc.title,
        searchVector: doc.text.toLowerCase(),
        tags: doc.tags,
        folderId: doc.folderId,
        notebookId: null,
        updatedAt: doc.updatedAt,
        length: doc.text.length,
      });
    }
  }

  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status !== "trashed") {
      addDoc({
        id: entry.id,
        type: "journal_entry",
        title: entry.title,
        searchVector: entry.searchVector,
        tags: entry.tags,
        folderId: null,
        notebookId: null,
        updatedAt: entry.updatedAt,
        length: entry.wordCount,
      });
    }
  }

  for (const transcript of Object.values(state.transcripts)) {
    if (transcript.status === "ready") {
      addDoc({
        id: transcript.id,
        type: "transcript",
        title: transcript.title,
        searchVector: transcript.fullText.toLowerCase(),
        tags: [],
        folderId: transcript.folderId,
        notebookId: null,
        updatedAt: transcript.updatedAt,
        length: transcript.fullText.length,
      });
    }
  }

  for (const recording of Object.values(state.recordings)) {
    if (recording.status === "ready") {
      addDoc({
        id: recording.id,
        type: "recording",
        title: recording.title,
        searchVector: recording.title.toLowerCase(),
        tags: recording.tags,
        folderId: recording.folderId,
        notebookId: null,
        updatedAt: recording.updatedAt,
        length: recording.title.length,
      });
    }
  }

  const avgDocLength = docs.length > 0 ? totalLength / docs.length : 0;

  return { docs, docFreq, avgDocLength, totalDocs: docs.length };
}

interface SearchDoc {
  id: ID;
  type: SearchResult["type"];
  title: string;
  searchVector: string;
  tags: string[];
  folderId: ID | null;
  notebookId: ID | null;
  updatedAt: number;
  length: number;
}

interface SearchIndex {
  docs: SearchDoc[];
  docFreq: Map<string, number>;
  avgDocLength: number;
  totalDocs: number;
}

export function search(state: AppState, options: SearchOptions): SearchResult[] {
  const index = buildSearchIndex(state);
  const queryTerms = tokenize(options.query);
  const tagOnly = queryTerms.length === 0;

  let results: SearchResult[] = [];

  for (const doc of index.docs) {
    if (options.types && !options.types.includes(doc.type)) continue;
    if (options.folderId && doc.folderId !== options.folderId) continue;
    if (options.notebookId && doc.notebookId !== options.notebookId) continue;
    if (options.tags && options.tags.length > 0) {
      if (!options.tags.some((t) => doc.tags.includes(t))) continue;
    }
    if (options.dateFrom && doc.updatedAt < options.dateFrom) continue;
    if (options.dateTo && doc.updatedAt > options.dateTo) continue;

    let score: number;
    let snippet: string;
    if (tagOnly) {
      score = 1;
      snippet = doc.searchVector.slice(0, 120);
    } else {
      score = computeBM25(
        queryTerms,
        doc.searchVector,
        doc.length,
        index.avgDocLength,
        index.docFreq,
        index.totalDocs,
      );
      snippet = generateSnippet(doc.searchVector, queryTerms);
    }

    if (score > 0) {
      results.push({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        snippet,
        score,
        tags: doc.tags,
        folderId: doc.folderId,
        notebookId: doc.notebookId,
        updatedAt: doc.updatedAt,
      });
    }
  }

  results.sort((a, b) => {
    if (options.sortBy === "relevance") return b.score - a.score;
    if (options.sortBy === "updated") {
      return options.sortOrder === "asc" ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt;
    }
    if (options.sortBy === "created") {
      return options.sortOrder === "asc" ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt;
    }
    if (options.sortBy === "title") {
      return options.sortOrder === "asc"
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    }
    return b.score - a.score;
  });

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  return results.slice(offset, offset + limit);
}

function generateSnippet(text: string, queryTerms: string[]): string {
  const words = text.split(/\s+/);
  const termSet = new Set(queryTerms);
  let bestStart = 0;
  let bestScore = -1;

  for (let i = 0; i <= words.length - 30; i++) {
    const window = words.slice(i, i + 30);
    let score = 0;
    for (const word of window) {
      if (termSet.has(word.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  const snippetWords = words.slice(bestStart, bestStart + 30);
  let snippet = snippetWords.join(" ");
  if (bestStart > 0) snippet = "… " + snippet;
  if (bestStart + 30 < words.length) snippet += " …";

  for (const term of queryTerms) {
    const regex = new RegExp(`(${term})`, "gi");
    snippet = snippet.replace(regex, "**$1**");
  }

  return snippet;
}

export function getSearchSuggestions(state: AppState, partial: string, limit = 10): string[] {
  const terms = new Set<string>();
  const partialLower = partial.toLowerCase();

  for (const note of Object.values(state.notes)) {
    if (note.status === "active") {
      for (const tag of note.tags) {
        if (tag.toLowerCase().startsWith(partialLower)) terms.add(tag);
      }
      for (const word of tokenize(note.title)) {
        if (word.startsWith(partialLower)) terms.add(word);
      }
    }
  }

  return Array.from(terms).slice(0, limit);
}

export function findByTags(state: AppState, tags: string[], types?: SearchResult["type"][]): SearchResult[] {
  const results: SearchResult[] = [];
  const tagSet = new Set(tags);

  const checkItem = (item: any, type: SearchResult["type"]) => {
    if (types && !types.includes(type)) return;
    if (item.tags.some((t: string) => tagSet.has(t))) {
      results.push({
        id: item.id,
        type,
        title: item.title,
        snippet: "",
        score: 1,
        tags: item.tags,
        folderId: item.folderId ?? null,
        notebookId: item.notebookId ?? null,
        updatedAt: item.updatedAt,
      });
    }
  };

  for (const note of Object.values(state.notes)) if (note.status === "active") checkItem(note, "note");
  for (const page of Object.values(state.pages)) if (page.status === "active") checkItem(page, "page");
  for (const doc of Object.values(state.documents)) if (doc.status === "ready") checkItem(doc, "document");
  for (const entry of Object.values(state.journalEntries)) if (entry.status !== "trashed") checkItem(entry, "journal_entry");

  return results;
}

export function getRelatedItems(
  state: AppState,
  itemId: ID,
  itemType: SearchResult["type"],
  limit = 10,
): SearchResult[] {
  const results: SearchResult[] = [];

  const addRelated = (item: any, type: SearchResult["type"], sharedTags: number) => {
    if (sharedTags > 0) {
      results.push({
        id: item.id,
        type,
        title: item.title,
        snippet: "",
        score: sharedTags,
        tags: item.tags,
        folderId: item.folderId ?? null,
        notebookId: item.notebookId ?? null,
        updatedAt: item.updatedAt,
      });
    }
  };

  const sourceItem = getItemById(state, itemId, itemType);
  if (!sourceItem) return [];

  const sourceTags = new Set(sourceItem.tags ?? []);

  for (const note of Object.values(state.notes)) {
    if (note.id === itemId) continue;
    if (note.status !== "active") continue;
    const shared = note.tags.filter((t) => sourceTags.has(t)).length;
    addRelated(note, "note", shared);
  }

  for (const page of Object.values(state.pages)) {
    if (page.id === itemId) continue;
    if (page.status !== "active") continue;
    const shared = page.tags.filter((t) => sourceTags.has(t)).length;
    addRelated(page, "page", shared);
  }

  for (const doc of Object.values(state.documents)) {
    if (doc.id === itemId) continue;
    if (doc.status !== "ready") continue;
    const shared = doc.tags.filter((t) => sourceTags.has(t)).length;
    addRelated(doc, "document", shared);
  }

  for (const entry of Object.values(state.journalEntries)) {
    if (entry.id === itemId) continue;
    if (entry.status === "trashed") continue;
    const shared = entry.tags.filter((t) => sourceTags.has(t)).length;
    addRelated(entry, "journal_entry", shared);
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function getItemById(state: AppState, id: ID, type: SearchResult["type"]): any {
  switch (type) {
    case "note":
      return state.notes[id];
    case "page":
      return state.pages[id];
    case "document":
      return state.documents[id];
    case "journal_entry":
      return state.journalEntries[id];
    case "transcript":
      return state.transcripts[id];
    case "recording":
      return state.recordings[id];
    default:
      return null;
  }
}

export function getFolderTree(state: AppState, rootFolderId?: ID): FolderNode[] {
  const folders = state.folders;
  const childrenMap = new Map<ID, FolderNode[]>();

  for (const folder of Object.values(folders)) {
    if (folder.status !== "active") continue;
    const parentId = folder.parentId ?? "root";
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push({
      folder,
      children: [],
    });
  }

  const buildTree = (parentId: ID): FolderNode[] => {
    const children = childrenMap.get(parentId) ?? [];
    return children.map((node) => ({
      ...node,
      children: buildTree(node.folder.id),
    }));
  };

  return buildTree(rootFolderId ?? "root");
}

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
}