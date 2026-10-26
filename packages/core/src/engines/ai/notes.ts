import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Note, Page, Document, Transcript } from "../../types";
import { search as keywordSearch, type SearchOptions, type SearchResult } from "../knowledge/search";
import { semanticSearch as vectorSearch } from "../knowledge/embeddings";
import { extractEntities, type ExtractedEntity } from "../knowledge/tagging";
import { canUserRead } from "./access";
import type { AIResult, AICitation } from "./types";
import { formatMinutes, percent } from "./format";

export interface NoteSummary {
  id: ID;
  title: string;
  summary: string;
  keyPoints: string[];
  entities: ExtractedEntity[];
  wordCount: number;
  readingTimeMinutes: number;
  compressionRatio: number;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function scoreSentences(sentences: string[]): Array<{ sentence: string; score: number; index: number }> {
  const freq = new Map<string, number>();
  for (const sentence of sentences) {
    const words = sentence
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 3);
    for (const word of words) freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  const max = Math.max(1, ...freq.values());

  return sentences.map((sentence, index) => {
    const words = sentence
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 3);
    let score = 0;
    for (const word of words) score += (freq.get(word) ?? 0) / max;
    const lengthPenalty = words.length < 4 ? 0.4 : words.length > 45 ? 0.75 : 1;
    const positionBonus = index === 0 ? 1.35 : index < 3 ? 1.1 : 1;
    return { sentence, score: (score / Math.max(4, words.length)) * lengthPenalty * positionBonus, index };
  });
}

export function summarizeNoteText(text: string, maxSentences = 3): { summary: string; keyPoints: string[] } {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { summary: "", keyPoints: [] };
  if (sentences.length <= maxSentences) {
    return { summary: sentences.join(" "), keyPoints: sentences };
  }

  const scored = scoreSentences(sentences);
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, maxSentences);
  const chosen = [...top].sort((a, b) => a.index - b.index);

  const keyPoints = chosen
    .slice(0, 4)
    .map((item) => item.sentence.replace(/\s+/g, " ").trim())
    .filter((point) => point.length > 0);

  return { summary: chosen.map((item) => item.sentence).join(" "), keyPoints };
}

export function summarizeNote(note: Note, maxSentences = 3): NoteSummary {
  const { summary, keyPoints } = summarizeNoteText(note.body, maxSentences);
  const originalWords = note.wordCount > 0 ? note.wordCount : note.body.trim().split(/\s+/).length;
  const summaryWords = summary.trim().split(/\s+/).filter(Boolean).length;
  return {
    id: note.id,
    title: note.title || "Untitled note",
    summary,
    keyPoints,
    entities: extractEntities(note.body),
    wordCount: originalWords,
    readingTimeMinutes: note.readingTimeMinutes,
    compressionRatio: originalWords > 0 ? Math.round((summaryWords / originalWords) * 100) : 0,
  };
}

export function summarizeNoteResult(state: AppState, note: Note): AIResult {
  const result = summarizeNote(note);
  const message =
    result.summary.length > 0
      ? `${result.title}: ${result.summary}`
      : `"${result.title}" is too short to summarize.`;

  return {
    kind: "answer",
    message,
    capability: "summarize_note",
    citations: [
      {
        entityType: "note",
        entityId: note.id,
        title: note.title || "Untitled note",
        quote: result.summary,
      },
    ],
    proposals: [
      {
        capability: "summarize_note",
        title: `Save AI summary to "${note.title}"`,
        summary: `Stores the summary and ${result.keyPoints.length} key points on the note.`,
        risk: "low",
        requiresConfirmation: true,
        reasoning: "Summaries are stored on the note so they can be searched and reused.",
        preview: [
          { label: "Summary", detail: result.summary.slice(0, 160) },
          ...result.keyPoints.map((point) => ({ label: "Key point", detail: point.slice(0, 160) })),
        ],
        refs: [{ entityType: "note", entityId: note.id }],
        payload: {
          kind: "note_summary",
          noteId: note.id,
          summary: result.summary,
          keyPoints: result.keyPoints,
        },
      },
    ],
    data: result,
  };
}

export interface HybridHit extends SearchResult {
  semanticScore: number;
  keywordScore: number;
}

function authorized(state: AppState, id: ID, type: string): boolean {
  const map: Record<string, Record<string, { ownerId?: string | null }>> = {
    note: state.notes as never,
    page: state.pages as never,
    document: state.documents as never,
    journal_entry: state.journalEntries as never,
    transcript: state.transcripts as never,
    recording: state.recordings as never,
  };
  void type;
  const collection = map[Object.keys(map).find((key) => key === type) ?? "note"];
  const entity = collection?.[id];
  if (!entity) return false;
  return canUserRead(state, { ownerId: entity.ownerId });
}

