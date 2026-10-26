import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import {
  JOURNAL_MOODS,
  JOURNAL_MOOD_BY_ID,
  archiveJournalEntry,
  createJournalEntry,
  journalDateKey,
  journalEntryIsEmpty,
  journalPreview,
  moveJournalEntryToTrash,
  restoreJournalEntry,
  unarchiveJournalEntry,
  type JournalEntry,
  type JournalEntryStatus,
  type JournalMoodId,
  type JournalMoodOption,
  type JournalPerson,
  type JournalTemplate,
  type NewJournalEntryInput,
} from "../../types/journal";

export type JournalListedTarget = "highlights" | "challenges" | "gratitude";

export interface JournalListOptions {
  from?: Timestamp;
  to?: Timestamp;
  status?: JournalEntryStatus | "active";
  limit?: number;
  offset?: number;
}

export function journalMoodOptions(): JournalMoodOption[] {
  return [...JOURNAL_MOODS];
}

export function journalMoodById(id: string | null): JournalMoodOption | null {
  if (!id) return null;
  return JOURNAL_MOOD_BY_ID[id] ?? null;
}

export function journalMoodIsCustom(moodId: string | null): boolean {
  return moodId != null && moodId.length > 0 && JOURNAL_MOOD_BY_ID[moodId] == null;
}

export function journalEntriesForRange(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): JournalEntry[] {
  return Object.values(state.journalEntries)
    .filter((entry) => entry.entryDate >= from && entry.entryDate <= to && entry.status !== "trashed")
    .sort((a, b) => b.entryDate - a.entryDate);
}

export function journalEntryForDate(state: AppState, at: Timestamp): JournalEntry | null {
  const key = journalDateKey(at);
  return journalEntryForDateKey(state, key);
}

export function journalEntryForDateKey(state: AppState, dateKey: string): JournalEntry | null {
  return (
    Object.values(state.journalEntries).find(
      (entry) => entry.dateKey === dateKey && entry.status !== "trashed",
    ) ?? null
  );
}

export function activeJournalEntries(state: AppState): JournalEntry[] {
  return Object.values(state.journalEntries)
    .filter((entry) => entry.status !== "trashed")
    .sort((a, b) => b.entryDate - a.entryDate);
}

export function journalDayMap(state: AppState): Map<string, JournalEntry> {
  const map = new Map<string, JournalEntry>();
  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status === "trashed") continue;
    map.set(entry.dateKey, entry);
  }
  return map;
}

export function journalPage(
  entries: JournalEntry[],
  options: JournalListOptions = {},
): JournalEntry[] {
  let result = entries;
  if (options.from != null) {
    result = result.filter((entry) => entry.entryDate >= options.from!);
  }
  if (options.to != null) {
    result = result.filter((entry) => entry.entryDate <= options.to!);
  }
  if (options.status && options.status !== "active") {
    result = result.filter((entry) => entry.status === options.status);
  }
  const offset = options.offset ?? 0;
  const limit = options.limit ?? result.length;
  return result.slice(offset, offset + limit);
}

export function journalEntryForCreation(
  state: AppState,
  input: NewJournalEntryInput,
  now: Timestamp = Date.now(),
): JournalEntry {
  const existing = journalEntryForDate(state, input.entryDate);
  const base = createJournalEntry(input, now);
  if (!existing) return base;
  return {
    ...base,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
    status: existing.status,
    trashedAt: existing.trashedAt,
    taskIds: existing.taskIds,
    habitIds: existing.habitIds,
    goalIds: existing.goalIds,
    eventIds: existing.eventIds,
    lifeMemoryIds: existing.lifeMemoryIds,
    attachmentIds: existing.attachmentIds,
    aiSummary: existing.aiSummary,
    aiKeyPoints: existing.aiKeyPoints,
    aiEntities: existing.aiEntities,
  };
}

export function journalPatchForUpdate(
  entry: JournalEntry,
  patch: Partial<JournalEntry>,
  now: Timestamp = Date.now(),
): JournalEntry {
  const merged: JournalEntry = { ...entry, ...patch, updatedAt: now };
  if (patch.body !== undefined || patch.blocks !== undefined || patch.title !== undefined) {
    const words = merged.body.trim().split(/\s+/).filter(Boolean).length;
    merged.wordCount = words;
    merged.readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
    merged.searchVector = `${merged.title.trim()} ${merged.body}`.toLowerCase();
  }
  return merged;
}

