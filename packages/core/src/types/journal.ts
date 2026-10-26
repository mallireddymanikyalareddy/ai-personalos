import type { ID, Timestamp } from "./common";
import type { EntityRef } from "./base";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";
import type { NoteBlock } from "./note";
import { newId } from "./common";

export type JournalEntryStatus = "draft" | "complete" | "archived" | "trashed";

export type JournalPrivacy = "private" | "shared";

export type JournalMoodId =
  | "happy"
  | "calm"
  | "neutral"
  | "stressed"
  | "sad"
  | "frustrated"
  | "excited"
  | "tired";

export interface JournalMoodOption {
  id: JournalMoodId;
  label: string;
  emoji: string;
  score: number;
}

export const JOURNAL_MOODS: readonly JournalMoodOption[] = [
  { id: "happy", label: "Happy", emoji: "😊", score: 5 },
  { id: "excited", label: "Excited", emoji: "🤩", score: 5 },
  { id: "calm", label: "Calm", emoji: "🙂", score: 4 },
  { id: "neutral", label: "Neutral", emoji: "😐", score: 3 },
  { id: "tired", label: "Tired", emoji: "😴", score: 2 },
  { id: "stressed", label: "Stressed", emoji: "😟", score: 2 },
  { id: "sad", label: "Sad", emoji: "😔", score: 1 },
  { id: "frustrated", label: "Frustrated", emoji: "😡", score: 1 },
];

export const JOURNAL_MOOD_BY_ID: Record<string, JournalMoodOption> = JOURNAL_MOODS.reduce(
  (map, mood) => {
    map[mood.id] = mood;
    return map;
  },
  {} as Record<string, JournalMoodOption>,
);

export const DEFAULT_MOOD_SCORE = 3;

export function moodScore(moodId: string | null): number {
  if (!moodId) return DEFAULT_MOOD_SCORE;
  return JOURNAL_MOOD_BY_ID[moodId]?.score ?? DEFAULT_MOOD_SCORE;
}

export function moodLabel(moodId: string | null): string {
  if (!moodId) return "Not recorded";
  return JOURNAL_MOOD_BY_ID[moodId]?.label ?? moodId;
}

export function moodEmoji(moodId: string | null): string {
  if (!moodId) return "—";
  return JOURNAL_MOOD_BY_ID[moodId]?.emoji ?? "•";
}

export interface JournalPerson {
  id: ID;
  name: string;
  refId?: ID;
}

export interface JournalWeather {
  label: string;
  temperatureC: number | null;
  condition: string;
  source: "manual" | "provider" | "integration";
}

export interface JournalTomorrow {
  priorities: string[];
  habits: string[];
  intentions: string;
  reminders: string[];
}

export interface NewJournalEntryInput extends CanonicalInput {
  entryDate: Timestamp;
  title?: string;
  body?: string;
  blocks?: NoteBlock[];
  mood?: string | null;
  customMood?: string | null;
  energy?: number | null;
  productivity?: number | null;
  weather?: JournalWeather | null;
  location?: string | null;
  people?: JournalPerson[];
  activities?: string[];
  tags?: string[];
  highlights?: string[];
  challenges?: string[];
  gratitude?: string[];
  lessons?: string;
  improvements?: string;
  tomorrow?: Partial<JournalTomorrow>;
  status?: JournalEntryStatus;
  templateId?: ID | null;
  privacy?: JournalPrivacy;
}

export interface JournalEntry extends CanonicalEntity {
  type: "journal_entry";
  entryDate: Timestamp;
  dateKey: string;
  title: string;
  body: string;
  blocks: NoteBlock[];
  mood: string | null;
  customMood: string | null;
  energy: number | null;
  productivity: number | null;
  weather: JournalWeather | null;
  location: string | null;
  people: JournalPerson[];
  activities: string[];
  tags: string[];
  highlights: string[];
  challenges: string[];
  gratitude: string[];
  lessons: string;
  improvements: string;
  tomorrow: JournalTomorrow;
  taskIds: ID[];
  habitIds: ID[];
  goalIds: ID[];
  eventIds: ID[];
  lifeMemoryIds: ID[];
  attachmentIds: ID[];
  templateId: ID | null;
  privacy: JournalPrivacy;
  status: JournalEntryStatus;
  trashedAt: Timestamp | null;
  wordCount: number;
  readingTimeMinutes: number;
  searchVector: string;
  embedding: number[] | null;
  aiSummary: string | null;
  aiKeyPoints: string[];
  aiEntities: JournalEntity[];
  observationOnly: boolean;
}

