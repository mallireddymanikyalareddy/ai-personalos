import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Note } from "../../types/note";
import type { Page, Document, Transcript, Recording, Notebook, Meeting, LifeMemory } from "../../types/knowledge";

export interface EmbeddingVector {
  id: ID;
  type: string;
  vector: number[];
  updatedAt: Timestamp;
}

export interface EmbeddingIndex {
  vectors: Map<ID, EmbeddingVector>;
  dimension: number;
  lastUpdated: Timestamp;
}

const EMBEDDING_DIMENSION = 384;

export type EmbeddableType = "note" | "page" | "document" | "journal_entry" | "transcript" | "recording" | "notebook" | "meeting" | "life_memory";

export function generateMockEmbedding(text: string, dimension = EMBEDDING_DIMENSION): number[] {
  const vector = new Array(dimension).fill(0);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);

  for (let i = 0; i < dimension; i++) {
    let hash = 0;
    for (const word of words) {
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
      }
      hash = ((hash << 5) - hash + i) | 0;
    }
    vector[i] = (hash % 10000) / 10000 * 2 - 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

export function computeEmbedding(text: string, dimension = EMBEDDING_DIMENSION): number[] {
  return generateMockEmbedding(text, dimension);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function updateItemEmbedding(
  state: AppState,
  itemId: ID,
  itemType: string,
  text: string,
): void {
  const embedding = computeEmbedding(text);
  const now = Date.now();

  switch (itemType) {
    case "note": {
      const note = state.notes[itemId];
      if (note) {
        note.embedding = embedding;
        note.updatedAt = now;
      }
      break;
    }
    case "page": {
      const page = state.pages[itemId];
      if (page) {
        page.embedding = embedding;
        page.updatedAt = now;
      }
      break;
    }
    case "document": {
      const doc = state.documents[itemId];
      if (doc) {
        doc.embedding = embedding;
        doc.updatedAt = now;
      }
      break;
    }
    case "journal_entry": {
      const entry = state.journalEntries[itemId];
      if (entry) {
        entry.embedding = embedding;
        entry.updatedAt = now;
      }
      break;
    }
    case "transcript": {
      const transcript = state.transcripts[itemId];
      if (transcript) {
        transcript.embedding = embedding;
        transcript.updatedAt = now;
      }
      break;
    }
    case "recording": {
      const rec = state.recordings[itemId];
      if (rec) {
        rec.embedding = embedding;
        rec.updatedAt = now;
      }
      break;
    }
    case "notebook": {
      const nb = state.notebooks[itemId];
      if (nb) {
        nb.embedding = embedding;
        nb.updatedAt = now;
      }
      break;
    }
    case "meeting": {
      const meeting = state.meetings[itemId];
      if (meeting) {
        meeting.embedding = embedding;
        meeting.updatedAt = now;
      }
      break;
    }
    case "life_memory": {
      const memory = state.lifeMemories[itemId];
      if (memory) {
        memory.embedding = embedding;
        memory.updatedAt = now;
      }
      break;
    }
  }
}

export function rebuildAllEmbeddings(state: AppState): void {
  for (const note of Object.values(state.notes)) {
    if (note.status === "active") {
      updateItemEmbedding(state, note.id, "note", note.body);
    }
  }
  for (const page of Object.values(state.pages)) {
    if (page.status === "active") {
      updateItemEmbedding(state, page.id, "page", page.body);
    }
  }
  for (const doc of Object.values(state.documents)) {
    if (doc.status === "ready") {
      updateItemEmbedding(state, doc.id, "document", doc.text);
    }
  }
  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status !== "trashed") {
      updateItemEmbedding(state, entry.id, "journal_entry", entry.body);
    }
  }
  for (const transcript of Object.values(state.transcripts)) {
    if (transcript.status === "ready") {
      updateItemEmbedding(state, transcript.id, "transcript", transcript.fullText);
    }
  }
  for (const rec of Object.values(state.recordings)) {
    if (rec.status === "ready") {
      updateItemEmbedding(state, rec.id, "recording", rec.title);
    }
  }
  for (const nb of Object.values(state.notebooks)) {
    if (nb.status === "active") {
      updateItemEmbedding(state, nb.id, "notebook", nb.title + " " + nb.description);
    }
  }
  for (const meeting of Object.values(state.meetings)) {
    updateItemEmbedding(state, meeting.id, "meeting", meeting.title + " " + meeting.notes);
  }
  for (const memory of Object.values(state.lifeMemories)) {
    if (memory.status === "active") {
      updateItemEmbedding(state, memory.id, "life_memory", memory.title + " " + memory.text);
    }
  }
}

