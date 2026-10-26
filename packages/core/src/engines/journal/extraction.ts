import type { ID, Timestamp } from "../../types/common";
import type { Habit } from "../../types/habit";
import type { Goal } from "../../types/goal";
import type { Priority } from "../../types/common";
import type { JournalEntry } from "../../types/journal";
import { journalMoodFromTextCandidates } from "./entries";

export interface JournalTaskCandidate {
  title: string;
  dueAt: Timestamp | null;
  scheduledAt: Timestamp | null;
  priority: Priority;
  estimateMin: number | null;
  projectId: ID | null;
  goalIds: ID[];
  fragment: string;
}

export interface JournalEventCandidate {
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  location: string | null;
  fragment: string;
}

export interface JournalHabitCandidate {
  habitId: ID;
  title: string;
  phrase: string;
  confidence: number;
}

export interface JournalGoalCandidate {
  goalId: ID;
  title: string;
  phrase: string;
  confidence: number;
}

const DAY_MS = 86_400_000;

const TASK_VERBS = [
  "need to",
  "needs to",
  "must",
  "have to",
  "have got to",
  "remember to",
  "don't forget to",
  "should",
  "ought to",
  "going to",
  "will finish",
  "will complete",
  "need finish",
  "need complete",
  "todo",
  "to do",
  "must finish",
  "must complete",
  "plan to",
  "want to finish",
];

const PAST_HINTS = ["finished", "completed", "done", "went", "sent", "booked", "paid", "fixed", "wrote", "shipped"];

const ESTIMATE_WORDS: Array<{ pattern: RegExp; minutes: number }> = [
  { pattern: /\b(?:for|about|around)?\s*(\d{1,3})\s*(?:h|hr|hrs|hour|hours)\b/, minutes: 60 },
];

const NEXT_DAY_WORDS = ["tomorrow", "next day", "the following day"];
const TIME_OF_DAY: Array<{ pattern: RegExp; hour: number }> = [
  { pattern: /\bmorning\b/, hour: 9 },
  { pattern: /\bnoon\b|\bmidday\b/, hour: 12 },
  { pattern: /\bafternoon\b/, hour: 14 },
  { pattern: /\bevening\b/, hour: 18 },
  { pattern: /\bnight\b/, hour: 21 },
];

function cleanFragment(fragment: string): string {
  return fragment
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\btomorrow\b/gi, "")
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, "")
    .replace(/\bfor\s+\d{1,3}\s*(h|hr|hrs|hour|hours)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s.,;:!?-]+$/, "")
    .trim();
}

function titleCaseSentence(text: string): string {
  const cleaned = cleanFragment(text);
  if (cleaned.length === 0) return "";
  const withCapital = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return withCapital.length > 80 ? `${withCapital.slice(0, 79)}…` : withCapital;
}

function parseDueAt(fragment: string, now: Timestamp): Timestamp | null {
  const lower = fragment.toLowerCase();
  for (const word of NEXT_DAY_WORDS) {
    if (lower.includes(word)) {
      return journalStartOfDay(now) + DAY_MS + 9 * 3_600_000;
    }
  }
  if (/\btoday\b/.test(lower)) return journalStartOfDay(now) + 17 * 3_600_000;
  return null;
}

