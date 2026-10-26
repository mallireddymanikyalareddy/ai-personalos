import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Goal } from "../../types/goal";
import type { Habit } from "../../types/habit";
import type { Project } from "../../types/project";
import { journalDateKey, type JournalEntry } from "../../types/journal";

export interface JournalSearchFilters {
  query?: string;
  from?: Timestamp;
  to?: Timestamp;
  month?: string;
  mood?: string[];
  tags?: string[];
  people?: string[];
  location?: string;
  activities?: string[];
  goalIds?: ID[];
  projectIds?: ID[];
  habitIds?: ID[];
  hasPhotos?: boolean;
  status?: "draft" | "complete" | "archived" | "trashed" | "active";
}

export interface JournalSearchResult {
  entry: JournalEntry;
  score: number;
  matched: string[];
}

function normalise(value: string): string {
  return value.toLowerCase();
}

function entryText(entry: JournalEntry): string {
  return [
    entry.title,
    entry.body,
    ...entry.tags,
    ...entry.highlights,
    ...entry.challenges,
    ...entry.gratitude,
    ...entry.activities,
    ...entry.people.map((person) => person.name),
    ...entry.tomorrow.priorities,
    ...entry.tomorrow.habits,
    entry.tomorrow.intentions,
    entry.location ?? "",
    entry.weather?.label ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function scoreEntry(entry: JournalEntry, query: string): { score: number; matched: string[] } {
  const text = entryText(entry);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  const matched: string[] = [];

  for (const term of terms) {
    if (text.includes(term)) {
      score += term.length > 3 ? 3 : 1;
      matched.push(term);
    }
  }

  if (score > 0 && entry.title.toLowerCase().includes(query.toLowerCase())) {
    score += 4;
  }
  return { score, matched };
}

function matchesFilters(
  entry: JournalEntry,
  filters: JournalSearchFilters,
  goals?: Record<ID, Goal>,
  habits?: Record<ID, Habit>,
  projects?: Record<ID, Project>,
): boolean {
  if (filters.from != null && entry.entryDate < filters.from) return false;
  if (filters.to != null && entry.entryDate > filters.to) return false;
  if (filters.month != null && !entry.dateKey.startsWith(filters.month)) return false;
  if (filters.status && filters.status !== "active" && entry.status !== filters.status) {
    return false;
  }
  if (filters.status === "active" && entry.status === "trashed") return false;
  if (filters.mood && filters.mood.length > 0) {
    const moodIds = entry.mood ? [entry.mood] : [];
    if (entry.customMood) moodIds.push(entry.customMood.toLowerCase());
    if (!filters.mood.some((mood) => moodIds.includes(mood))) return false;
  }
  if (filters.tags && filters.tags.length > 0) {
    if (!filters.tags.every((tag) => entry.tags.includes(tag.replace(/^#/, "")))) return false;
  }
  if (filters.people && filters.people.length > 0) {
    const names = entry.people.map((person) => person.name.toLowerCase());
    if (!filters.people.some((person) => names.includes(person.toLowerCase()))) return false;
  }
  if (filters.location != null && filters.location.length > 0) {
    if (!(entry.location ?? "").toLowerCase().includes(filters.location.toLowerCase())) return false;
  }
  if (filters.activities && filters.activities.length > 0) {
    const activities = entry.activities.map((activity) => activity.toLowerCase());
    if (!filters.activities.some((activity) => activities.includes(activity.toLowerCase()))) {
      return false;
    }
  }
  if (filters.goalIds && filters.goalIds.length > 0) {
    if (!filters.goalIds.some((goalId) => entry.goalIds.includes(goalId))) {
      if (!goalTextMatches(entry, filters.goalIds, goals)) return false;
    }
  }
  if (filters.habitIds && filters.habitIds.length > 0) {
    if (!filters.habitIds.some((habitId) => entry.habitIds.includes(habitId))) {
      if (!habitTextMatches(entry, filters.habitIds, habits)) return false;
    }
  }
  if (filters.projectIds && filters.projectIds.length > 0) {
    const names = Object.values(projects ?? {})
      .filter((project) => filters.projectIds!.includes(project.id))
      .map((project) => project.name.toLowerCase());
    const text = entryText(entry);
    if (!names.some((name) => text.includes(name))) return false;
  }
  if (filters.hasPhotos != null && filters.hasPhotos) {
    if (entry.attachmentIds.length === 0) return false;
  }
  return true;
}

function goalTextMatches(
  entry: JournalEntry,
  goalIds: ID[],
  goals?: Record<ID, Goal>,
): boolean {
  if (!goals) return false;
  const text = entryText(entry);
  return Object.values(goals)
    .filter((goal) => goalIds.includes(goal.id))
    .some((goal) => text.includes(goal.title.toLowerCase()));
}

function habitTextMatches(
  entry: JournalEntry,
  habitIds: ID[],
  habits?: Record<ID, Habit>,
): boolean {
  if (!habits) return false;
  const text = entryText(entry);
  return Object.values(habits)
    .filter((habit) => habitIds.includes(habit.id))
    .some((habit) => text.includes(habit.title.toLowerCase()));
}

export function searchJournalEntries(
  state: AppState,
  filters: JournalSearchFilters,
): JournalSearchResult[] {
  const query = filters.query?.trim() ?? "";
  const results: JournalSearchResult[] = [];

  for (const entry of Object.values(state.journalEntries)) {
    if (!matchesFilters(entry, filters, state.goals, state.habits, state.projects)) continue;
    if (query.length === 0) {
      results.push({ entry, score: 0, matched: [] });
      continue;
    }
    const { score, matched } = scoreEntry(entry, query);
    if (score > 0) results.push({ entry, score, matched });
  }

  return results.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : b.entry.entryDate - a.entry.entryDate,
  );
}

export function journalTagCloud(state: AppState, limit = 20): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status === "trashed") continue;
    for (const tag of entry.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

export function journalSuggestedTags(entry: JournalEntry, all: Array<{ tag: string; count: number }>, limit = 6): string[] {
  const text = entryText(entry);
  return all
    .filter((candidate) => !entry.tags.includes(candidate.tag))
    .filter((candidate) => text.includes(candidate.tag))
    .slice(0, limit)
    .map((candidate) => candidate.tag);
}

export function journalPeopleNames(state: AppState): string[] {
  const counts = new Map<string, number>();
  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status === "trashed") continue;
    for (const person of entry.people) {
      counts.set(person.name, (counts.get(person.name) ?? 0) + 1);
    }
  }
  return [...counts.keys()].sort((a, b) => a.localeCompare(b));
}

export function journalLocations(state: AppState): string[] {
  const set = new Set<string>();
  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status === "trashed" || !entry.location) continue;
    set.add(entry.location);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function journalActivities(state: AppState): string[] {
  const counts = new Map<string, number>();
  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status === "trashed") continue;
    for (const activity of entry.activities) {
      counts.set(activity, (counts.get(activity) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([activity]) => activity);
}

export function journalAnswerQuestion(state: AppState, question: string): string {
  const normalised = normalise(question);
  const entries = activeEntries(state);

  if (/when did i last|last time i|when was the last/.test(normalised)) {
    const target = extractSubject(normalised);
    const found = entries
      .filter((entry) => entryText(entry).includes(target))
      .sort((a, b) => b.entryDate - a.entryDate)[0];
    if (!found) return `Nothing in your journal mentions "${target}" yet.`;
    return `You last mentioned "${target}" on ${new Date(found.entryDate).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}.`;
  }

  if (/how (was|did) i feel|mood on|felt on/.test(normalised)) {
    const dateKey = extractDateKey(normalised);
    if (dateKey) {
      const entry = entries.find((candidate) => candidate.dateKey === dateKey);
      if (!entry?.mood) return "There is no mood recorded for that day.";
      return `On that day you recorded ${entry.mood}.`;
    }
  }

  if (/days? i felt (happy|calm|stressed|sad|frustrated|excited|tired)/.test(normalised)) {
    const mood = normalised.match(/days? i felt (\w+)/)?.[1] ?? "";
    const matching = entries.filter((entry) => entry.mood === mood);
    return `${matching.length} entries recorded a ${mood} mood.`;
  }

  const results = searchJournalEntries(state, { query: question });
  if (results.length === 0) return "Nothing in your journal matches that yet.";
  const top = results.slice(0, 3);
  return top
    .map((result) => `${new Date(result.entry.entryDate).toLocaleDateString()}: ${result.entry.title || "Journal entry"}`)
    .join("\n");
}

function activeEntries(state: AppState): JournalEntry[] {
  return Object.values(state.journalEntries)
    .filter((entry) => entry.status !== "trashed")
    .sort((a, b) => b.entryDate - a.entryDate);
}

function extractSubject(text: string): string {
  const cleaned = text
    .replace(/.*?(when did i last|last time i|when was the last)/, "")
    .replace(/\?/g, "")
    .replace(/^(play|go to|visit|watch|eat at|do)\s+/, "")
    .trim();
  return cleaned.length > 0 ? cleaned : text.trim();
}

function extractDateKey(text: string): string | null {
  const monthMatch = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/);
  if (monthMatch) {
    const monthIndex = [
      "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    ].indexOf(monthMatch[1]!);
    const year = new Date().getFullYear();
    return `${year}-${`${monthIndex + 1}`.padStart(2, "0")}-${`${Number(monthMatch[2])}`.padStart(2, "0")}`;
  }
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
}

export function journalDateKeys(entries: JournalEntry[]): string[] {
  return entries.map((entry) => entry.dateKey).sort();
}

export function journalEntryExistsFor(state: AppState, at: Timestamp): boolean {
  return journalEntryForDateKey(state, journalDateKey(at)) != null;
}

function journalEntryForDateKey(state: AppState, dateKey: string): JournalEntry | null {
  return (
    Object.values(state.journalEntries).find(
      (entry) => entry.dateKey === dateKey && entry.status !== "trashed",
    ) ?? null
  );
}

export type { JournalEntry };
