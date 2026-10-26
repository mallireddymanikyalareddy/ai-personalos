import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { LifeMemoryCategory, LifeMemoryItem, LifeMemoryOccurrence } from "../../types/life-memory";
import { createLifeMemoryItem } from "../../types/life-memory";

const DAY = 86_400_000;

export type LifeMemoryUrgency = "never" | "ok" | "soon" | "due" | "overdue";

export interface LifeMemoryIntervalStats {
  sampleCount: number;
  meanIntervalDays: number | null;
  medianIntervalDays: number | null;
  trimmedMeanIntervalDays: number | null;
  observedIntervalDays: number | null;
  shortestIntervalDays: number | null;
  longestIntervalDays: number | null;
  coefficientOfVariation: number | null;
}

export interface LifeMemoryStats {
  itemId: ID;
  title: string;
  category: LifeMemoryCategory;
  completionCount: number;
  lastCompletedAt: Timestamp | null;
  daysSinceCompletion: number | null;
  intervals: LifeMemoryIntervalStats;
  targetIntervalDays: number | null;
  effectiveIntervalDays: number | null;
  intervalSource: "target" | "observed" | "none";
  expectedNextAt: Timestamp | null;
  daysUntilExpected: number | null;
  thresholdDays: number;
  urgency: LifeMemoryUrgency;
  confidence: number;
  attachments: number;
}

function toDays(ms: number): number {
  return ms / DAY;
}

function isAuthorized(state: AppState, item: LifeMemoryItem): boolean {
  const ownerId = (item as { ownerId?: string | null }).ownerId;
  if (ownerId == null) return true;
  const user = Object.values(state.users)[0];
  return user !== undefined && ownerId === user.id;
}

function activeAuthorizedItems(state: AppState): LifeMemoryItem[] {
  return Object.values(state.lifeMemoryItems).filter(
    (item) => item.status === "active" && isAuthorized(state, item),
  );
}

function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing")) return word.slice(0, -3);
  if (word.endsWith("ed")) return word.slice(0, -2);
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function stemCandidates(word: string): Set<string> {
  const out = new Set<string>([word]);
  if (word.length <= 3) return out;
  if (word.endsWith("ies")) out.add(`${word.slice(0, -3)}y`);
  if (word.endsWith("ing")) {
    out.add(word.slice(0, -3));
    out.add(`${word.slice(0, -3)}e`);
  }
  if (word.endsWith("ed")) {
    out.add(word.slice(0, -2));
    out.add(word.slice(0, -1));
  }
  if (word.endsWith("es")) out.add(word.slice(0, -2));
  else if (word.endsWith("s") && word.length > 3) out.add(word.slice(0, -1));
  return out;
}

function baseWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 2),
    ),
  ];
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const aStems = stemCandidates(a);
  const bStems = stemCandidates(b);
  for (const value of aStems) if (b === value) return true;
  for (const value of bStems) if (a === value) return true;
  for (const value of aStems) if (bStems.has(value)) return true;
  return false;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function standardDeviation(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeIntervalStats(item: LifeMemoryItem): LifeMemoryIntervalStats {
  const sorted = [...item.history].sort((a, b) => a.completedAt - b.completedAt);
  if (sorted.length < 2) {
    return {
      sampleCount: 0,
      meanIntervalDays: null,
      medianIntervalDays: null,
      trimmedMeanIntervalDays: null,
      observedIntervalDays: null,
      shortestIntervalDays: null,
      longestIntervalDays: null,
      coefficientOfVariation: null,
    };
  }

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(Math.max(0, toDays(sorted[i]!.completedAt - sorted[i - 1]!.completedAt)));
  }

  const meanDays = mean(gaps);
  const medianDays = median(gaps);

  let trimmed = medianDays;
  if (gaps.length >= 4) {
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    trimmed = mean(sortedGaps.slice(1, sortedGaps.length - 1));
  }

  const sd = standardDeviation(gaps, meanDays);
  const cv = meanDays > 0 ? sd / meanDays : null;

  const observed =
    gaps.length >= 4 ? trimmed : gaps.length >= 3 ? medianDays : meanDays;

  return {
    sampleCount: gaps.length,
    meanIntervalDays: round(meanDays),
    medianIntervalDays: round(medianDays),
    trimmedMeanIntervalDays: gaps.length >= 4 ? round(trimmed) : null,
    observedIntervalDays: round(observed),
    shortestIntervalDays: round(Math.min(...gaps)),
    longestIntervalDays: round(Math.max(...gaps)),
    coefficientOfVariation: cv != null ? round(cv, 2) : null,
  };
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeLifeStats(item: LifeMemoryItem, now: Timestamp = Date.now()): LifeMemoryStats {
  const intervals = computeIntervalStats(item);
  const lastCompletedAt = item.lastCompletedAt;

  const effectiveIntervalDays =
    item.targetIntervalDays != null && item.targetIntervalDays > 0
      ? item.targetIntervalDays
      : intervals.observedIntervalDays;

  const intervalSource: LifeMemoryStats["intervalSource"] =
    item.targetIntervalDays != null && item.targetIntervalDays > 0
      ? "target"
      : intervals.observedIntervalDays != null
        ? "observed"
        : "none";

  const daysSinceCompletion =
    lastCompletedAt != null ? Math.max(0, Math.floor(toDays(now - lastCompletedAt))) : null;

  const expectedNextAt =
    lastCompletedAt != null && effectiveIntervalDays != null && effectiveIntervalDays > 0
      ? lastCompletedAt + Math.round(effectiveIntervalDays * DAY)
      : null;

  const daysUntilExpected =
    expectedNextAt != null ? Math.ceil(toDays(expectedNextAt - now)) : null;

  const urgency: LifeMemoryUrgency =
    effectiveIntervalDays == null
      ? "never"
      : daysUntilExpected! > item.thresholdDays
        ? "ok"
        : daysUntilExpected! > 0
          ? "soon"
          : daysUntilExpected! >= -item.thresholdDays
            ? "due"
            : "overdue";

  const confidence = computeConfidence(intervals, item.targetIntervalDays != null);

  return {
    itemId: item.id,
    title: item.title,
    category: item.category,
    completionCount: item.history.length,
    lastCompletedAt,
    daysSinceCompletion,
    intervals,
    targetIntervalDays: item.targetIntervalDays,
    effectiveIntervalDays,
    intervalSource,
    expectedNextAt,
    daysUntilExpected,
    thresholdDays: item.thresholdDays,
    urgency,
    confidence,
    attachments: item.history.reduce((sum, occurrence) => sum + occurrence.attachmentIds.length, 0),
  };
}

function computeConfidence(intervals: LifeMemoryIntervalStats, hasTarget: boolean): number {
  if (hasTarget && intervals.sampleCount === 0) return 0.5;
  if (intervals.sampleCount === 0) return 0;

  let confidence = Math.min(0.5 + intervals.sampleCount * 0.12, 0.92);
  if (intervals.coefficientOfVariation != null) {
    const penalty = Math.min(0.45, intervals.coefficientOfVariation * 0.55);
    confidence = Math.max(0.3, confidence - penalty);
  }
  return Math.round(confidence * 100) / 100;
}

const URGENCY_WEIGHT: Record<LifeMemoryUrgency, number> = {
  overdue: 5,
  due: 4,
  soon: 3,
  never: 2,
  ok: 1,
};

export function urgencyRank(urgency: LifeMemoryUrgency): number {
  return URGENCY_WEIGHT[urgency];
}

export interface LifeMemoryOverview {
  total: number;
  overdue: number;
  due: number;
  soon: number;
  neverRecorded: number;
  healthy: number;
  byCategory: Array<{ category: LifeMemoryCategory; count: number }>;
}

export function buildOverview(state: AppState, now: Timestamp = Date.now()): LifeMemoryOverview {
  const items = activeAuthorizedItems(state);
  const overview: LifeMemoryOverview = {
    total: items.length,
    overdue: 0,
    due: 0,
    soon: 0,
    neverRecorded: 0,
    healthy: 0,
    byCategory: [],
  };

  const byCategory = new Map<LifeMemoryCategory, number>();
  for (const item of items) {
    const stats = computeLifeStats(item, now);
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);

    switch (stats.urgency) {
      case "overdue":
        overview.overdue += 1;
        break;
      case "due":
        overview.due += 1;
        break;
      case "soon":
        overview.soon += 1;
        break;
      case "never":
        overview.neverRecorded += 1;
        break;
      case "ok":
        overview.healthy += 1;
        break;
    }
  }

  overview.byCategory = [...byCategory.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return overview;
}

export function selectItemsDue(
  state: AppState,
  now: Timestamp = Date.now(),
  windowDays = 7,
): Array<{ item: LifeMemoryItem; stats: LifeMemoryStats }> {
  const entries = activeAuthorizedItems(state).map((item) => ({
    item,
    stats: computeLifeStats(item, now),
  }));

  return entries
    .filter((entry) => entry.stats.daysUntilExpected != null && entry.stats.daysUntilExpected <= windowDays)
    .sort((a, b) => (a.stats.daysUntilExpected ?? 0) - (b.stats.daysUntilExpected ?? 0));
}

export function selectOverdueItems(
  state: AppState,
  now: Timestamp = Date.now(),
): Array<{ item: LifeMemoryItem; stats: LifeMemoryStats }> {
  return activeAuthorizedItems(state)
    .map((item) => ({ item, stats: computeLifeStats(item, now) }))
    .filter((entry) => entry.stats.urgency === "overdue" || entry.stats.urgency === "due")
    .sort((a, b) => a.stats.daysUntilExpected! - b.stats.daysUntilExpected!);
}

export function getHistory(
  item: LifeMemoryItem,
  order: "asc" | "desc" = "desc",
): LifeMemoryOccurrence[] {
  const sorted = [...item.history].sort((a, b) => a.completedAt - b.completedAt);
  return order === "asc" ? sorted : sorted.reverse();
}

export interface LifeMemoryQueryResult {
  matched: boolean;
  item: LifeMemoryItem | null;
  stats: LifeMemoryStats | null;
  answer: string;
  confidence: number;
  alternatives: Array<{ id: ID; title: string }>;
}

const QUESTION_PREFIXES: RegExp[] = [
  /^when\s+(did|was)\s+(i|the\s+last\s+time\s+i)\s+(last\s+)?/i,
  /^when\s+was\s+the\s+last\s+time\s+i\s+/i,
  /^when\s+did\s+we\s+(last\s+)?/i,
  /^did\s+i\s+(ever\s+)?/i,
  /^have\s+i\s+(ever\s+)?/i,
  /^(last\s+time\s+i|tell\s+me\s+when\s+i)\s+/i,
  /^how\s+long\s+(ago|since)\s+(did\s+)?(i\s+)?/i,
  /^what\s+date\s+did\s+i\s+(last\s+)?/i,
  /^(show|tell)\s+me\s+(about\s+)?(my\s+)?/i,
];

function stripQuestion(text: string): string {
  let out = text.trim().replace(/[?.!]+$/, "");
  for (const prefix of QUESTION_PREFIXES) {
    const next = out.replace(prefix, "");
    if (next !== out) {
      out = next;
      break;
    }
  }
  return out.trim();
}

function scoreMatch(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.includes(q)) return 0.92;
  if (q.includes(t)) return 0.85;

  const qWords = baseWords(q);
  const tWords = baseWords(t);
  if (qWords.length === 0 || tWords.length === 0) return 0;

  let shared = 0;
  for (const word of qWords) if (tWords.some((other) => tokensMatch(word, other))) shared += 1;
  return (shared / Math.min(qWords.length, tWords.length)) * 0.7;
}

