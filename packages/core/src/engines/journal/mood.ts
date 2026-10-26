import type { Timestamp } from "../../types/common";
import {
  JOURNAL_MOOD_BY_ID,
  journalDateKey,
  type JournalEntry,
} from "../../types/journal";
import { journalStartOfDay, journalStartOfWeek, journalStartOfMonth } from "./streaks";

const DAY_MS = 86_400_000;

export interface MoodPoint {
  dateKey: string;
  score: number;
  mood: string | null;
  label: string;
}

export interface MoodInsight {
  average: number;
  distribution: Record<string, number>;
  positiveDays: number;
  stressedDays: number;
  lowEnergyDays: number;
  streak: number;
  trend: "up" | "down" | "flat";
  points: MoodPoint[];
  windowDays: number;
  sampleSize: number;
  observation: string;
}

function moodScoreOf(entry: JournalEntry): number {
  if (entry.mood == null) return 3;
  return JOURNAL_MOOD_BY_ID[entry.mood]?.score ?? 3;
}

export function buildMoodInsights(
  entries: JournalEntry[],
  windowDays: 7 | 30 | 90 | 365,
  now: Timestamp = Date.now(),
): MoodInsight {
  const from = journalStartOfDay(now) - (windowDays - 1) * DAY_MS;
  const inWindow = entries
    .filter((entry) => entry.status !== "trashed" && entry.entryDate >= from)
    .sort((a, b) => a.entryDate - b.entryDate);

  const distribution: Record<string, number> = {};
  for (const entry of inWindow) {
    const key = entry.mood ?? "unrecorded";
    distribution[key] = (distribution[key] ?? 0) + 1;
  }

  const scores = inWindow.map(moodScoreOf);
  const average = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 3;
  const positiveDays = scores.filter((score) => score >= 4).length;
  const stressedDays = distribution.stressed ?? 0;
  const lowEnergyDays = inWindow.filter((entry) => entry.energy != null && entry.energy <= 3).length;

  const points: MoodPoint[] = inWindow.map((entry) => ({
    dateKey: entry.dateKey,
    score: moodScoreOf(entry),
    mood: entry.mood,
    label: entry.mood ? (JOURNAL_MOOD_BY_ID[entry.mood]?.label ?? entry.mood) : "Unrecorded",
  }));

  const half = Math.floor(points.length / 2);
  let trend: MoodInsight["trend"] = "flat";
  if (points.length >= 4) {
    const first = points.slice(0, half).reduce((sum, point) => sum + point.score, 0) / half;
    const second =
      points.slice(half).reduce((sum, point) => sum + point.score, 0) / (points.length - half);
    if (second - first >= 0.35) trend = "up";
    else if (first - second >= 0.35) trend = "down";
  }

  let consecutive = 0;
  const cursor = journalStartOfDay(now);
  while (consecutive < 365) {
    const entry = inWindow.find((candidate) => candidate.dateKey === journalDateKey(cursor - consecutive * DAY_MS));
    if (!entry || entry.mood == null) break;
    consecutive += 1;
  }

  return {
    average: Math.round(average * 100) / 100,
    distribution,
    positiveDays,
    stressedDays,
    lowEnergyDays,
    streak: consecutive,
    trend,
    points,
    windowDays,
    sampleSize: inWindow.length,
    observation: buildMoodObservation(inWindow.length, average, trend, distribution),
  };
}

function buildMoodObservation(
  sampleSize: number,
  average: number,
  trend: MoodInsight["trend"],
  distribution: Record<string, number>,
): string {
  if (sampleSize === 0) {
    return "No entries in this window yet — write an entry to start the observed pattern.";
  }
  const top = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0];
  const topLabel = top && top[0] !== "unrecorded" ? (JOURNAL_MOOD_BY_ID[top[0]]?.label ?? top[0]) : null;
  const parts: string[] = [];
  parts.push(
    average >= 4
      ? "Observed pattern: your recorded days lean positive."
      : average <= 2.2
        ? "Observed pattern: recent entries lean low."
        : "Observed pattern: your recorded days sit in the middle.",
  );
  if (trend === "up") parts.push("The trend across this window is upward.");
  if (trend === "down") parts.push("The trend across this window is downward.");
  if (topLabel) parts.push(`${topLabel} is the most recorded mood.`);
  return parts.join(" ");
}