export interface JournalEntity {
  type: "person" | "project" | "date" | "location" | "organization" | "task" | "goal" | "habit" | "concept" | "mood" | "activity";
  name: string;
  refId?: ID;
  confidence: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}

function extractBlockText(blocks: NoteBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.content) parts.push(block.content);
    if (block.children) parts.push(...block.children.map((child) => child.content ?? ""));
  }
  return parts.join(" ");
}

export function journalDateKey(entryDate: Timestamp): string {
  const date = new Date(entryDate);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyTomorrow(): JournalTomorrow {
  return { priorities: [], habits: [], intentions: "", reminders: [] };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function canonicalPeople(people: JournalPerson[]): JournalPerson[] {
  const seen = new Map<string, JournalPerson>();
  for (const person of people) {
    const key = `${person.name.trim().toLowerCase()}|${person.refId ?? ""}`;
    if (seen.has(key)) continue;
    const cleaned = person.name.trim();
    if (!cleaned) continue;
    seen.set(key, { ...person, name: cleaned });
  }
  return [...seen.values()];
}

function canonicalActivities(activities: string[]): string[] {
  const seen = new Map<string, string>();
  for (const activity of activities) {
    const clean = activity.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) seen.set(key, clean);
  }
  return [...seen.values()];
}

export function createJournalEntry(
  input: NewJournalEntryInput,
  now: Timestamp = Date.now(),
): JournalEntry {
  const blocks = input.blocks ?? [
    { id: newId(), type: "paragraph" as const, content: input.body ?? "" },
  ];
  const body = input.body ?? extractBlockText(blocks);
  const wordCount = countWords(body);

  return {
    ...createCanonicalBase(input, now),
    type: "journal_entry",
    entryDate: input.entryDate,
    dateKey: journalDateKey(input.entryDate),
    title: input.title ?? "",
    body,
    blocks,
    mood: input.mood ?? null,
    customMood: input.customMood ?? null,
    energy: clampScale(input.energy),
    productivity: clampScale(input.productivity),
    weather: input.weather ?? null,
    location: input.location ?? null,
    people: canonicalPeople(input.people ?? []),
    activities: canonicalActivities(input.activities ?? []),
    tags: dedupe(input.tags ?? []),
    highlights: dedupe(input.highlights ?? []),
    challenges: dedupe(input.challenges ?? []),
    gratitude: dedupe(input.gratitude ?? []),
    lessons: input.lessons ?? "",
    improvements: input.improvements ?? "",
    tomorrow: { ...emptyTomorrow(), ...(input.tomorrow ?? {}) },
    taskIds: [],
    habitIds: [],
    goalIds: [],
    eventIds: [],
    lifeMemoryIds: [],
    attachmentIds: [],
    templateId: input.templateId ?? null,
    privacy: input.privacy ?? "private",
    status: input.status ?? "draft",
    trashedAt: null,
    wordCount,
    readingTimeMinutes: estimateReadingTime(wordCount),
    searchVector: `${(input.title ?? "").trim()} ${body}`.toLowerCase(),
    embedding: null,
    aiSummary: null,
    aiKeyPoints: [],
    aiEntities: [],
    observationOnly: true,
  };
}

export function clampScale(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.min(10, Math.max(1, Math.round(value)));
}

export function journalEntryIsEmpty(entry: JournalEntry): boolean {
  return (
    entry.body.trim().length === 0 &&
    entry.title.trim().length === 0 &&
    entry.highlights.length === 0 &&
    entry.challenges.length === 0 &&
    entry.gratitude.length === 0 &&
    entry.tomorrow.priorities.length === 0 &&
    entry.mood == null &&
    entry.energy == null &&
    entry.attachmentIds.length === 0
  );
}

export function journalWordCount(entry: JournalEntry): number {
  return countWords(entry.body);
}

export function moveJournalEntryToTrash(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return { ...entry, status: "trashed", trashedAt: now, updatedAt: now };
}

export function restoreJournalEntry(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return { ...entry, status: "draft", trashedAt: null, updatedAt: now };
}

export function archiveJournalEntry(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return { ...entry, status: "archived", updatedAt: now };
}

export function unarchiveJournalEntry(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return { ...entry, status: "complete", updatedAt: now };
}

export function journalPreview(entry: JournalEntry, maxLength = 140): string {
  const text = entry.body.trim().replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/* ------------------------------------------------------------------ */
/* Templates                                                            */
/* ------------------------------------------------------------------ */

export type JournalTemplateKind = "builtin" | "custom";

export interface JournalTemplateSection {
  id: string;
  label: string;
  prompt: string;
  target: "body" | "highlights" | "challenges" | "gratitude" | "lessons" | "improvements" | "tomorrow";
}

export interface JournalTemplate extends CanonicalEntity {
  type: "journal_template";
  name: string;
  description: string;
  kind: JournalTemplateKind;
  sections: JournalTemplateSection[];
  suggestedMoodPrompt: boolean;
  suggestedEnergy: boolean;
  suggestedProductivity: boolean;
  usageCount: number;
}

export interface NewJournalTemplateInput extends CanonicalInput {
  name: string;
  description?: string;
  sections: JournalTemplateSection[];
  kind?: JournalTemplateKind;
  suggestedMoodPrompt?: boolean;
  suggestedEnergy?: boolean;
  suggestedProductivity?: boolean;
}

export function createJournalTemplate(
  input: NewJournalTemplateInput,
  now: Timestamp = Date.now(),
): JournalTemplate {
  return {
    ...createCanonicalBase(input, now),
    type: "journal_template",
    name: input.name.trim(),
    description: input.description ?? "",
    kind: input.kind ?? "custom",
    sections: input.sections,
    suggestedMoodPrompt: input.suggestedMoodPrompt ?? true,
    suggestedEnergy: input.suggestedEnergy ?? true,
    suggestedProductivity: input.suggestedProductivity ?? true,
    usageCount: 0,
  };
}

export function journalTemplateSection(id: string, label: string, prompt: string, target: JournalTemplateSection["target"]): JournalTemplateSection {
  return { id, label, prompt, target };
}

export const BUILTIN_JOURNAL_TEMPLATES: ReadonlyArray<{
  id: string;
  name: string;
  description: string;
  sections: JournalTemplateSection[];
}> = [
  {
    id: "daily_reflection",
    name: "Daily Reflection",
    description: "A full close-out on the day.",
    sections: [
      journalTemplateSection("s1", "How was my day?", "Write freely about the day.", "body"),
      journalTemplateSection("s2", "What went well?", "Wins, moments, progress.", "highlights"),
      journalTemplateSection("s3", "What was difficult?", "Blockers, friction, hard conversations.", "challenges"),
      journalTemplateSection("s4", "What did I learn?", "Lessons and surprises.", "lessons"),
      journalTemplateSection("s5", "What am I grateful for?", "Up to five things.", "gratitude"),
      journalTemplateSection("s6", "What matters tomorrow?", "Priorities and intentions.", "tomorrow"),
    ],
  },
  {
    id: "morning_journal",
    name: "Morning Journal",
    description: "Set the day before it starts.",
    sections: [
      journalTemplateSection("s1", "How do I feel?", "Name the mood and energy.", "body"),
      journalTemplateSection("s2", "Top 3 priorities", "What must move today?", "tomorrow"),
      journalTemplateSection("s3", "Today's intention", "One line to come back to.", "improvements"),
    ],
  },
  {
    id: "evening_review",
    name: "Evening Review",
    description: "Close the day with wins and lessons.",
    sections: [
      journalTemplateSection("s1", "Wins", "What went right?", "highlights"),
      journalTemplateSection("s2", "Challenges", "What was hard?", "challenges"),
      journalTemplateSection("s3", "Lessons", "What did today teach you?", "lessons"),
      journalTemplateSection("s4", "Gratitude", "Up to five things.", "gratitude"),
      journalTemplateSection("s5", "Tomorrow's priorities", "Set up tomorrow.", "tomorrow"),
    ],
  },
  {
    id: "weekly_review",
    name: "Weekly Review",
    description: "Look back at the whole week.",
    sections: [
      journalTemplateSection("s1", "Biggest wins", "Across the week.", "highlights"),
      journalTemplateSection("s2", "Biggest challenges", "Across the week.", "challenges"),
      journalTemplateSection("s3", "Lessons", "What the week taught you.", "lessons"),
      journalTemplateSection("s4", "Next week's priorities", "Set up next week.", "tomorrow"),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

export interface JournalLinkRef extends EntityRef {
  entryId: ID;
  createdAt: Timestamp;
}

export type JournalLinkKind = "task" | "habit" | "goal" | "event" | "life_memory_item";

export function journalLinkKey(
  entryId: ID,
  entityType: JournalLinkKind,
  entityId: ID,
): string {
  return `${entryId}:${entityType}:${entityId}`;
}

export function journalDayLabel(entryDate: Timestamp): string {
  return new Date(entryDate).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function journalEntryTitle(entry: JournalEntry): string {
  if (entry.title.trim().length > 0) return entry.title.trim();
  const firstLine = entry.body.trim().split("\n")[0] ?? "";
  if (firstLine.trim().length === 0) return journalDayLabel(entry.entryDate);
  return firstLine.length > 60 ? `${firstLine.slice(0, 59)}…` : firstLine;
}