function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;
  if (days < 365) {
    const months = Math.round(days / 30.44);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30.44);
  return months > 0 ? `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"} ago` : `${years} year${years === 1 ? "" : "s"} ago`;
}

const MATCH_THRESHOLD = 0.4;
const ALTERNATIVE_THRESHOLD = 0.25;

export function answerWhenDidI(
  state: AppState,
  question: string,
  now: Timestamp = Date.now(),
): LifeMemoryQueryResult {
  const query = stripQuestion(question);
  const items = activeAuthorizedItems(state);

  if (!query) {
    return {
      matched: false,
      item: null,
      stats: null,
      answer: "Tell me what you are trying to remember — for example, \"when did I last service my car?\"",
      confidence: 0,
      alternatives: [],
    };
  }

  const ranked = items
    .map((item) => ({ item, score: scoreMatch(query, item.title) }))
    .filter((entry) => entry.score >= ALTERNATIVE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] && ranked[0]!.score >= MATCH_THRESHOLD ? ranked[0] : undefined;

  if (!best) {
    return {
      matched: false,
      item: null,
      stats: null,
      answer: `I could not find a Life Memory for "${query}". Add it and I will track it from now on.`,
      confidence: 0,
      alternatives: [],
    };
  }

  const stats = computeLifeStats(best.item, now);
  const history = getHistory(best.item, "desc");

  const lines: string[] = [];

  if (stats.lastCompletedAt == null || history.length === 0) {
    lines.push(`You have never recorded "${best.item.title}".`);
  } else {
    lines.push(
      `You last ${best.item.title.toLowerCase().replace(/^my\s+/, "")} on ${new Date(
        stats.lastCompletedAt,
      ).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} — that was ${
        stats.daysSinceCompletion
      } days ago.`,
    );
  }

  if (stats.intervalSource !== "none" && stats.effectiveIntervalDays != null) {
    lines.push(
      `${stats.intervalSource === "target" ? "Your target" : "Your average"} interval is ${Math.round(
        stats.effectiveIntervalDays,
      )} days, so it is expected around ${new Date(stats.expectedNextAt!).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`,
    );
    if (stats.daysUntilExpected != null) {
      const when =
        stats.daysUntilExpected >= 0 ? `in ${stats.daysUntilExpected} days` : `${Math.abs(stats.daysUntilExpected)} days ago`;
      lines.push(`That is ${when} (${stats.urgency.replace(/_/g, " ")}).`);
    }
  }

  if (history.length > 1) {
    lines.push(
      `Recorded ${history.length} times, most recently ${relativeDays(
        Math.max(0, Math.floor((now - history[1]!.completedAt) / DAY)),
      )}.`,
    );
  }

  const lastNote = history[0]?.note;
  if (lastNote) lines.push(`Last note: ${lastNote}`);

  return {
    matched: true,
    item: best.item,
    stats,
    answer: lines.join("\n"),
    confidence: Math.min(0.98, Math.round(best.score * 100) / 100),
    alternatives: ranked.slice(1, 4).map((entry) => ({ id: entry.item.id, title: entry.item.title })),
  };
}

