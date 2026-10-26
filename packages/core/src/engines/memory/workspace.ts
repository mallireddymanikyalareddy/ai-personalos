import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { MemoryCategory, MemoryMoment } from "../../types/memory-moment";
import { MEMORY_CATEGORIES } from "../../types/memory-moment";

const DAY = 86_400_000;

export type MemoryQuickFilter =
  | "all"
  | "recent"
  | "favorites"
  | "with_photos"
  | "this_year"
  | "last_year"
  | "trash";

export interface MemoryFilters {
  category?: MemoryCategory | null;
  query?: string;
  quick?: MemoryQuickFilter;
  from?: Timestamp | null;
  to?: Timestamp | null;
  now?: Timestamp;
}

export function activeMoments(state: AppState): MemoryMoment[] {
  return Object.values(state.memoryMoments).filter((moment) => moment.status !== "trashed");
}

function startOfYear(at: Timestamp): Timestamp {
  const date = new Date(at);
  return new Date(date.getFullYear(), 0, 1).getTime();
}

export function filterMoments(state: AppState, filters: MemoryFilters): MemoryMoment[] {
  const needle = (filters.query ?? "").trim().toLowerCase();
  const now = filters.now ?? Date.now();
  const thisYear = startOfYear(now);
  const lastYear = startOfYear(new Date(now - 365 * DAY).getTime());

  const base =
    filters.quick === "trash"
      ? Object.values(state.memoryMoments).filter((moment) => moment.status === "trashed")
      : activeMoments(state);

  return base
    .filter((moment) => {
      if (filters.category && moment.category !== filters.category) return false;
      if (filters.from != null && moment.happenedAt < filters.from) return false;
      if (filters.to != null && moment.happenedAt > filters.to) return false;

      switch (filters.quick) {
        case "recent":
          if (moment.happenedAt < now - 30 * DAY) return false;
          break;
        case "favorites":
          if (!moment.favorite) return false;
          break;
        case "with_photos":
          if (moment.attachmentIds.length === 0) return false;
          break;
        case "this_year":
          if (moment.happenedAt < thisYear) return false;
          break;
        case "last_year":
          if (moment.happenedAt < lastYear || moment.happenedAt >= thisYear) return false;
          break;
        default:
          break;
      }

      if (needle.length === 0) return true;
      return (
        moment.searchVector.includes(needle) ||
        moment.people.some((person) => person.toLowerCase().includes(needle)) ||
        (moment.place?.name.toLowerCase().includes(needle) ?? false)
      );
    })
    .sort((a, b) => b.happenedAt - a.happenedAt);
}

export interface MemoryCategoryCount {
  category: MemoryCategory;
  count: number;
}

