import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { LifeMemoryItem } from "../../types/life-memory";
import {
  answerWhenDidI,
  computeLifeStats,
  parseLifeEvent,
  type LifeMemoryQueryResult,
  type LifeMemoryStats,
} from "../life-memory/engine";
import { canUserRead } from "./access";
import type { AIResult } from "./types";

function canRead(state: AppState, item: LifeMemoryItem): boolean {
  return canUserRead(state, { ownerId: undefined });
}

export function matchLifeMemoryItem(state: AppState, query: string): LifeMemoryItem | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  let best: LifeMemoryItem | null = null;
  let bestScore = 0;

  for (const item of Object.values(state.lifeMemoryItems)) {
    if (item.status === "trashed") continue;
    if (!canRead(state, item)) continue;

    const t = item.title.toLowerCase().trim();
    let score = 0;
    if (t === q) score = 1;
    else if (t.includes(q)) score = 0.92;
    else if (q.includes(t)) score = 0.85;
    else {
      const qWords = new Set(q.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
      const tWords = new Set(t.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
      if (qWords.size > 0 && tWords.size > 0) {
        let shared = 0;
        for (const word of qWords) if (tWords.has(word)) shared += 1;
        score = (shared / Math.min(qWords.size, tWords.size)) * 0.7;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 0.5 ? best : null;
}

export function answerWhenDidIResult(state: AppState, question: string, now: Timestamp = Date.now()): AIResult {
  const answer: LifeMemoryQueryResult = answerWhenDidI(state, question, now);

  if (!answer.matched || !answer.item || !answer.stats) {
    return {
      kind: "answer",
      message: answer.answer,
      capability: "life_memory",
      citations: [],
      proposals: [],
      data: { matched: false, alternatives: answer.alternatives },
    };
  }

  const citations = answer.item.history
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 5)
    .map((occurrence) => ({
      entityType: "life_memory_item" as const,
      entityId: answer.item!.id,
      title: `${new Date(occurrence.completedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}${occurrence.note ? ` — ${occurrence.note.slice(0, 120)}` : ""}`,
      quote: occurrence.note.slice(0, 160),
    }));

  return {
    kind: "answer",
    message: answer.answer,
    capability: "life_memory",
    citations,
    proposals: [],
    data: {
      matched: true,
      itemId: answer.item.id,
      stats: answer.stats,
      alternatives: answer.alternatives,
    },
  };
}

export function buildLifeEventProposal(
  state: AppState,
  text: string,
  now: Timestamp = Date.now(),
) {
  const parsed = parseLifeEvent(text, now);
  const existing = matchLifeMemoryItem(state, parsed.title);
  const completedAt = parsed.completedAt ?? now;

  if (existing) {
    return {
      kind: "existing" as const,
      item: existing,
      payload: {
        kind: "life_memory_completion",
        itemId: existing.id,
        completedAt,
        note: parsed.note,
      },
      parsed,
      title: `Record completion for "${existing.title}"`,
      summary: parsed.dateText ? `Backdated to ${parsed.dateText}.` : "Backdated to today.",
      preview: [
        { label: existing.title, detail: parsed.dateText ?? "today" },
        { label: "Previous", detail: formatLast(existing, now) },
      ],
    };
  }

  return {
    kind: "new" as const,
    item: null,
    payload: {
      kind: "life_memory_create",
      title: parsed.title,
      completedAt,
      note: parsed.note,
    },
    parsed,
    title: `Track "${parsed.title}" and record today's completion`,
    summary: "A new Life Memory with one completion in its history.",
    preview: [{ label: parsed.title, detail: parsed.dateText ?? "today" }],
  };
}

function formatLast(item: LifeMemoryItem, now: Timestamp): string {
  const stats = computeLifeStats(item, now);
  if (stats.lastCompletedAt == null) return "never recorded";
  return `${stats.daysSinceCompletion} days ago`;
}

export function findLifeItems(state: AppState): LifeMemoryItem[] {
  return Object.values(state.lifeMemoryItems).filter((item) => item.status === "active" && canRead(state, item));
}

export function lifeItemById(state: AppState, id: ID): LifeMemoryItem | null {
  const item = state.lifeMemoryItems[id];
  if (!item || !canRead(state, item)) return null;
  return item;
}