import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import { journalDateKey, type JournalEntry } from "../../types/journal";

import { DAY_MS } from "../date-utils";

export interface JournalStreak {
  current: number;
  longest: number;
  entriesThisWeek: number;
  entriesThisMonth: number;
  totalEntries: number;
  writtenToday: boolean;
  lastEntryDate: Timestamp | null;
}

export function journalStartOfDay(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function journalDateKeysBetween(from: Timestamp, to: Timestamp): string[] {
  const keys: string[] = [];
  const start = journalStartOfDay(from);
  const end = journalStartOfDay(to);
  for (let cursor = start; cursor <= end; cursor += DAY_MS) {
    keys.push(journalDateKey(cursor));
  }
  return keys;
}

function keyToTimestamp(key: string): Timestamp {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0).getTime();
}

export function activeEntryDates(entries: JournalEntry[]): string[] {
  return entries
    .filter((entry) => entry.status !== "trashed")
    .map((entry) => entry.dateKey)
    .sort();
}

export function computeJournalStreak(
  state: AppState,
  now: Timestamp = Date.now(),
): JournalStreak {
  const entries = Object.values(state.journalEntries).filter(
    (entry) => entry.status !== "trashed",
  );
  const daySet = new Set(entries.map((entry) => entry.dateKey));

  const todayKey = journalDateKey(now);
  const yesterday = journalStartOfDay(now) - DAY_MS;
  const yesterdayKey = journalDateKey(yesterday);

  let current = 0;
  let cursor = journalStartOfDay(now);
  if (!daySet.has(journalDateKey(cursor))) {
    cursor -= DAY_MS;
  }
  while (daySet.has(journalDateKey(cursor))) {
    current += 1;
    cursor -= DAY_MS;
  }

  const sortedKeys = [...daySet].sort();
  let longest = 0;
  let run = 0;
  let previousKey: string | null = null;
  for (const key of sortedKeys) {
    if (previousKey != null && keyToTimestamp(key) - keyToTimestamp(previousKey) === DAY_MS) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previousKey = key;
  }

  const weekStart = journalStartOfWeek(now);
  const monthStart = journalStartOfMonth(now);
  const entriesThisWeek = entries.filter((entry) => entry.entryDate >= weekStart).length;
  const entriesThisMonth = entries.filter((entry) => entry.entryDate >= monthStart).length;
  const writtenToday = daySet.has(todayKey);
  const mostRecent = entries.reduce<Timestamp | null>(
    (latest, entry) => (latest == null || entry.entryDate > latest ? entry.entryDate : latest),
    null,
  );

  return {
    current,
    longest,
    entriesThisWeek,
    entriesThisMonth,
    totalEntries: entries.length,
    writtenToday,
    lastEntryDate: mostRecent ?? (daySet.has(yesterdayKey) ? keyToTimestamp(yesterdayKey) : null),
  };
}

export function journalStartOfWeek(at: Timestamp, weekStart = 1): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getDay() - weekStart + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date.getTime();
}

export function journalStartOfMonth(at: Timestamp): Timestamp {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
}

export function journalStreakSummary(streak: JournalStreak): string {
  if (streak.current === 0) return "Start a streak today";
  if (streak.current === 1) return "1 day journal streak";
  return `${streak.current} day journal streak`;
}

export function journalStreakIsActive(streak: JournalStreak, now: Timestamp = Date.now()): boolean {
  return streak.current > 0 && (streak.writtenToday || streak.lastEntryDate != null);
}
