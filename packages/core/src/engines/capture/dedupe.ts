import type { AppState } from "../../store/state";
import type { Timestamp, ID } from "../../types/common";
import type { CaptureLog, RoutedEntityType } from "../../types/capture";

export type DuplicateInfo =
  | { duplicate: true; id: ID }
  | { duplicate: false; id: null };

const STOPWORDS = new Set([
  "the",
  "this",
  "that",
  "with",
  "from",
  "have",
  "your",
  "will",
  "about",
  "into",
  "then",
  "them",
  "next",
  "some",
  "just",
  "also",
]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

export function findDuplicate(state: AppState, type: RoutedEntityType, title: string): DuplicateInfo {
  const collection: Record<ID, { id: ID; title: string }> | undefined = collectionFor(state, type);
  if (!collection) return { duplicate: false, id: null };

  const target = normalizeTitle(title);
  if (!target) return { duplicate: false, id: null };

  const targetTokens = significantTokens(target);

  for (const entity of Object.values(collection)) {
    const candidate = normalizeTitle(entity.title);
    if (candidate === target) return { duplicate: true, id: entity.id };
    if (targetTokens.length >= 2) {
      const candidateTokens = significantTokens(candidate);
      if (candidateTokens.length >= 2) {
        const intersection = targetTokens.filter((token) => candidateTokens.includes(token)).length;
        const union = new Set([...targetTokens, ...candidateTokens]).size;
        if (union > 0 && intersection / union >= 0.72) {
          return { duplicate: true, id: entity.id };
        }
      }
    }
  }

  return { duplicate: false, id: null };
}

export function findRecentCapture(
  state: AppState,
  raw: string | null,
  now: Timestamp,
  windowMs = 120_000,
): CaptureLog | null {
  if (!raw) return null;
  const target = normalizeTitle(raw);
  if (!target) return null;
  const recent = Object.values(state.captures).filter(
    (log) => now - log.createdAt <= windowMs && log.createdAt <= now,
  );
  return recent.find((log) => normalizeTitle(log.raw ?? "") === target) ?? null;
}

function collectionFor(state: AppState, type: RoutedEntityType): Record<ID, { id: ID; title: string }> | undefined {
  switch (type) {
    case "task":
      return state.tasks;
    case "note":
      return state.notes;
    case "goal":
      return state.goals;
    case "habit":
      return state.habits;
    case "event":
      return state.events;
    case "meeting":
      return state.meetings;
    case "document":
      return state.documents;
    case "recording":
      return state.recordings;
  }
}