function journalStartOfDay(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function parseScheduledAt(fragment: string, now: Timestamp): Timestamp | null {
  const lower = fragment.toLowerCase();
  const explicit = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (explicit) {
    const hour12 = Number(explicit[1]);
    const minutes = explicit[2] ? Number(explicit[2]) : 0;
    const meridiem = explicit[3];
    let hour = hour12 % 12;
    if (meridiem === "pm") hour += 12;
    const base = journalStartOfDay(now) + (lower.includes("tomorrow") ? DAY_MS : 0);
    return base + hour * 3_600_000 + minutes * 60_000;
  }
  for (const entry of TIME_OF_DAY) {
    if (entry.pattern.test(lower)) {
      return journalStartOfDay(now) + entry.hour * 3_600_000 + (lower.includes("tomorrow") ? DAY_MS : 0);
    }
  }
  return null;
}

function parseEstimateMinutes(fragment: string): number | null {
  const lower = fragment.toLowerCase();
  const match = lower.match(/(\d{1,3})\s*(?:h|hr|hrs|hour|hours)\b/);
  if (match) return Number(match[1]) * 60;
  const minutes = lower.match(/(\d{1,3})\s*(?:m|min|mins|minutes)\b/);
  if (minutes) return Number(minutes[1]);
  return null;
}

function parsePriority(fragment: string): Priority {
  if (/\b(urgent|asap|critical|today!|immediately)\b/i.test(fragment)) return 4;
  if (/\b(important|high priority|must)\b/i.test(fragment)) return 3;
  return 1;
}

export function extractJournalTaskCandidates(
  text: string,
  options: { goals?: Goal[]; projects?: Array<{ id: ID; name: string }>; now?: Timestamp } = {},
): JournalTaskCandidate[] {
  const now = options.now ?? Date.now();
  const candidates: JournalTaskCandidate[] = [];
  const seen = new Set<string>();

  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    const hasVerb = TASK_VERBS.some((verb) => lower.includes(verb));
    const isPast = PAST_HINTS.some((hint) => new RegExp(`\\b${hint}\\b`).test(lower));
    if (!hasVerb || isPast) continue;

    const verbIndex = TASK_VERBS.map((verb) => lower.indexOf(verb)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
    if (verbIndex == null) continue;
    const fragment = trimmed.slice(verbIndex + TASK_VERBS.find((verb) => lower.indexOf(verb) === verbIndex)!.length);

    if (fragment.length < 3) continue;
    const title = titleCaseSentence(fragment);
    if (title.length < 3) continue;

    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const goalIds = (options.goals ?? [])
      .filter((goal) => lower.includes(goal.title.toLowerCase()))
      .map((goal) => goal.id);
    const projectId = (options.projects ?? []).find((project) => lower.includes(project.name.toLowerCase()))?.id ?? null;

    candidates.push({
      title,
      dueAt: parseDueAt(lower, now),
      scheduledAt: parseScheduledAt(lower, now),
      priority: parsePriority(lower),
      estimateMin: parseEstimateMinutes(lower),
      projectId,
      goalIds,
      fragment: trimmed,
    });
  }

  return candidates.map((candidate) => {
    for (const rule of ESTIMATE_WORDS) {
      rule.pattern.lastIndex = 0;
    }
    return candidate;
  });
}

export function extractJournalEventCandidates(
  text: string,
  options: { now?: Timestamp } = {},
): JournalEventCandidate[] {
  const now = options.now ?? Date.now();
  const candidates: JournalEventCandidate[] = [];
  const seen = new Set<string>();

  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();

    const callPattern = /\bcall\b|\bphone\b|\bmeet(ing)? with\b|\bcatch up with\b|\bcall back\b/;
    if (!callPattern.test(lower)) continue;

    const startsAt = parseScheduledAt(lower, now);
    if (startsAt == null) continue;

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    const title = timeMatch
      ? trimmed.slice(0, trimmed.toLowerCase().indexOf(timeMatch[0])).trim()
      : trimmed;
    const cleanedTitle = title.replace(/\b(need to|i need|i have to|must)\b/gi, "").replace(/\b(call|phone)\b/gi, "Call").trim();

    const key = cleanedTitle.toLowerCase();
    if (seen.has(key) || cleanedTitle.length < 3) continue;
    seen.add(key);

    candidates.push({
      title: cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1),
      startsAt,
      endsAt: startsAt + 30 * 60_000,
      location: parseLocation(trimmed),
      fragment: trimmed,
    });
  }

  return candidates;
}

function parseLocation(fragment: string): string | null {
  const match = fragment.match(/\b(?:at|in)\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)*)/);
  return match?.[1] ?? null;
}