export function hybridSearch(state: AppState, options: SearchOptions, limit = 20): HybridHit[] {
  const keywordHits = keywordSearch(state, { ...options, limit: limit * 2 });
  const vectorHits = vectorSearch(state, options.query, undefined, limit * 2, 0.05);

  const byId = new Map<ID, HybridHit>();
  for (const hit of keywordHits) {
    if (!authorized(state, hit.id, hit.type)) continue;
    byId.set(hit.id, { ...hit, semanticScore: 0, keywordScore: hit.score });
  }
  for (const hit of vectorHits) {
    const existing = byId.get(hit.id);
    if (existing) {
      existing.semanticScore = hit.score;
      continue;
    }
    if (!authorized(state, hit.id, hit.type)) continue;
    byId.set(hit.id, {
      id: hit.id,
      type: hit.type as SearchResult["type"],
      title: hit.title,
      snippet: "",
      score: 0,
      tags: [],
      folderId: null,
      notebookId: null,
      updatedAt: 0,
      semanticScore: hit.score,
      keywordScore: 0,
    });
  }

  const hits = [...byId.values()];
  const maxKeyword = Math.max(1, ...hits.map((hit) => hit.keywordScore));
  for (const hit of hits) {
    hit.score = hit.semanticScore * 0.5 + (hit.keywordScore / maxKeyword) * 0.5;
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

function snippetFor(text: string, query: string, length = 220): string {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 2);
  if (terms.length === 0) return text.slice(0, length);

  const lower = text.toLowerCase();
  let bestIndex = -1;
  let bestHits = 0;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index === -1) continue;
    let hits = 0;
    for (const other of terms) if (lower.includes(other, index)) hits += 1;
    if (hits > bestHits) {
      bestHits = hits;
      bestIndex = index;
    }
  }
  if (bestIndex === -1) return text.slice(0, length);
  const start = Math.max(0, bestIndex - 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + length).trim()}${
    start + length < text.length ? "…" : ""
  }`;
}

function findEntityText(state: AppState, id: ID, type: string): { title: string; text: string; kind: AIResult["capability"] } | null {
  switch (type) {
    case "note": {
      const note = state.notes[id];
      return note ? { title: note.title, text: `${note.title}\n${note.body}`, kind: "summarize_note" } : null;
    }
    case "page": {
      const page = state.pages[id];
      return page ? { title: page.title, text: `${page.title}\n${page.body}`, kind: "semantic_search" } : null;
    }
    case "document": {
      const doc = state.documents[id] as Document | undefined;
      return doc ? { title: doc.title, text: `${doc.title}\n${doc.text}`, kind: "semantic_search" } : null;
    }
    case "journal_entry": {
      const entry = state.journalEntries[id];
      return entry ? { title: entry.title, text: `${entry.title}\n${entry.body}`, kind: "semantic_search" } : null;
    }
    case "transcript": {
      const transcript = state.transcripts[id] as Transcript | undefined;
      return transcript
        ? { title: transcript.title, text: `${transcript.title}\n${transcript.fullText}`, kind: "semantic_search" }
        : null;
    }
    default:
      return null;
  }
}

export function answerQuestion(state: AppState, question: string, now: Timestamp = Date.now()): AIResult {
  const hits = hybridSearch(state, { query: question, limit: 8 });
  const citations: AICitation[] = [];
  const sentences: string[] = [];

  for (const hit of hits) {
    const found = findEntityText(state, hit.id, hit.type);
    if (!found) continue;
    const pieces = splitSentences(found.text).filter((sentence) =>
      question
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((term) => term.length > 2)
        .some((term) => sentence.toLowerCase().includes(term)),
    );
    const chosen = pieces.slice(0, 2);
    if (chosen.length === 0) continue;
    sentences.push(...chosen);
    citations.push({
      entityType: hit.type,
      entityId: hit.id,
      title: found.title,
      quote: snippetFor(found.text, question),
    });
    if (citations.length >= 4) break;
  }

  if (sentences.length === 0) {
    return {
      kind: "answer",
      message: `I could not find anything in your notes about "${question}". Try different words, or capture a note first.`,
      capability: "answer_question",
      citations: [],
      proposals: [],
      data: { hits: hits.length },
    };
  }

  return {
    kind: "answer",
    message: `Here is what your notes say about "${question}":\n\n${sentences
      .slice(0, 5)
      .map((sentence, index) => `${index + 1}. ${sentence}`)
      .join("\n")}`,
    capability: "answer_question",
    citations,
    proposals: [],
    data: { hits: hits.length, answeredAt: now },
  };
}

export function semanticSearchResult(state: AppState, query: string, limit = 12): AIResult {
  const hits = hybridSearch(state, { query, limit });
  if (hits.length === 0) {
    return {
      kind: "answer",
      message: `Nothing found for "${query}".`,
      capability: "semantic_search",
      citations: [],
      proposals: [],
    };
  }

  return {
    kind: "answer",
    message: `Found ${hits.length} matching item${hits.length === 1 ? "" : "s"} for "${query}".`,
    capability: "semantic_search",
    citations: hits.slice(0, 8).map((hit) => ({
      entityType: hit.type,
      entityId: hit.id,
      title: hit.title,
      quote: hit.snippet || `relevance ${percent(hit.score * 100)}`,
    })),
    proposals: [],
    data: {
      results: hits.map((hit) => ({
        id: hit.id,
        type: hit.type,
        title: hit.title,
        score: Number(hit.score.toFixed(3)),
        semantic: Number(hit.semanticScore.toFixed(3)),
      })),
    },
  };
}

export function searchKnowledgeResult(state: AppState, query: string): AIResult {
  return semanticSearchResult(state, query);
}

export function noteSummaryForDisplay(note: Note): string {
  const result = summarizeNote(note, 2);
  if (!result.summary) return `${note.wordCount} words · about ${formatMinutes(note.readingTimeMinutes * 60)} read`;
  return `${result.summary} (${percent(result.compressionRatio)} of original)`;
}

export type { Page, Note };