export interface ParsedLifeEvent {
  title: string;
  completedAt: Timestamp | null;
  dateText: string | null;
  note: string;
}

const DATE_PATTERNS: Array<{ regex: RegExp; type: "relative" | "iso" | "named" }> = [
  { regex: /\b(yesterday)\b/i, type: "relative" },
  { regex: /\b(today|just now)\b/i, type: "relative" },
  { regex: /\b(\d{1,2})\s+(days?|weeks?|months?|years?)\s+ago\b/i, type: "relative" },
  { regex: /\b(\d{4}-\d{2}-\d{2})\b/, type: "iso" },
  {
    regex:
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i,
    type: "named",
  },
];

const ACTION_VERBS =
  /^(?:i\s+)?(?:just\s+)?(?:did|changed|replace[d]?|replaced|serviced|cleaned|clean|washed|checked|tested|fertilized|watered|changed|filled|refilled|topped|upgraded|installed|renewed|rotated|inspected|sealed|painted|pruned|mowed|vacuumed|dusted|scrubbed|sanitized|bleached|descaled|filtered|logged|recorded|did|done)\b\s*/i;

const LEAD_INS = /^(?:log|record|note|remember|track|add)\s+(?:that\s+)?(?:i\s+)?/i;

export function parseLifeEvent(text: string, now: Timestamp = Date.now()): ParsedLifeEvent {
  let working = text.trim();
  let completedAt: Timestamp | null = null;
  let dateText: string | null = null;

  for (const { regex, type } of DATE_PATTERNS) {
    const match = working.match(regex);
    if (!match) continue;

    if (type === "relative") {
      if (/yesterday/i.test(match[0])) {
        completedAt = now - DAY;
        dateText = "yesterday";
      } else if (/today|just now/i.test(match[0])) {
        completedAt = now;
        dateText = "today";
      } else {
        const amount = Number(match[1]);
        const unit = match[2]!.toLowerCase();
        const multiplier = unit.startsWith("day") ? 1 : unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30.44 : 365.25;
        if (!Number.isNaN(amount)) {
          completedAt = now - Math.round(amount * multiplier * DAY);
          dateText = `${amount} ${unit} ago`;
        }
      }
    } else if (type === "iso") {
      const parsed = Date.parse(`${match[1]}T12:00:00`);
      if (!Number.isNaN(parsed)) {
        completedAt = parsed;
        dateText = match[1];
      }
    } else {
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      const monthKey = match[1]!.slice(0, 3).toLowerCase();
      const month = months[monthKey];
      const day = Number(match[2]);
      const year = match[3] ? Number(match[3]) : new Date(now).getFullYear();
      if (month != null && !Number.isNaN(day)) {
        const parsed = new Date(year, month, day, 12, 0, 0, 0).getTime();
        if (!Number.isNaN(parsed)) {
          completedAt = parsed > now ? parsed - 365 * DAY : parsed;
          dateText = `${match[1]} ${day}${match[3] ? `, ${match[3]}` : ""}`;
        }
      }
    }

    if (dateText) {
      working = working.replace(match[0], " ").replace(/\s+/g, " ").trim();
    }
    break;
  }

  let title = working.replace(LEAD_INS, "").replace(ACTION_VERBS, "").trim();
  title = title.replace(/^(my|the|our)\s+/i, "").replace(/\s+/g, " ").trim();
  title = title.replace(/^([a-z])/, (char) => char.toUpperCase());

  return {
    title: title || "Untitled memory",
    completedAt,
    dateText,
    note: text.trim(),
  };
}

export function createFromText(state: AppState, text: string, now: Timestamp = Date.now()): LifeMemoryItem {
  const parsed = parseLifeEvent(text, now);
  return createLifeMemoryItem(
    {
      title: parsed.title,
      description: "",
      category: "other",
      firstCompletionAt: parsed.completedAt ?? now,
      firstCompletionNote: parsed.note,
    },
    now,
  );
}

export function searchLifeMemory(state: AppState, query: string): LifeMemoryItem[] {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1);

  if (terms.length === 0) return activeAuthorizedItems(state);

  return activeAuthorizedItems(state)
    .map((item) => {
      const haystack = `${item.searchVector} ${item.notes.toLowerCase()}`;
      const hits = terms.filter((term) => haystack.includes(term)).length;
      return { item, hits };
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((entry) => entry.item);
}