export function categoryCounts(state: AppState): MemoryCategoryCount[] {
  const counts = new Map<MemoryCategory, number>();
  for (const category of MEMORY_CATEGORIES) counts.set(category, 0);
  for (const moment of activeMoments(state)) {
    counts.set(moment.category, (counts.get(moment.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

export function quickFilterCounts(
  state: AppState,
  now: Timestamp = Date.now(),
): Record<MemoryQuickFilter, number> {
  const moments = activeMoments(state);
  const thisYear = startOfYear(now);
  const lastYear = startOfYear(new Date(now - 365 * DAY).getTime());

  const trashed = Object.values(state.memoryMoments).filter(
    (moment) => moment.status === "trashed",
  );

  return {
    all: moments.length,
    recent: moments.filter((moment) => moment.happenedAt >= now - 30 * DAY).length,
    favorites: moments.filter((moment) => moment.favorite).length,
    with_photos: moments.filter((moment) => moment.attachmentIds.length > 0).length,
    this_year: moments.filter((moment) => moment.happenedAt >= thisYear).length,
    last_year: moments.filter(
      (moment) => moment.happenedAt >= lastYear && moment.happenedAt < thisYear,
    ).length,
    trash: trashed.length,
  };
}

export interface MemoryGlance {
  trips: number;
  newPeople: number;
  newFoods: number;
  booksRead: number;
  total: number;
}

export function glanceStats(state: AppState, year: Timestamp = Date.now()): MemoryGlance {
  const from = startOfYear(year);
  const to = from + 366 * DAY;
  const moments = activeMoments(state).filter(
    (moment) => moment.happenedAt >= from && moment.happenedAt <= to,
  );

  const people = new Set<string>();
  const foods = new Set<string>();
  let books = 0;

  for (const moment of moments) {
    for (const person of moment.people) people.add(person.toLowerCase());
    if (moment.category === "food") foods.add(moment.title.trim().toLowerCase());
    if (moment.kind === "book") books += 1;
  }

  return {
    trips: moments.filter((moment) => moment.kind === "trip").length,
    newPeople: people.size,
    newFoods: foods.size,
    booksRead: books,
    total: moments.length,
  };
}

export interface MemoryPlaceVisit {
  name: string;
  latitude: number | null;
  longitude: number | null;
  count: number;
  lastAt: Timestamp;
  momentId: ID;
}

export function placesVisited(state: AppState, limit = 12): MemoryPlaceVisit[] {
  const byName = new Map<string, MemoryPlaceVisit>();

  for (const moment of activeMoments(state)) {
    const place = moment.place;
    if (!place) continue;
    const key = place.name.trim().toLowerCase();
    if (key.length === 0) continue;
    const existing = byName.get(key);
    if (existing) {
      existing.count += 1;
      if (moment.happenedAt > existing.lastAt) {
        existing.lastAt = moment.happenedAt;
        existing.momentId = moment.id;
        if (place.latitude != null && place.longitude != null) {
          existing.latitude = place.latitude;
          existing.longitude = place.longitude;
        }
      }
      continue;
    }
    byName.set(key, {
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      count: 1,
      lastAt: moment.happenedAt,
      momentId: moment.id,
    });
  }

  return [...byName.values()].sort((a, b) => b.lastAt - a.lastAt).slice(0, limit);
}

export interface MemoryRecurring {
  label: string;
  count: number;
  lastAt: Timestamp;
  momentId: ID;
  category: MemoryCategory;
}

const GROUP_STOP_WORDS = new Set(["a", "an", "the", "my", "session", "workout", "practice"]);

function groupKey(title: string, tags: string[]): string {
  const words = [
    ...title.toLowerCase().split(/[^\p{L}\p{N}]+/u),
    ...tags.map((tag) => tag.toLowerCase()),
  ].filter((word) => word.length > 2 && !GROUP_STOP_WORDS.has(word));
  return [...new Set(words)].sort().join("-");
}

export function recurringMoments(state: AppState, limit = 5): MemoryRecurring[] {
  const groups = new Map<string, { label: string; moments: MemoryMoment[] }>();

  for (const moment of activeMoments(state)) {
    const key = groupKey(moment.title, moment.tags);
    if (key.length === 0) continue;
    const group = groups.get(key);
    if (group) {
      group.moments.push(moment);
    } else {
      groups.set(key, { label: moment.title, moments: [moment] });
    }
  }

  return [...groups.values()]
    .filter((group) => group.moments.length >= 2)
    .map((group) => {
      const sorted = [...group.moments].sort((a, b) => b.happenedAt - a.happenedAt);
      const latest = sorted[0]!;
      return {
        label: group.label,
        count: group.moments.length,
        lastAt: latest.happenedAt,
        momentId: latest.id,
        category: latest.category,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

export interface MemoryAnswer {
  matched: boolean;
  answer: string;
  confidence: number;
  momentIds: ID[];
}

const QUESTION_PREFIX =
  /^\s*(when\s+did\s+i\s+(?:last\s+)?|what\s+(?:was|were|is|are)\s+|what\s+have\s+i\s+|how\s+many\s+|how\s+often\s+|where\s+did\s+i\s+|who\s+did\s+i\s+|do\s+i\s+)\s*/i;

const COUNTRY_QUESTION = /(how\s+many\s+)?(countries|countries\s+have|places|places\s+have)/i;

const BOOK_QUESTION = /\b(books?|reading|read)\b/i;

const QUERY_STOP_WORDS = new Set([
  "i", "me", "my", "the", "a", "an", "did", "do", "does", "last", "was", "were", "is",
  "are", "have", "has", "had", "it", "that", "this", "for", "to", "on", "in", "at", "and",
  "or", "of", "with", "go", "went", "play", "played", "eat", "ate", "make", "made",
]);

export function stripQuestion(question: string): string {
  return question
    .replace(QUESTION_PREFIX, "")
    .replace(/[?.!]+/g, "")
    .trim()
    .toLowerCase();
}

export function questionTokens(query: string): string[] {
  return [
    ...new Set(
      query
        .split(/[^\p{L}\p{N}]+/u)
        .map((word) => word.trim())
        .filter((word) => word.length > 2 && !QUERY_STOP_WORDS.has(word)),
    ),
  ];
}

function momentTokens(moment: MemoryMoment): Set<string> {
  const tokens = new Set<string>();
  const add = (value: string) => {
    for (const word of value.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (word.length > 2) tokens.add(word);
    }
  };
  add(moment.title);
  add(moment.description);
  add(moment.place?.name ?? "");
  add(moment.bookAuthor);
  for (const tag of moment.tags) add(tag);
  for (const person of moment.people) add(person);
  return tokens;
}

export function distinctPlaceCount(state: AppState): number {
  const names = new Set<string>();
  for (const moment of activeMoments(state)) {
    const place = moment.place?.name.trim().toLowerCase();
    if (place && place.length > 0) names.add(place);
  }
  return names.size;
}

export function answerMemoryQuestion(state: AppState, question: string, now: Timestamp = Date.now()): MemoryAnswer {
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return {
      matched: false,
      answer: "Ask something like “when did I last go on vacation?”",
      confidence: 0,
      momentIds: [],
    };
  }

  const moments = activeMoments(state);

  if (COUNTRY_QUESTION.test(trimmed)) {
    const count = distinctPlaceCount(state);
    return {
      matched: true,
      answer:
        count === 0
          ? "I have not recorded any places yet."
          : `You have been to ${count} place${count === 1 ? "" : "s"}.`,
      confidence: 0.8,
      momentIds: [],
    };
  }

  const query = stripQuestion(trimmed);
  if (query.length === 0) {
    return {
      matched: false,
      answer: "Tell me what you are trying to remember — for example “when did I last play cricket?”",
      confidence: 0,
      momentIds: [],
    };
  }

  const wantsBooks = BOOK_QUESTION.test(query);
  if (wantsBooks) {
    const books = activeMoments(state)
      .filter((moment) => moment.kind === "book")
      .sort((a, b) => b.happenedAt - a.happenedAt);
    if (books.length === 0) {
      return {
        matched: true,
        answer: "You have not recorded any books yet.",
        confidence: 0.6,
        momentIds: [],
      };
    }
    if (/when\s+did/i.test(trimmed)) {
      const latest = books[0]!;
      const when = new Date(latest.happenedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const ago = Math.max(0, Math.round((now - latest.happenedAt) / DAY));
      const author = latest.bookAuthor.trim().length > 0 ? ` by ${latest.bookAuthor}` : "";
      return {
        matched: true,
        answer: `Last time was ${when} — ${ago} day${ago === 1 ? "" : "s"} ago: “${latest.title}”${author}.`,
        confidence: 0.85,
        momentIds: [latest.id],
      };
    }
    const titles = books.slice(0, 3).map((book) => `“${book.title}”`).join(", ");
    return {
      matched: true,
      answer: `You have read ${books.length} book${books.length === 1 ? "" : "s"}: ${titles}.`,
      confidence: 0.8,
      momentIds: books.slice(0, 3).map((book) => book.id),
    };
  }

  const tokens = questionTokens(query);
  if (tokens.length === 0) {
    return {
      matched: false,
      answer: `I could not find a memory for “${query}”. Try naming the activity, place or person.`,
      confidence: 0,
      momentIds: [],
    };
  }

  const scored = activeMoments(state)
    .map((moment) => {
      const haystack = momentTokens(moment);
      let hits = 0;
      for (const token of tokens) if (haystack.has(token)) hits += 1;
      const exactTitle = moment.title.toLowerCase().includes(query) ? 2 : 0;
      return { moment, score: hits + exactTitle };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.moment.happenedAt - a.moment.happenedAt);

  if (scored.length === 0) {
    return {
      matched: false,
      answer: `I could not find a memory for “${query}”. Add one and I will remember it from now on.`,
      confidence: 0,
      momentIds: [],
    };
  }

  const best = scored[0]!;
  const when = new Date(best.moment.happenedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const ago = Math.max(0, Math.round((now - best.moment.happenedAt) / DAY));

  return {
    matched: true,
    answer: `Last time was ${when} — ${ago} day${ago === 1 ? "" : "s"} ago: “${best.moment.title}”.`,
    confidence: Math.min(1, 0.4 + best.score * 0.15),
    momentIds: [best.moment.id],
  };
}

export function memoryRelative(at: Timestamp, now: Timestamp = Date.now()): string {
  const diff = now - at;
  if (diff < DAY) return "today";
  if (diff < 2 * DAY) return "yesterday";
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  if (diff < 60 * DAY) return "1 month ago";
  const months = Math.floor(diff / (30 * DAY));
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(diff / (365 * DAY));
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

export const MEMORY_SUGGESTED_QUESTIONS: readonly string[] = [
  "When did I last go on a vacation?",
  "When did I last play cricket?",
  "How many countries have I visited?",
  "Show my gym consistency",
  "When did I last read a book?",
];