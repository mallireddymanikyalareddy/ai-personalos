import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Goal } from "../../types/goal";
import type { Habit } from "../../types/habit";
import type { CalendarEvent } from "../../types/event";
import type { NewLifeMemoryItemInput } from "../../types/life-memory";
import { JOURNAL_MOOD_BY_ID, type JournalEntry } from "../../types/journal";
import { journalStartOfDay, journalStartOfWeek } from "./streaks";
import { buildMoodInsights } from "./mood";

const DAY_MS = 86_400_000;

export interface JournalWeeklyReview {
  from: Timestamp;
  to: Timestamp;
  entryCount: number;
  overallMood: "positive" | "mixed" | "low" | "unknown";
  bestDay: { dateKey: string; label: string; score: number } | null;
  mostProductiveDay: { dateKey: string; productivity: number } | null;
  mostCommonActivity: string | null;
  topAchievement: string | null;
  commonChallenge: string | null;
  habitConsistency: number | null;
  focusMinutes: number;
  moodPoints: Array<{ dateKey: string; score: number }>;
  reflections: string[];
  aiGenerated: true;
}

export interface JournalMonthlyReview {
  from: Timestamp;
  to: Timestamp;
  entryCount: number;
  moodTrend: "up" | "down" | "flat";
  productivityTrend: "up" | "down" | "flat";
  majorAchievements: string[];
  majorChallenges: string[];
  frequentTopics: string[];
  commonActivities: string[];
  habitRelationships: Array<{ label: string; daysCompleted: number; positiveDays: number }>;
  goalProgress: Array<{ goalId: ID; title: string; linkedEntries: number }>;
  importantMemories: string[];
  patterns: string[];
  aiGenerated: true;
}

function entriesBetween(entries: JournalEntry[], from: Timestamp, to: Timestamp): JournalEntry[] {
  return entries
    .filter((entry) => entry.status !== "trashed" && entry.entryDate >= from && entry.entryDate <= to)
    .sort((a, b) => a.entryDate - b.entryDate);
}

function journalEndOfDay(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function buildJournalWeeklyReview(
  state: AppState,
  now: Timestamp = Date.now(),
): JournalWeeklyReview {
  const to = journalEndOfDay(now);
  const from = journalStartOfWeek(now) - 7 * DAY_MS;
  const entries = entriesBetween(Object.values(state.journalEntries), from, to);
  const insights = buildMoodInsights(entries, 7, now);

  const average = insights.average;
  const overallMood: JournalWeeklyReview["overallMood"] =
    entries.length === 0 ? "unknown" : average >= 4 ? "positive" : average >= 3 ? "mixed" : "low";

  const withMood = entries.filter((entry) => entry.mood != null);
  const bestDay = withMood.reduce<{ dateKey: string; label: string; score: number } | null>((best, entry) => {
    const score = JOURNAL_MOOD_BY_ID[entry.mood!]?.score ?? 0;
    if (!best || score > best.score) {
      return { dateKey: entry.dateKey, label: JOURNAL_MOOD_BY_ID[entry.mood!]?.label ?? entry.mood!, score };
    }
    return best;
  }, null);

  const withProductivity = entries.filter((entry) => entry.productivity != null);
  const mostProductiveDay = withProductivity.reduce<{ dateKey: string; productivity: number } | null>(
    (best, entry) => {
      if (!best || entry.productivity! > best.productivity) {
        return { dateKey: entry.dateKey, productivity: entry.productivity! };
      }
      return best;
    },
    null,
  );

  const activityCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const activity of entry.activities) {
      activityCounts.set(activity, (activityCounts.get(activity) ?? 0) + 1);
    }
  }
  const mostCommonActivity =
    [...activityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const reflections: string[] = [];
  if (entries.length === 0) {
    reflections.push("No entries this week — write one when you're ready.");
  } else {
    if (bestDay) {
      reflections.push(`Observed pattern: ${bestDay.label} was your highest recorded mood, on ${bestDay.dateKey}.`);
    }
    if (mostProductiveDay) {
      reflections.push(
        `Observed pattern: ${mostProductiveDay.dateKey} had the highest recorded productivity (${mostProductiveDay.productivity}/10).`,
      );
    }
    if (insights.stressedDays > 0) {
      reflections.push(`${insights.stressedDays} entries this week recorded a stressed mood.`);
    }
    if (mostCommonActivity) {
      reflections.push(`"${mostCommonActivity}" was the most recorded activity.`);
    }
  }

  return {
    from,
    to,
    entryCount: entries.length,
    overallMood,
    bestDay,
    mostProductiveDay,
    mostCommonActivity,
    topAchievement: entries.flatMap((entry) => entry.highlights)[0] ?? null,
    commonChallenge: entries.flatMap((entry) => entry.challenges)[0] ?? null,
    habitConsistency: state.habits ? habitConsistencyFor(state, from, to) : null,
    focusMinutes: focusMinutesFor(state, from, to),
    moodPoints: insights.points,
    reflections,
    aiGenerated: true,
  };
}

function habitConsistencyFor(state: AppState, from: Timestamp, to: Timestamp): number | null {
  const checkins = Object.values(state.habitCheckins ?? {}).filter(
    (checkin) => checkin.checkedAt >= from && checkin.checkedAt <= to,
  );
  const activeHabits = Object.values(state.habits).filter((habit) => !habit.archived);
  if (activeHabits.length === 0) return null;
  const possible = activeHabits.length * 7;
  if (possible === 0) return null;
  return Math.round((checkins.length / possible) * 100);
}