export function journalMoodFromTextCandidates(text: string): JournalMoodId | null {
  const lower = text.toLowerCase();
  if (/\b(angry|furious|irritated|annoyed|mad at|frustrated)\b/.test(lower)) return "frustrated";
  if (/\b(sad|down|low|blue|unhappy|cried|miserable)\b/.test(lower)) return "sad";
  if (/\b(stressed|overwhelmed|anxious|pressure|swamped|burnt out|burned out)\b/.test(lower)) return "stressed";
  if (/\b(exhausted|drained|wiped|knackered|no energy)\b/.test(lower)) return "tired";
  if (/\b(amazing|thrilled|pumped|stoked|fantastic day|awesome)\b/.test(lower)) return "excited";
  if (/\b(happy|great day|good day|joyful|delighted|content)\b/.test(lower)) return "happy";
  if (/\b(calm|relaxed|peaceful|settled|quiet day)\b/.test(lower)) return "calm";
  if (/\b(okay|fine|normal|ordinary|average|nothing special)\b/.test(lower)) return "neutral";
  return null;
}

function withEntry(entry: JournalEntry, change: Partial<JournalEntry>): JournalEntry {
  return { ...entry, ...change };
}

export function journalAttachTask(entry: JournalEntry, taskId: ID): JournalEntry {
  if (entry.taskIds.includes(taskId)) return entry;
  return withEntry(entry, { taskIds: [...entry.taskIds, taskId] });
}

export function journalAttachGoal(entry: JournalEntry, goalId: ID): JournalEntry {
  if (entry.goalIds.includes(goalId)) return entry;
  return withEntry(entry, { goalIds: [...entry.goalIds, goalId] });
}

export function journalAttachHabit(entry: JournalEntry, habitId: ID): JournalEntry {
  if (entry.habitIds.includes(habitId)) return entry;
  return withEntry(entry, { habitIds: [...entry.habitIds, habitId] });
}

export function journalAttachEvent(entry: JournalEntry, eventId: ID): JournalEntry {
  if (entry.eventIds.includes(eventId)) return entry;
  return withEntry(entry, { eventIds: [...entry.eventIds, eventId] });
}

export function journalAttachLifeMemory(entry: JournalEntry, lifeMemoryId: ID): JournalEntry {
  if (entry.lifeMemoryIds.includes(lifeMemoryId)) return entry;
  return withEntry(entry, { lifeMemoryIds: [...entry.lifeMemoryIds, lifeMemoryId] });
}

export function journalAttachAttachment(entry: JournalEntry, attachmentId: ID): JournalEntry {
  if (entry.attachmentIds.includes(attachmentId)) return entry;
  return withEntry(entry, { attachmentIds: [...entry.attachmentIds, attachmentId] });
}

export function journalDetach(
  entry: JournalEntry,
  kind: "task" | "goal" | "habit" | "event" | "life_memory",
  id: ID,
): JournalEntry {
  switch (kind) {
    case "task":
      return withEntry(entry, { taskIds: entry.taskIds.filter((value) => value !== id) });
    case "goal":
      return withEntry(entry, { goalIds: entry.goalIds.filter((value) => value !== id) });
    case "habit":
      return withEntry(entry, { habitIds: entry.habitIds.filter((value) => value !== id) });
    case "event":
      return withEntry(entry, { eventIds: entry.eventIds.filter((value) => value !== id) });
    case "life_memory":
      return withEntry(entry, { lifeMemoryIds: entry.lifeMemoryIds.filter((value) => value !== id) });
  }
}