export interface MoodCalendarDay {
  dateKey: string;
  hasEntry: boolean;
  mood: string | null;
  moodScore: number;
  entryCount: number;
  hasPhotos: boolean;
  completed: boolean;
}

export function buildMoodCalendar(
  entries: JournalEntry[],
  month: number,
  year: number,
): MoodCalendarDay[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    if (entry.status === "trashed") continue;
    const list = map.get(entry.dateKey) ?? [];
    list.push(entry);
    map.set(entry.dateKey, list);
  }

  const days: MoodCalendarDay[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = `${year}-${`${month + 1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
    const dayEntries = map.get(dateKey) ?? [];
    days.push({
      dateKey,
      hasEntry: dayEntries.length > 0,
      mood: dayEntries[0]?.mood ?? null,
      moodScore: dayEntries.length > 0 ? (dayEntries[0]!.mood ? moodScoreOf(dayEntries[0]!) : 0) : 0,
      entryCount: dayEntries.length,
      hasPhotos: dayEntries.some((entry) => entry.attachmentIds.length > 0),
      completed: dayEntries.some((entry) => entry.status === "complete"),
    });
    void date;
    void first;
  }
  return days;
}

export function moodToneClass(score: number): string {
  if (score >= 5) return "bg-success";
  if (score >= 4) return "bg-success/70";
  if (score >= 3) return "bg-warning/70";
  if (score >= 2) return "bg-warning";
  return "bg-danger";
}

export function moodDotLabel(day: MoodCalendarDay): string {
  if (!day.hasEntry) return "No entry";
  if (!day.mood) return "Entry without mood";
  return JOURNAL_MOOD_BY_ID[day.mood]?.label ?? day.mood;
}

export function journalEnergyAverage(entries: JournalEntry[], windowDays = 30): number | null {
  const from = journalStartOfDay(Date.now()) - (windowDays - 1) * DAY_MS;
  const values = entries
    .filter((entry) => entry.status !== "trashed" && entry.energy != null && entry.entryDate >= from)
    .map((entry) => entry.energy!);
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function journalProductivityAverage(entries: JournalEntry[], windowDays = 30): number | null {
  const from = journalStartOfDay(Date.now()) - (windowDays - 1) * DAY_MS;
  const values = entries
    .filter((entry) => entry.status !== "trashed" && entry.productivity != null && entry.entryDate >= from)
    .map((entry) => entry.productivity!);
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function journalMoodByDayOfWeek(entries: JournalEntry[]): Array<{ day: string; average: number; count: number }> {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets: number[][] = names.map(() => []);
  for (const entry of entries) {
    if (entry.status === "trashed" || entry.mood == null) continue;
    buckets[new Date(entry.entryDate).getDay()]!.push(moodScoreOf(entry));
  }
  return buckets
    .map((scores, index) => ({
      day: names[index]!,
      average: scores.length > 0 ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100 : 0,
      count: scores.length,
    }))
    .filter((bucket) => bucket.count > 0);
}

export function journalPositiveDayActivities(entries: JournalEntry[]): Array<{ activity: string; positiveDays: number; totalDays: number }> {
  const counts = new Map<string, { positive: number; total: number }>();
  for (const entry of entries) {
    if (entry.status === "trashed") continue;
    const positive = entry.mood != null && moodScoreOf(entry) >= 4;
    for (const activity of entry.activities) {
      const bucket = counts.get(activity) ?? { positive: 0, total: 0 };
      bucket.total += 1;
      if (positive) bucket.positive += 1;
      counts.set(activity, bucket);
    }
  }
  return [...counts.entries()]
    .map(([activity, bucket]) => ({ activity, positiveDays: bucket.positive, totalDays: bucket.total }))
    .filter((row) => row.totalDays >= 2)
    .sort((a, b) => b.positiveDays / b.totalDays - a.positiveDays / a.totalDays);
}

export { journalStartOfWeek, journalStartOfMonth };