function focusMinutesFor(state: AppState, from: Timestamp, to: Timestamp): number {
  return Object.values(state.focusSessions)
    .filter(
      (session) =>
        session.status === "completed" &&
        session.startedAt >= from &&
        session.startedAt <= to,
    )
    .reduce((total, session) => total + Math.round(session.activeMs / 60_000), 0);
}

export function buildJournalMonthlyReview(
  state: AppState,
  now: Timestamp = Date.now(),
): JournalMonthlyReview {
  const to = journalEndOfDay(now);
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const entries = entriesBetween(Object.values(state.journalEntries), monthStart, to);

  const moodInsights = buildMoodInsights(entries, 30, now);

  const productivityValues = entries
    .filter((entry) => entry.productivity != null)
    .sort((a, b) => a.entryDate - b.entryDate)
    .map((entry) => entry.productivity!);
  let productivityTrend: JournalMonthlyReview["productivityTrend"] = "flat";
  if (productivityValues.length >= 4) {
    const half = Math.floor(productivityValues.length / 2);
    const first = productivityValues.slice(0, half).reduce((sum, value) => sum + value, 0) / half;
    const second =
      productivityValues.slice(half).reduce((sum, value) => sum + value, 0) /
      (productivityValues.length - half);
    if (second - first >= 0.5) productivityTrend = "up";
    else if (first - second >= 0.5) productivityTrend = "down";
  }

  const topicCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
    for (const activity of entry.activities) topicCounts.set(activity, (topicCounts.get(activity) ?? 0) + 1);
  }

  const activityCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const activity of entry.activities) {
      activityCounts.set(activity, (activityCounts.get(activity) ?? 0) + 1);
    }
  }

  const goalProgress: JournalMonthlyReview["goalProgress"] = Object.values(state.goals)
    .map((goal) => ({
      goalId: goal.id,
      title: goal.title,
      linkedEntries: entries.filter((entry) => entry.goalIds.includes(goal.id)).length,
    }))
    .filter((row) => row.linkedEntries > 0)
    .sort((a, b) => b.linkedEntries - a.linkedEntries);

  const patterns: string[] = [];
  if (moodInsights.observation) patterns.push(moodInsights.observation);
  if (entries.length > 0) {
    const gratitudeCount = entries.reduce((total, entry) => total + entry.gratitude.length, 0);
    if (gratitudeCount > 0) patterns.push(`${gratitudeCount} gratitude entries recorded this month.`);
    const photoCount = entries.reduce((total, entry) => total + entry.attachmentIds.length, 0);
    if (photoCount > 0) patterns.push(`${photoCount} photos attached across your entries.`);
  }

  return {
    from: monthStart,
    to,
    entryCount: entries.length,
    moodTrend: moodInsights.trend,
    productivityTrend,
    majorAchievements: entries.flatMap((entry) => entry.highlights).slice(0, 10),
    majorChallenges: entries.flatMap((entry) => entry.challenges).slice(0, 10),
    frequentTopics: [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic]) => topic),
    commonActivities: [...activityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([activity]) => activity),
    habitRelationships: habitRelationshipsFor(state, entries),
    goalProgress,
    importantMemories: entries.filter((entry) => entry.lifeMemoryIds.length > 0).map((entry) => entry.title || entry.dateKey),
    patterns,
    aiGenerated: true,
  };
}

function habitRelationshipsFor(
  state: AppState,
  entries: JournalEntry[],
): JournalMonthlyReview["habitRelationships"] {
  const rows: JournalMonthlyReview["habitRelationships"] = [];
  for (const habit of Object.values(state.habits)) {
    if (habit.archived) continue;
    const linked = entries.filter((entry) => entry.habitIds.includes(habit.id));
    const positive = linked.filter((entry) => entry.mood != null && (JOURNAL_MOOD_BY_ID[entry.mood!]?.score ?? 0) >= 4);
    if (linked.length === 0) continue;
    rows.push({ label: habit.title, daysCompleted: linked.length, positiveDays: positive.length });
  }
  return rows.sort((a, b) => b.daysCompleted - a.daysCompleted);
}

export function formatFocusMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function journalEntriesForWindow(
  state: AppState,
  days: number,
  now: Timestamp = Date.now(),
): JournalEntry[] {
  const from = journalStartOfDay(now) - (days - 1) * DAY_MS;
  return Object.values(state.journalEntries)
    .filter((entry) => entry.status !== "trashed" && entry.entryDate >= from)
    .sort((a, b) => b.entryDate - a.entryDate);
}

export function journalIcsFor(state: AppState, entry: JournalEntry): string | null {
  const event = Object.values(state.events).find((candidate) =>
    entry.eventIds.includes(candidate.id),
  ) as CalendarEvent | undefined;
  if (!event) return null;
  return `BEGIN:VCALENDAR\nVERSION:2.0\nSUMMARY:${event.title}\nDTSTART:${new Date(event.startsAt).toISOString()}\nDTEND:${new Date(event.endsAt).toISOString()}\nEND:VCALENDAR`;
}

export function journalLifeMemoryInput(entry: JournalEntry): NewLifeMemoryItemInput {
  const firstActivity = entry.activities[0];
  return {
    title: entry.title.trim().length > 0 ? entry.title.trim() : "Journal memory",
    description: entry.body.trim().slice(0, 500),
    category: "other",
    tags: entry.tags,
    notes: `Captured from your journal entry on ${new Date(entry.entryDate).toLocaleDateString()}.${firstActivity ? ` Activity: ${firstActivity}.` : ""}`,
  };
}

export function journalHabitSuggestionText(habit: Habit): string {
  return `You mentioned ${habit.title.toLowerCase()} in today's entry. Mark your ${habit.title} habit complete?`;
}