export function journalAddPerson(entry: JournalEntry, name: string, refId?: ID): JournalEntry {
  const clean = name.trim();
  if (!clean) return entry;
  const existing = entry.people.find((person) => person.name.toLowerCase() === clean.toLowerCase());
  if (existing) {
    if (refId && !existing.refId) {
      return withEntry(entry, {
        people: entry.people.map((person) =>
          person.id === existing.id ? { ...person, refId } : person,
        ),
      });
    }
    return entry;
  }
  const person: JournalPerson = {
    id: `person_${clean.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    name: clean,
    refId,
  };
  return withEntry(entry, { people: [...entry.people, person] });
}

export function journalRemovePerson(entry: JournalEntry, personId: ID): JournalEntry {
  return withEntry(entry, { people: entry.people.filter((person) => person.id !== personId) });
}

export function journalAddActivity(entry: JournalEntry, activity: string): JournalEntry {
  const clean = activity.trim();
  if (!clean) return entry;
  if (entry.activities.some((value) => value.toLowerCase() === clean.toLowerCase())) return entry;
  return withEntry(entry, { activities: [...entry.activities, clean] });
}

export function journalRemoveActivity(entry: JournalEntry, activity: string): JournalEntry {
  return withEntry(entry, {
    activities: entry.activities.filter((value) => value !== activity),
  });
}

export function journalAddTag(entry: JournalEntry, tag: string): JournalEntry {
  const clean = normaliseTag(tag);
  if (!clean) return entry;
  if (entry.tags.includes(clean)) return entry;
  return withEntry(entry, { tags: [...entry.tags, clean] });
}

export function journalRemoveTag(entry: JournalEntry, tag: string): JournalEntry {
  return withEntry(entry, { tags: entry.tags.filter((value) => value !== tag) });
}

export function normaliseTag(tag: string): string {
  return tag.trim().replace(/^#/, "").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
}

export function journalAddListed(
  entry: JournalEntry,
  target: JournalListedTarget,
  value: string,
): JournalEntry {
  const clean = value.trim();
  if (!clean) return entry;
  if (entry[target].some((item) => item.toLowerCase() === clean.toLowerCase())) return entry;
  return withEntry(entry, { [target]: [...entry[target], clean] });
}

export function journalRemoveListed(
  entry: JournalEntry,
  target: JournalListedTarget,
  value: string,
): JournalEntry {
  return withEntry(entry, { [target]: entry[target].filter((item) => item !== value) });
}

export function journalAddPriority(entry: JournalEntry, value: string): JournalEntry {
  const clean = value.trim();
  if (!clean) return entry;
  return withEntry(entry, {
    tomorrow: { ...entry.tomorrow, priorities: [...entry.tomorrow.priorities, clean] },
  });
}

export function journalRemovePriority(entry: JournalEntry, value: string): JournalEntry {
  return withEntry(entry, {
    tomorrow: {
      ...entry.tomorrow,
      priorities: entry.tomorrow.priorities.filter((item) => item !== value),
    },
  });
}

export function journalAddHabitForTomorrow(entry: JournalEntry, habitLabel: string): JournalEntry {
  const clean = habitLabel.trim();
  if (!clean || entry.tomorrow.habits.includes(clean)) return entry;
  return withEntry(entry, {
    tomorrow: { ...entry.tomorrow, habits: [...entry.tomorrow.habits, clean] },
  });
}

export function journalRemoveHabitForTomorrow(entry: JournalEntry, habitLabel: string): JournalEntry {
  return withEntry(entry, {
    tomorrow: {
      ...entry.tomorrow,
      habits: entry.tomorrow.habits.filter((item) => item !== habitLabel),
    },
  });
}

export function journalSetIntentions(entry: JournalEntry, value: string): JournalEntry {
  return withEntry(entry, { tomorrow: { ...entry.tomorrow, intentions: value } });
}

export function journalAddReminder(entry: JournalEntry, value: string): JournalEntry {
  const clean = value.trim();
  if (!clean) return entry;
  return withEntry(entry, {
    tomorrow: { ...entry.tomorrow, reminders: [...entry.tomorrow.reminders, clean] },
  });
}

export function journalRemoveReminder(entry: JournalEntry, value: string): JournalEntry {
  return withEntry(entry, {
    tomorrow: {
      ...entry.tomorrow,
      reminders: entry.tomorrow.reminders.filter((item) => item !== value),
    },
  });
}

export function journalTrash(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return moveJournalEntryToTrash(entry, now);
}

export function journalRestore(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return restoreJournalEntry(entry, now);
}

export function journalArchive(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return archiveJournalEntry(entry, now);
}

export function journalUnarchive(entry: JournalEntry, now: Timestamp = Date.now()): JournalEntry {
  return unarchiveJournalEntry(entry, now);
}

export function journalMarkComplete(entry: JournalEntry): JournalEntry {
  if (entry.status === "complete") return entry;
  return { ...entry, status: "complete" };
}

export function journalMarkDraft(entry: JournalEntry): JournalEntry {
  if (entry.status === "draft") return entry;
  return { ...entry, status: "draft" };
}

export function journalRecoverable(state: AppState): JournalEntry[] {
  return Object.values(state.journalEntries)
    .filter((entry) => entry.status === "trashed")
    .sort((a, b) => (b.trashedAt ?? b.updatedAt) - (a.trashedAt ?? a.updatedAt));
}

export function journalCanRestore(
  entry: JournalEntry,
  days = 30,
  now: Timestamp = Date.now(),
): boolean {
  if (entry.status !== "trashed") return false;
  const trashedAt = entry.trashedAt ?? entry.updatedAt;
  return now - trashedAt <= days * 86_400_000;
}

export function journalEntryIsEmptyForSave(entry: JournalEntry): boolean {
  return journalEntryIsEmpty(entry);
}

export function journalSnippet(entry: JournalEntry, length = 140): string {
  return journalPreview(entry, length);
}

function templateSectionHeading(section: { label: string }): string {
  return section.label ? `## ${section.label}\n` : "";
}

export function journalTemplateBody(template: JournalTemplate): string {
  const bodySections = template.sections.filter((section) => section.target === "body");
  if (bodySections.length === 0) return "";
  return bodySections.map((section) => `${templateSectionHeading(section)}${section.prompt}`).join("\n\n");
}

export function journalTemplatePrompts(
  template: JournalTemplate,
  target: "highlights" | "challenges" | "gratitude" | "lessons" | "improvements" | "tomorrow",
): string[] {
  return template.sections.filter((section) => section.target === target).map((section) => section.prompt);
}