export function matchJournalHabits(
  text: string,
  habits: Habit[],
): JournalHabitCandidate[] {
  const lower = text.toLowerCase();
  const candidates: JournalHabitCandidate[] = [];

  for (const habit of habits) {
    if (habit.archived) continue;
    const title = habit.title.toLowerCase();
    const stems = new Set([
      title,
      title.replace(/(ing|ed|e)$/, ""),
      title.replace(/(y|ies)$/, "y"),
      title.replace(/s$/, ""),
    ]);
    const matched = [...stems].find((stem) => stem.length >= 3 && new RegExp(`\\b${escapeRegExp(stem)}`).test(lower));
    if (!matched) continue;

    const pastTense = new RegExp(`\\b(${escapeRegExp(matched)}ed|did\\s+${escapeRegExp(matched)}|went\\s+${escapeRegExp(matched)}|have\\s+${escapeRegExp(matched)}|completed\\s+(my\\s+)?${escapeRegExp(matched)}|finished\\s+(my\\s+)?${escapeRegExp(matched)})`).test(lower);
    candidates.push({
      habitId: habit.id,
      title: habit.title,
      phrase: matched,
      confidence: pastTense ? 0.9 : 0.5,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

export function matchJournalGoals(
  text: string,
  goals: Goal[],
): JournalGoalCandidate[] {
  const lower = text.toLowerCase();
  const candidates: JournalGoalCandidate[] = [];

  for (const goal of goals) {
    const title = goal.title.toLowerCase();
    const stems = new Set([title, title.replace(/(ing|ed)$/, ""), title.replace(/s$/, "")]);
    let matched = [...stems].find((stem) => stem.length >= 3 && lower.includes(stem));
    let confidence = matched ? (/\b(progress|working on|spent|advanced|moved closer|learning|reading|practis(ed|ing))\b/.test(lower) ? 0.8 : 0.4) : 0;

    if (!matched) {
      const words = title.split(/\s+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
      const hits = words.filter((word) => new RegExp(`\\b${escapeRegExp(word)}`).test(lower));
      if (hits.length >= 1) {
        matched = hits[0]!;
        confidence = hits.length >= 2 ? 0.7 : 0.45;
      }
    }

    if (!matched) continue;
    candidates.push({
      goalId: goal.id,
      title: goal.title,
      phrase: matched,
      confidence,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

const STOP_WORDS = new Set(["have", "that", "with", "from", "this", "your", "more", "than", "into", "about"]);

export function detectJournalMood(text: string): string | null {
  return journalMoodFromTextCandidates(text);
}

export interface JournalImportantMemoryCandidate {
  label: string;
  reason: string;
  confidence: number;
}

const MEMORY_PATTERNS: Array<{ pattern: RegExp; label: string; reason: string; confidence: number }> = [
  { pattern: /\b(cricket|football|match|tournament|game)\b/i, label: "Match or game", reason: "Sporting moment worth remembering", confidence: 0.8 },
  { pattern: /\b(trip|travel|flew|flight|visited|holiday|vacation)\b/i, label: "Travel", reason: "Travel memory", confidence: 0.85 },
  { pattern: /\b(wedding|birthday|anniversary|graduation|ceremony)\b/i, label: "Life event", reason: "Significant family event", confidence: 0.9 },
  { pattern: /\b(restaurant|dinner at|cafe|ate at)\b/i, label: "Restaurant", reason: "Somewhere you ate", confidence: 0.6 },
  { pattern: /\b(finished|completed|shipped|published|launched)\b.{0,60}\b(book|course|project|milestone|goal)\b/i, label: "Achievement", reason: "Reached a milestone", confidence: 0.85 },
  { pattern: /\b(passed|certified|certificate|promotion|promoted)\b/i, label: "Achievement", reason: "Recognition or milestone", confidence: 0.85 },
];

export function detectImportantMemories(entry: JournalEntry): JournalImportantMemoryCandidate[] {
  const text = `${entry.title} ${entry.body} ${entry.highlights.join(" ")}`;
  const found: JournalImportantMemoryCandidate[] = [];
  for (const rule of MEMORY_PATTERNS) {
    if (rule.pattern.test(text)) {
      found.push({ label: rule.label, reason: rule.reason, confidence: rule.confidence });
    }
  }
  return found;
}

export function journalTaskAlreadyExists(
  candidate: JournalTaskCandidate,
  existing: string[],
): boolean {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const candidateTitle = normalise(candidate.title);
  return existing.some((title) => {
    const existingTitle = normalise(title);
    if (existingTitle === candidateTitle) return true;
    const words = candidateTitle.split(" ").filter((word) => word.length > 4);
    if (words.length === 0) return false;
    const matched = words.filter((word) => existingTitle.includes(word));
    return matched.length === words.length;
  });
}

export function journalEventAlreadyExists(
  candidate: JournalEventCandidate,
  existing: Array<{ startsAt: Timestamp; title: string }>,
): boolean {
  return existing.some(
    (event) => Math.abs(event.startsAt - candidate.startsAt) < 60 * 60_000,
  );
}

export function detectJournalActivities(text: string): string[] {
  const lower = text.toLowerCase();
  const activities: Array<{ label: string; pattern: RegExp }> = [
    { label: "Cricket", pattern: /\bcricket\b/ },
    { label: "Gym", pattern: /\bgym\b|\bworkout\b|\bweights\b/ },
    { label: "Running", pattern: /\brun(ning)?\b/ },
    { label: "Cycling", pattern: /\bcycl(e|ing)\b/ },
    { label: "Walking", pattern: /\bwalk(ed|ing)?\b/ },
    { label: "Reading", pattern: /\bread(ing)?\b/ },
    { label: "Cooking", pattern: /\bcook(ed|ing)?\b/ },
    { label: "Family time", pattern: /\bfamily\b/ },
    { label: "Friends", pattern: /\bfriends?\b/ },
    { label: "Work", pattern: /\bwork(ed|ing)?\b/ },
    { label: "Meetings", pattern: /\bmeeting(s)?\b/ },
    { label: "Learning", pattern: /\blearn(ed|ing)?\b|\bcourse\b/ },
    { label: "Gaming", pattern: /\bgam(e|ing)\b/ },
    { label: "Meditation", pattern: /\bmeditat(e|ed|ion)\b/ },
    { label: "Sleep", pattern: /\bslept\b|\bsleep\b/ },
  ];
  return activities.filter((activity) => activity.pattern.test(lower)).map((activity) => activity.label);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