export function semanticSearch(
  state: AppState,
  query: string,
  types?: EmbeddableType[],
  limit = 10,
  threshold = 0.3,
): Array<{ id: ID; type: string; title: string; score: number }> {
  const queryVector = computeEmbedding(query);
  const results: Array<{ id: ID; type: string; title: string; score: number }> = [];

  const searchInCollection = (collection: Record<string, any>, type: EmbeddableType) => {
    for (const item of Object.values(collection)) {
      if (types && !types.includes(type)) continue;
      if (item.status === "trashed" || item.status === "processing") continue;
      if (item.embedding && item.embedding.length > 0) {
        const score = cosineSimilarity(queryVector, item.embedding);
        if (score >= threshold) {
          results.push({ id: item.id, type, title: item.title, score });
        }
      }
    }
  };

  if (!types || types.includes("note")) searchInCollection(state.notes, "note");
  if (!types || types.includes("page")) searchInCollection(state.pages, "page");
  if (!types || types.includes("document")) searchInCollection(state.documents, "document");
  if (!types || types.includes("journal_entry")) searchInCollection(state.journalEntries, "journal_entry");
  if (!types || types.includes("transcript")) searchInCollection(state.transcripts, "transcript");
  if (!types || types.includes("recording")) searchInCollection(state.recordings, "recording");
  if (!types || types.includes("notebook")) searchInCollection(state.notebooks, "notebook");
  if (!types || types.includes("meeting")) searchInCollection(state.meetings, "meeting");
  if (!types || types.includes("life_memory")) searchInCollection(state.lifeMemories, "life_memory");

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function findSimilarItems(
  state: AppState,
  itemId: ID,
  itemType: string,
  limit = 10,
  threshold = 0.4,
): Array<{ id: ID; type: string; title: string; score: number }> {
  const item = getItemByType(state, itemType, itemId);
  if (!item || !item.embedding || item.embedding.length === 0) return [];

  const results: Array<{ id: ID; type: string; title: string; score: number }> = [];

  const searchInCollection = (collection: Record<string, any>, type: string) => {
    for (const other of Object.values(collection)) {
      if (other.id === itemId) continue;
      if (other.status === "trashed" || other.status === "processing") continue;
      if (other.embedding && other.embedding.length > 0) {
        const score = cosineSimilarity(item.embedding, other.embedding);
        if (score >= threshold) {
          results.push({ id: other.id, type, title: other.title, score });
        }
      }
    }
  };

  searchInCollection(state.notes, "note");
  searchInCollection(state.pages, "page");
  searchInCollection(state.documents, "document");
  searchInCollection(state.journalEntries, "journal_entry");
  searchInCollection(state.transcripts, "transcript");
  searchInCollection(state.recordings, "recording");
  searchInCollection(state.notebooks, "notebook");
  searchInCollection(state.meetings, "meeting");
  searchInCollection(state.lifeMemories, "life_memory");

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function getItemByType(state: AppState, type: string, id: ID): any {
  switch (type) {
    case "note": return state.notes[id];
    case "page": return state.pages[id];
    case "document": return state.documents[id];
    case "journal_entry": return state.journalEntries[id];
    case "transcript": return state.transcripts[id];
    case "recording": return state.recordings[id];
    case "notebook": return state.notebooks[id];
    case "meeting": return state.meetings[id];
    case "life_memory": return state.lifeMemories[id];
    default: return null;
  }
}

export function clusterEmbeddings(
  vectors: EmbeddingVector[],
  numClusters: number,
  maxIterations = 100,
): Map<ID, number> {
  if (vectors.length === 0 || vectors.length < numClusters) {
    return new Map(vectors.map((v, i) => [v.id, i % numClusters]));
  }

  const dim = vectors[0].vector.length;
  const centroids: number[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < numClusters; i++) {
    let idx = Math.floor(Math.random() * vectors.length);
    while (used.has(idx)) idx = Math.floor(Math.random() * vectors.length);
    used.add(idx);
    centroids.push([...vectors[idx].vector]);
  }

  const assignments = new Map<ID, number>();

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (const vec of vectors) {
      let bestCluster = 0;
      let bestDist = Infinity;

      for (let c = 0; c < numClusters; c++) {
        let dist = 0;
        for (let d = 0; d < dim; d++) {
          const diff = vec.vector[d] - centroids[c][d];
          dist += diff * diff;
        }
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }

      if (assignments.get(vec.id) !== bestCluster) {
        assignments.set(vec.id, bestCluster);
        changed = true;
      }
    }

    const newCentroids: number[][] = Array(numClusters).fill(null).map(() => new Array(dim).fill(0));
    const counts = new Array(numClusters).fill(0);

    for (const vec of vectors) {
      const cluster = assignments.get(vec.id) ?? 0;
      for (let d = 0; d < dim; d++) {
        newCentroids[cluster][d] += vec.vector[d];
      }
      counts[cluster]++;
    }

    for (let c = 0; c < numClusters; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < dim; d++) {
          centroids[c][d] = newCentroids[c][d] / counts[c];
        }
      }
    }

    if (!changed) break;
  }

  return assignments;
}