import type { AppState } from "../../store/state";
import type { ID } from "../../types/common";
import type { Note } from "../../types/note";
import type { Page, Document, Transcript, Recording } from "../../types/knowledge";
import { tokenize } from "./search";

const COMMON_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "as", "is", "was", "are", "were", "been", "be", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these",
  "those", "i", "you", "he", "she", "it", "we", "they", "my", "your", "his", "her", "its",
  "our", "their", "me", "him", "her", "us", "them", "what", "which", "who", "whom", "whose",
  "where", "when", "why", "how", "there", "here", "then", "than", "so", "if", "because",
  "while", "when", "where", "after", "before", "until", "since", "unless", "although",
  "though", "even", "only", "just", "also", "very", "too", "much", "more", "most", "less",
  "least", "such", "own", "same", "other", "another", "each", "every", "any", "all", "some",
  "no", "not", "nor", "neither", "either", "both", "few", "many", "several", "one", "two",
  "first", "last", "next", "last", "long", "short", "high", "low", "large", "small", "big",
  "small", "good", "bad", "new", "old", "great", "little", "own", "other", "old", "right",
  "left", "high", "low", "long", "short", "hard", "soft", "easy", "difficult", "simple",
  "complex", "clear", "unclear", "certain", "uncertain", "possible", "impossible", "likely",
  "unlikely", "sure", "unsure", "true", "false", "yes", "no", "maybe", "perhaps", "probably"
]);

const ENTITY_PATTERNS: Array<{ type: ExtractedEntity["type"]; regex: RegExp }> = [
  { type: "date", regex: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi },
  { type: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: "url", regex: /https?:\/\/[^\s]+/g },
  { type: "phone", regex: /\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g },
  { type: "hashtag", regex: /#[\w]+/gu },
  { type: "mention", regex: /@[\w]+/gu },
];

const PROJECT_KEYWORDS = ["project", "task", "deadline", "milestone", "deliverable", "sprint", "release", "deploy", "meeting", "review", "planning", "design", "development", "testing", "bug", "feature", "refactor", "docs", "documentation"];
const PERSONAL_KEYWORDS = ["personal", "health", "fitness", "exercise", "diet", "sleep", "meditation", "therapy", "doctor", "appointment", "family", "friend", "vacation", "travel", "hobby", "learning", "reading", "writing"];
const WORK_KEYWORDS = ["client", "customer", "stakeholder", "contract", "invoice", "payment", "budget", "revenue", "profit", "quarter", "annual", "review", "performance", "goal", "objective", "kpi", "metric", "report", "presentation", "proposal", "negotiation"];

export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: "content" | "entity" | "pattern" | "context" | "frequency";
}

export interface AutoTagResult {
  suggestedTags: TagSuggestion[];
  extractedEntities: ExtractedEntity[];
}

export interface ExtractedEntity {
  type: "date" | "email" | "url" | "phone" | "hashtag" | "mention" | "person" | "project" | "organization" | "location";
  value: string;
  confidence: number;
  position: { start: number; end: number };
}

export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const { type, regex } of ENTITY_PATTERNS) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type,
        value: match[0],
        confidence: 0.9,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }
  }

  return entities;
}

