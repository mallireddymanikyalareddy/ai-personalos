import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import { startOfDay } from "../date-utils";
import { focusSessionActiveMs } from "../focus/stats";
import { canRead } from "./metrics";

export type InsightArea = "work" | "personal" | "learning" | "health" | "finance" | "other";

export const LIFE_AREA_LABEL: Record<InsightArea, string> = {
  work: "Work",
  personal: "Personal",
  learning: "Learning",
  health: "Health",
  finance: "Finance",
  other: "Other",
};

export const LIFE_AREA_COLOR: Record<InsightArea, string> = {
  work: "var(--chart-5)",
  personal: "var(--chart-7)",
  learning: "var(--chart-6)",
  health: "var(--chart-4)",
  finance: "var(--chart-3)",
  other: "var(--chart-8)",
};

const AREA_KEYWORDS: Record<Exclude<InsightArea, "other">, string[]> = {
  health: [
    "health",
    "gym",
    "workout",
    "run",
    "meditat",
    "sleep",
    "eat",
    "food",
    "cricket",
    "yoga",
    "walk",
    "stretch",
    "wellness",
  ],
  finance: ["finance", "budget", "invest", "money", "salary", "tax", "expense", "invoice"],
  learning: ["learn", "read", "book", "course", "study", "training", "nextjs", "documentation", "research"],
  personal: ["personal", "home", "family", "shopping", "grocery", "travel", "holiday"],
  work: [
    "work",
    "client",
    "project",
    "sprint",
    "standup",
    "meeting",
    "d365",
    "support",
    "business",
    "team",
    "sprint",
    "review",
  ],
};

export function classifyArea(text: string): InsightArea {
  const haystack = text.toLowerCase();
  for (const area of ["health", "finance", "learning", "personal", "work"] as const) {
    if (AREA_KEYWORDS[area].some((keyword) => haystack.includes(keyword))) return area;
  }
  return "other";
}

export interface InsightAreaSummary {
  area: InsightArea;
  label: string;
  total: number;
  done: number;
  percent: number;
  deltaPct: number | null;
}

function taskText(state: AppState, task: { title: string; tags: string[]; projectId: ID | null }): string {
  const project =
    task.projectId != null ? (state.projects[task.projectId]?.name ?? "") : "";
  return `${task.title} ${task.tags.join(" ")} ${project}`;
}

function windowStats(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): Map<InsightArea, { total: number; done: number }> {
  const buckets = new Map<InsightArea, { total: number; done: number }>();
  for (const task of Object.values(state.tasks)) {
    if (!canRead(task)) continue;
    if (task.status === "cancelled" || task.status === "archived") continue;
    const due = task.dueAt;
    const done = task.completedAt;
    const touched =
      (due != null && due >= from && due < to) || (done != null && done >= from && done < to);
    if (!touched) continue;
    const area = classifyArea(taskText(state, task));
    const bucket = buckets.get(area) ?? { total: 0, done: 0 };
    bucket.total += 1;
    if (task.status === "done") bucket.done += 1;
    buckets.set(area, bucket);
  }
  return buckets;
}

export function areaSummaries(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): InsightAreaSummary[] {
  const current = windowStats(state, from, to);
  const span = Math.max(1, to - from);
  const previous = windowStats(state, from - span, from);

  const areas: InsightArea[] = ["work", "personal", "learning", "health", "finance", "other"];
  return areas
    .map((area) => {
      const bucket = current.get(area) ?? { total: 0, done: 0 };
      const prior = previous.get(area) ?? { total: 0, done: 0 };
      const percent = bucket.total > 0 ? Math.round((bucket.done / bucket.total) * 100) : 0;
      const priorPercent = prior.total > 0 ? Math.round((prior.done / prior.total) * 100) : null;
      return {
        area,
        label: LIFE_AREA_LABEL[area],
        total: bucket.total,
        done: bucket.done,
        percent,
        deltaPct: priorPercent != null ? percent - priorPercent : null,
      };
    })
    .filter((entry) => entry.total > 0);
}

export interface DailyProductivity {
  day: Timestamp;
  label: string;
  rate: number;
  completed: number;
  due: number;
}

export function dailyProductivity(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): DailyProductivity[] {
  const days: DailyProductivity[] = [];
  const label = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });
  for (let day = startOfDay(from); day < to; day += 86_400_000) {
    const next = day + 86_400_000;
    let due = 0;
    let completed = 0;
    for (const task of Object.values(state.tasks)) {
      if (!canRead(task)) continue;
      if (task.status === "cancelled" || task.status === "archived") continue;
      if (task.dueAt != null && task.dueAt >= day && task.dueAt < next) due += 1;
      if (task.completedAt != null && task.completedAt >= day && task.completedAt < next) {
        completed += 1;
      }
    }
    const rate = due > 0 ? Math.round((completed / due) * 100) : completed > 0 ? 100 : 0;
    days.push({ day, label: label.format(new Date(day)), rate, completed, due });
  }
  return days;
}

export interface InsightAreaFocus {
  area: InsightArea;
  label: string;
  minutes: number;
  pct: number;
}

export function focusByArea(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): InsightAreaFocus[] {
  const buckets = new Map<InsightArea, number>();
  let total = 0;
  for (const session of Object.values(state.focusSessions)) {
    if (!canRead(session)) continue;
    if (session.status !== "completed") continue;
    if (session.startedAt < from || session.startedAt >= to) continue;
    const minutes = Math.round(focusSessionActiveMs(session, to) / 60_000);
    if (minutes <= 0) continue;
    const task = session.taskId != null ? state.tasks[session.taskId] : undefined;
    const goal = session.goalId != null ? state.goals[session.goalId] : undefined;
    const area = classifyArea(
      task != null
        ? taskText(state, task)
        : (goal?.title ?? "focus work session"),
    );
    buckets.set(area, (buckets.get(area) ?? 0) + minutes);
    total += minutes;
  }

  return [...buckets.entries()]
    .map(([area, minutes]) => ({
      area,
      label: LIFE_AREA_LABEL[area],
      minutes,
      pct: total > 0 ? Math.round((minutes / total) * 100) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}