export function suggestTagsFromContent(text: string, existingTags: string[] = []): TagSuggestion[] {
  const suggestions: TagSuggestion[] = [];
  const words = tokenize(text);
  const wordFreq = new Map<string, number>();

  for (const word of words) {
    if (COMMON_STOPWORDS.has(word) || word.length < 3) continue;
    wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
  }

  const totalWords = words.length;
  for (const [word, freq] of wordFreq) {
    if (freq < 2 && totalWords > 50) continue;
    const confidence = Math.min(0.9, freq / Math.max(1, totalWords / 100));
    if (!existingTags.includes(word)) {
      suggestions.push({
        tag: word,
        confidence,
        reason: "content",
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

export function suggestTagsFromContext(
  state: AppState,
  itemType: "note" | "page" | "document" | "journal_entry",
  itemId: ID,
): TagSuggestion[] {
  const suggestions: TagSuggestion[] = [];

  const related = getRelatedItemsByType(state, itemType, itemId);
  const tagFreq = new Map<string, number>();

  for (const item of related) {
    for (const tag of item.tags ?? []) {
      tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1);
    }
  }

  for (const [tag, count] of tagFreq) {
    suggestions.push({
      tag,
      confidence: Math.min(0.8, count / related.length),
      reason: "context",
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function getRelatedItemsByType(
  state: AppState,
  type: "note" | "page" | "document" | "journal_entry",
  itemId: ID,
): Array<{ tags: string[] }> {
  const related: Array<{ tags: string[] }> = [];

  if (type === "note") {
    const note = state.notes[itemId];
    if (note) {
      for (const other of Object.values(state.notes)) {
        if (other.id !== itemId && other.status === "active") {
          const shared = note.goalIds.filter((g) => other.goalIds.includes(g)).length;
          if (shared > 0 || note.projectId === other.projectId) related.push({ tags: other.tags });
        }
      }
    }
  }

  return related;
}

export function classifyContent(text: string): { category: string; confidence: number }[] {
  const scores = {
    work: 0,
    personal: 0,
    project: 0,
    learning: 0,
    health: 0,
    finance: 0,
  };

  const words = tokenize(text);
  const wordSet = new Set(words);

  for (const word of wordSet) {
    if (WORK_KEYWORDS.includes(word)) scores.work += 1;
    if (PERSONAL_KEYWORDS.includes(word)) scores.personal += 1;
    if (PROJECT_KEYWORDS.includes(word)) scores.project += 1;
    if (["learn", "study", "course", "tutorial", "book", "read", "watch", "practice"].includes(word)) scores.learning += 1;
    if (["health", "fitness", "exercise", "diet", "sleep", "meditation", "doctor"].includes(word)) scores.health += 1;
    if (["budget", "money", "expense", "income", "invest", "save", "spend", "cost", "price"].includes(word)) scores.finance += 1;
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return [{ category: "general", confidence: 0.5 }];

  return Object.entries(scores)
    .filter(([, v]) => v > 0)
    .map(([category, score]) => ({ category, confidence: score / total }))
    .sort((a, b) => b.confidence - a.confidence);
}

export function generateTagCloud(state: AppState, types?: ("note" | "page" | "document" | "journal_entry")[]): Array<{ tag: string; count: number; types: string[] }> {
  const tagMap = new Map<string, { count: number; types: Set<string> }>();

  const addTags = (item: any, type: string) => {
    for (const tag of item.tags ?? []) {
      const entry = tagMap.get(tag) ?? { count: 0, types: new Set() };
      entry.count++;
      entry.types.add(type);
      tagMap.set(tag, entry);
    }
  };

  if (!types || types.includes("note")) {
    for (const note of Object.values(state.notes)) if (note.status === "active") addTags(note, "note");
  }
  if (!types || types.includes("page")) {
    for (const page of Object.values(state.pages)) if (page.status === "active") addTags(page, "page");
  }
  if (!types || types.includes("document")) {
    for (const doc of Object.values(state.documents)) if (doc.status === "ready") addTags(doc, "document");
  }
  if (!types || types.includes("journal_entry")) {
    for (const entry of Object.values(state.journalEntries)) if (entry.status !== "trashed") addTags(entry, "journal_entry");
  }

  return Array.from(tagMap.entries())
    .map(([tag, { count, types }]) => ({ tag, count, types: Array.from(types) }))
    .sort((a, b) => b.count - a.count);
}

export function autoTagItem(
  state: AppState,
  text: string,
  itemType: "note" | "page" | "document" | "journal_entry",
  existingTags: string[] = [],
  itemId?: ID,
): AutoTagResult {
  const contentTags = suggestTagsFromContent(text, existingTags);
  const contextTags = itemId ? suggestTagsFromContext(state, itemType, itemId) : [];
  const entities = extractEntities(text);
  const categories = classifyContent(text);

  const allSuggestions = [...contentTags, ...contextTags];

  const entityTags: TagSuggestion[] = entities.map((e) => ({
    tag: e.value,
    confidence: e.confidence,
    reason: "entity",
  }));

  const categoryTags: TagSuggestion[] = categories.map((c) => ({
    tag: c.category,
    confidence: c.confidence * 0.7,
    reason: "content",
  }));

  const all = [...contentTags, ...contextTags, ...entityTags, ...categoryTags];
  const seen = new Set<string>();
  const unique = all.filter((s) => {
    if (seen.has(s.tag.toLowerCase())) return false;
    seen.add(s.tag.toLowerCase());
    return !existingTags.includes(s.tag);
  });

  return {
    suggestedTags: unique.sort((a, b) => b.confidence - a.confidence).slice(0, 10),
    extractedEntities: entities,
  };
}