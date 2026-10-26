import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { CalendarEvent } from "../../types/event";
import type { Goal } from "../../types/goal";
import type { Habit } from "../../types/habit";
import type { Priority } from "../../types/common";
import type { Task } from "../../types/task";
import type { TimeBlock } from "../../types/time-block";
import { JOURNAL_MOOD_BY_ID, journalPreview } from "../../types/journal";
import {
  addDays,
  dayDiff,
  endOfDay,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "../date-utils";
import { activeHabits, habitCheckedOnDay, habitDueOn } from "../habit/habits";
import { selectFocusSessions } from "../focus/stats";
import { computeJournalStreak, journalStreakSummary } from "../journal/streaks";
import { computeGoalProgress } from "../planning/progress";
import {
  selectOverdueTasks,
  selectTodayTasks,
  sortTasks,
} from "../task/transitions";

export type TodayTaskBucket = "today" | "overdue" | "week";
export type TodayScheduleKind = "event" | "time_block" | "task";
export type TodayActivityKind =
  | "task_completed"
  | "note_added"
  | "habit_completed"
  | "meeting_summarized"
  | "memory_added"
  | "journal_written"
  | "focus_session"
  | "goal_updated";

export const TODAY_QUOTES: readonly string[] = [
  "Small steps every day lead to big results.",
  "Momentum beats motivation. Start the next thing.",
  "Clarity comes from doing, not from planning.",
  "Protect the hours you want to keep.",
  "Finish one thing well before starting ten.",
  "Consistency is a quiet kind of courage.",
];

const DAY = 86_400_000;

export function greetingFor(now: Timestamp): string {
  const hour = new Date(now).getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export interface TodayWelcome {
  greeting: string;
  displayName: string;
  quote: string;
  message: string;
}

export function buildTodayWelcome(state: AppState, now: Timestamp): TodayWelcome {
  const greeting = greetingFor(now);
  const rawName = state.profile.displayName.trim();
  const displayName = rawName.length > 0 ? rawName.split(/\s+/)[0]! : "there";

  const overdue = selectOverdueTasks(state, now).length;
  const dueToday = selectTodayTasks(state, now).length;
  const done = Object.values(state.tasks).filter(
    (task) => task.status === "done" && task.completedAt != null && isSameDay(task.completedAt, now),
  ).length;
  const lead = done - overdue;

  let message: string;
  if (overdue === 0 && dueToday === 0 && done === 0) {
    message = "Nothing is due today. A good day to get ahead.";
  } else if (lead > 0) {
    message = `You're ${lead} task${lead === 1 ? "" : "s"} ahead of your plan. Keep the momentum!`;
  } else if (lead < 0) {
    message = `You're ${Math.abs(lead)} task${Math.abs(lead) === 1 ? "" : "s"} behind. Start with the smallest one.`;
  } else {
    message = `You're right on plan with ${dueToday} task${dueToday === 1 ? "" : "s"} due today.`;
  }

  const index = Math.abs(Math.floor(now / DAY)) % TODAY_QUOTES.length;

  return { greeting, displayName, quote: TODAY_QUOTES[index]!, message };
}

export interface TodayStats {
  focusMin: number;
  focusDeltaPct: number | null;
  tasksDone: number;
  tasksTotal: number;
  taskDeltaPct: number | null;
  habitStreak: number;
  habitDone: number;
  habitTotal: number;
  moodId: string | null;
  moodLabel: string | null;
  moodScore: number | null;
  moodOptions: { id: string; label: string; score: number }[];
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildTodayStats(state: AppState, now: Timestamp): TodayStats {
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);

  const focusMin = (from: Timestamp, to: Timestamp): number =>
    selectFocusSessions(state, from, to, now)
      .filter((row) => row.session.status !== "aborted")
      .reduce((total, row) => total + row.durationMin, 0);

  const todayFocus = focusMin(todayStart, todayStart + DAY);
  const yesterdayFocus = focusMin(yesterdayStart, todayStart);

  const completedToday = Object.values(state.tasks).filter(
    (task) => task.status === "done" && task.completedAt != null && isSameDay(task.completedAt, now),
  ).length;
  const openToday = selectTodayTasks(state, now).length;
  const totalToday = openToday + completedToday;
  const completedYesterday = Object.values(state.tasks).filter(
    (task) =>
      task.completedAt != null &&
      task.completedAt >= yesterdayStart &&
      task.completedAt < todayStart,
  ).length;

  const habits = habitsDueToday(state, now);
  const habitDone = habits.filter((habit) => habit.done).length;
  const habitStreak = habits.reduce(
    (best, habit) => Math.max(best, habit.streak),
    0,
  );

  const entry = Object.values(state.journalEntries).find(
    (candidate) => candidate.status !== "trashed" && isSameDay(candidate.entryDate, now),
  );
  const mood = entry?.mood != null ? JOURNAL_MOOD_BY_ID[entry.mood] : undefined;

  return {
    focusMin: todayFocus,
    focusDeltaPct: pctDelta(todayFocus, yesterdayFocus),
    tasksDone: completedToday,
    tasksTotal: totalToday,
    taskDeltaPct: pctDelta(completedToday, completedYesterday),
    habitStreak,
    habitDone,
    habitTotal: habits.length,
    moodId: mood?.id ?? null,
    moodLabel: mood?.label ?? null,
    moodScore: mood?.score ?? null,
    moodOptions: Object.values(JOURNAL_MOOD_BY_ID).map((option) => ({
      id: option.id,
      label: option.label,
      score: option.score,
    })),
  };
}

export interface TodayScheduleEntry {
  id: ID;
  kind: TodayScheduleKind;
  title: string;
  subtitle: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  minutes: number;
  done: boolean;
  tone: "accent" | "success" | "danger" | "warning" | "info";
  sourceId: ID;
}

function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function eventTone(event: CalendarEvent, now: Timestamp): TodayScheduleEntry["tone"] {
  if (event.endsAt < now) return "info";
  if (event.startsAt - now <= 2 * 3_600_000) return "danger";
  if (event.source === "habit") return "success";
  if (event.allDay) return "warning";
  return "accent";
}

export function buildTodaySchedule(state: AppState, now: Timestamp): TodayScheduleEntry[] {
  const from = startOfDay(now);
  const to = endOfDay(now);
  const entries: TodayScheduleEntry[] = [];

  for (const event of Object.values(state.events)) {
    if (event.startsAt > to || event.endsAt < from) continue;
    const minutes = Math.max(5, Math.round((event.endsAt - event.startsAt) / 60000));
    entries.push({
      id: `event-${event.id}`,
      kind: "event",
      title: event.title,
      subtitle: [event.location, humanDuration(minutes)].filter(Boolean).join(" · "),
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      minutes,
      done: false,
      tone: eventTone(event, now),
      sourceId: event.id,
    });
  }

  for (const block of Object.values(state.timeBlocks)) {
    if (block.startsAt > to || block.endsAt < from) continue;
    const minutes = Math.max(5, Math.round((block.endsAt - block.startsAt) / 60000));
    entries.push({
      id: `block-${block.id}`,
      kind: "time_block",
      title: block.title,
      subtitle: [block.kind === "focus" ? "Deep work" : "Time block", humanDuration(minutes)].join(" · "),
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      minutes,
      done: block.completedAt != null,
      tone: block.completedAt != null ? "success" : "accent",
      sourceId: block.id,
    });
  }

  for (const task of Object.values(state.tasks)) {
    if (task.status === "done" || task.status === "cancelled" || task.status === "archived") continue;
    if (task.scheduledAt == null) continue;
    if (task.scheduledAt > to || task.scheduledAt < from) continue;
    const minutes = task.estimateMin != null && task.estimateMin > 0 ? task.estimateMin : 30;
    entries.push({
      id: `task-${task.id}`,
      kind: "task",
      title: task.title,
      subtitle: `Task · ${humanDuration(minutes)}`,
      startsAt: task.scheduledAt,
      endsAt: task.scheduledAt + minutes * 60000,
      minutes,
      done: false,
      tone: task.scheduledAt < now ? "info" : "warning",
      sourceId: task.id,
    });
  }

  return entries.sort((a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title));
}

const PRIORITY_LABEL: Record<Priority, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

export interface TodayTaskRow {
  id: ID;
  title: string;
  done: boolean;
  priority: Priority;
  priorityLabel: string;
  dueAt: Timestamp | null;
  dueLabel: string | null;
  bucket: TodayTaskBucket;
  overdue: boolean;
}

function taskRow(task: Task, bucket: TodayTaskBucket, now: Timestamp): TodayTaskRow {
  const dueLabel =
    task.dueAt == null
      ? null
      : isSameDay(task.dueAt, now)
        ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
            new Date(task.dueAt),
          )
        : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
            new Date(task.dueAt),
          );
  return {
    id: task.id,
    title: task.title,
    done: task.status === "done",
    priority: task.priority,
    priorityLabel: PRIORITY_LABEL[task.priority],
    dueAt: task.dueAt,
    dueLabel,
    bucket,
    overdue: task.dueAt != null && task.dueAt < startOfDay(now) && task.status !== "done",
  };
}

export function buildTodayTasks(
  state: AppState,
  now: Timestamp,
  bucket: TodayTaskBucket,
  limit = 8,
): TodayTaskRow[] {
  if (bucket === "overdue") {
    return selectOverdueTasks(state, now)
      .slice(0, limit)
      .map((task) => taskRow(task, bucket, now));
  }

  if (bucket === "week") {
    const weekStart = startOfWeek(now);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const pool = Object.values(state.tasks)
      .filter(
        (task: Task) =>
          task.status !== "done" &&
          task.status !== "cancelled" &&
          task.status !== "archived" &&
          task.dueAt != null &&
          task.dueAt >= weekStart &&
          task.dueAt <= weekEnd,
      );
    return sortTasks(pool, "priority", now)
      .slice(0, limit)
      .map((task) => taskRow(task, bucket, now));
  }

  const completedIds = new Set(selectOverdueTasks(state, now).map((task) => task.id));
  const pool = selectTodayTasks(state, now).filter((task) => !completedIds.has(task.id));
  return pool.slice(0, limit).map((task) => taskRow(task, bucket, now));
}

export function todayTaskCounts(state: AppState, now: Timestamp): Record<TodayTaskBucket, number> {
  return {
    today: buildTodayTasks(state, now, "today", Number.MAX_SAFE_INTEGER).length,
    overdue: selectOverdueTasks(state, now).length,
    week: buildTodayTasks(state, now, "week", Number.MAX_SAFE_INTEGER).length,
  };
}

export interface TodayHabitRow {
  id: ID;
  title: string;
  done: boolean;
  streak: number;
  streakLabel: string | null;
  color: string | null;
  icon: string | null;
}

export function habitDayStreak(state: AppState, habit: Habit, now: Timestamp): number {
  const dayStart = startOfDay(now);
  let streak = 0;
  let back = 0;
  if (habitDueOn(state, habit, dayStart) && !habitCheckedOnDay(state, habit, dayStart)) {
    back = 1;
  }
  for (; back < 3650; back += 1) {
    const day = addDays(dayStart, -back);
    if (!habitDueOn(state, habit, day)) continue;
    if (!habitCheckedOnDay(state, habit, day)) break;
    streak += 1;
  }
  return streak;
}

export function habitsDueToday(state: AppState, now: Timestamp): TodayHabitRow[] {
  const dayStart = startOfDay(now);
  return activeHabits(state)
    .filter((habit: Habit) => habitDueOn(state, habit, dayStart))
    .map((habit) => {
      const streak = habitDayStreak(state, habit, now);
      return {
        id: habit.id,
        title: habit.title,
        done: habitCheckedOnDay(state, habit, dayStart),
        streak,
        streakLabel: streak > 0 ? `${streak} day streak` : null,
        color: habit.color,
        icon: habit.icon,
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.streak - a.streak);
}

export interface TodayGoalRow {
  id: ID;
  title: string;
  description: string;
  progress: number;
}

export function activeGoals(state: AppState): Goal[] {
  return Object.values(state.goals).filter((goal) => goal.status === "active");
}

export function buildTodayGoals(state: AppState, now: Timestamp, limit = 4): TodayGoalRow[] {
  return activeGoals(state)
    .map((goal) => ({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      progress: computeGoalProgress(state, goal, now).progress,
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, limit);
}

export interface TodayJournalPreview {
  written: boolean;
  entryId: ID | null;
  preview: string;
  streakLabel: string;
  attachmentUrls: string[];
  tags: string[];
}

export function buildTodayJournal(state: AppState, now: Timestamp): TodayJournalPreview {
  const entry = Object.values(state.journalEntries).find(
    (candidate) => candidate.status !== "trashed" && isSameDay(candidate.entryDate, now),
  );

  if (!entry) {
    return {
      written: false,
      entryId: null,
      preview: "",
      streakLabel: "No entry yet today",
      attachmentUrls: [],
      tags: [],
    };
  }

  const attachmentUrls = entry.attachmentIds
    .map((id) => state.attachments[id]?.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  return {
    written: true,
    entryId: entry.id,
    preview: journalPreview(entry, 160),
    streakLabel: journalStreakSummary(computeJournalStreak(state, now)),
    attachmentUrls,
    tags: entry.tags,
  };
}

export interface TodayActivityEntry {
  id: string;
  kind: TodayActivityKind;
  title: string;
  detail: string;
  when: Timestamp;
  tone: "accent" | "success" | "warning" | "danger" | "info";
  href: string | null;
}

export function buildActivityFeed(
  state: AppState,
  now: Timestamp,
  limit = 12,
  sinceDays = 3,
): TodayActivityEntry[] {
  const from = addDays(startOfDay(now), -(sinceDays - 1));
  const rows: TodayActivityEntry[] = [];

  for (const task of Object.values(state.tasks)) {
    if (task.habitId != null || task.routineId != null) continue;
    if (task.completedAt != null && task.completedAt >= from) {
      rows.push({
        id: `task-${task.id}`,
        kind: "task_completed",
        title: "Task completed",
        detail: task.title,
        when: task.completedAt,
        tone: "success",
        href: "/tasks",
      });
    }
  }

  for (const note of Object.values(state.notes)) {
    if (note.status === "trashed") continue;
    if (note.createdAt >= from) {
      rows.push({
        id: `note-${note.id}`,
        kind: "note_added",
        title: "Note added",
        detail: note.title,
        when: note.createdAt,
        tone: "warning",
        href: "/notes",
      });
    }
  }

  const habitTitles = new Map(
    Object.values(state.habits).map((habit) => [habit.id, habit.title]),
  );
  for (const checkIn of Object.values(state.habitCheckins)) {
    if (checkIn.checkedAt < from) continue;
    rows.push({
      id: `habit-${checkIn.id}`,
      kind: "habit_completed",
      title: "Habit completed",
      detail: habitTitles.get(checkIn.habitId) ?? "Habit",
      when: checkIn.checkedAt,
      tone: "accent",
      href: "/habits",
    });
  }

  for (const meeting of Object.values(state.meetings)) {
    if (meeting.aiSummary == null && meeting.updatedAt < from) continue;
    const when = Math.max(meeting.updatedAt, meeting.createdAt);
    if (when < from) continue;
    rows.push({
      id: `meeting-${meeting.id}`,
      kind: "meeting_summarized",
      title: meeting.aiSummary != null ? "Meeting summarized" : "Meeting updated",
      detail: meeting.title,
      when,
      tone: "info",
      href: "/meetings",
    });
  }

  for (const moment of Object.values(state.memoryMoments)) {
    if (moment.status === "trashed") continue;
    if (moment.createdAt >= from) {
      rows.push({
        id: `memory-${moment.id}`,
        kind: "memory_added",
        title: "Memory added",
        detail: moment.title,
        when: moment.createdAt,
        tone: "accent",
        href: "/memory",
      });
    }
  }

  for (const entry of Object.values(state.journalEntries)) {
    if (entry.status === "trashed") continue;
    if (entry.updatedAt >= from) {
      rows.push({
        id: `journal-${entry.id}`,
        kind: "journal_written",
        title: "Journal written",
        detail: journalPreview(entry, 60),
        when: entry.updatedAt,
        tone: "success",
        href: "/journal",
      });
    }
  }

  for (const row of selectFocusSessions(state, from, now, now)) {
    const session = row.session;
    if (session.status !== "completed") continue;
    rows.push({
      id: `focus-${session.id}`,
      kind: "focus_session",
      title: "Focus session finished",
      detail: row.taskTitle ?? "Focus session",
      when: session.completedAt ?? session.endsAt ?? session.startedAt,
      tone: "accent",
      href: "/focus",
    });
  }

  return rows.sort((a, b) => b.when - a.when).slice(0, limit);
}

export interface TodayInsight {
  id: string;
  tone: "positive" | "warning" | "action" | "neutral";
  title: string;
  detail: string;
}

export function buildTodayInsights(state: AppState, now: Timestamp, limit = 4): TodayInsight[] {
  const stats = buildTodayStats(state, now);
  const overdue = selectOverdueTasks(state, now);
  const dueToday = selectTodayTasks(state, now);
  const weekStart = startOfWeek(now);
  const lastWeekStart = addDays(weekStart, -7);
  const insights: TodayInsight[] = [];

  const completedBetween = (from: Timestamp, to: Timestamp): number =>
    Object.values(state.tasks).filter(
      (task) => task.completedAt != null && task.completedAt >= from && task.completedAt < to,
    ).length;
  const thisWeekDone = completedBetween(weekStart, now + 1);
  const lastWeekDone = completedBetween(lastWeekStart, weekStart);

  if (lastWeekDone > 0) {
    const delta = Math.round(((thisWeekDone - lastWeekDone) / lastWeekDone) * 100);
    insights.push({
      id: "productivity-week",
      tone: delta >= 0 ? "positive" : "warning",
      title:
        delta >= 0
          ? `You're ${delta}% more productive this week compared to last week.`
          : `You're ${Math.abs(delta)}% behind last week's pace — plenty of week left.`,
      detail: `${thisWeekDone} done this week - ${lastWeekDone} last week.`,
    });
  } else if (thisWeekDone > 0) {
    insights.push({
      id: "productivity-week",
      tone: "positive",
      title: `You've completed ${thisWeekDone} task${thisWeekDone === 1 ? "" : "s"} this week.`,
      detail: "Keep the momentum going.",
    });
  }

  if (dueToday.length > 0) {
    insights.push({
      id: "tasks-due",
      tone: dueToday.length >= 3 ? "warning" : "neutral",
      title: `You have ${dueToday.length} important task${dueToday.length === 1 ? "" : "s"} due today.`,
      detail: "Stay on top of your deadlines.",
    });
  }

  if (stats.tasksTotal > 0) {
    const ratio = Math.round((stats.tasksDone / stats.tasksTotal) * 100);
    insights.push({
      id: "progress",
      tone: ratio >= 60 ? "positive" : "neutral",
      title: `You're ${ratio}% through today's tasks.`,
      detail: `${stats.tasksDone} of ${stats.tasksTotal} complete.`,
    });
  }

  if (overdue.length > 0) {
    insights.push({
      id: "overdue",
      tone: "warning",
      title: `You have ${overdue.length} important task${overdue.length === 1 ? "" : "s"} due.`,
      detail: `Oldest is ${dayDiff(overdue[overdue.length - 1]!.dueAt ?? now, now)} days late.`,
    });
  }

  if (stats.focusMin === 0) {
    insights.push({
      id: "focus-none",
      tone: "action",
      title: "No focus time logged yet today.",
      detail: "Start a 25 minute session to build the streak.",
    });
  }

  if (stats.moodLabel != null) {
    const positive = (stats.moodScore ?? 0) >= 0;
    insights.push({
      id: "mood",
      tone: positive ? "positive" : "neutral",
      title: `Your mood is ${stats.moodLabel.toLowerCase()}.`,
      detail: positive ? "Great job keeping up your routine!" : "Be kind to yourself today.",
    });
  }

  const goals = activeGoals(state);
  if (goals.length > 0) {
    const average = Math.round(
      goals.reduce((sum, goal) => sum + computeGoalProgress(state, goal, now).progress, 0) / goals.length,
    );
    insights.push({
      id: "weekly-goal",
      tone: average >= 60 ? "positive" : "neutral",
      title: `You are ${average}% towards your weekly goal.`,
      detail: "Keep going to hit your target.",
    });
  }

  if (stats.habitTotal > 0) {
    const left = stats.habitTotal - stats.habitDone;
    insights.push({
      id: "habits",
      tone: left === 0 ? "positive" : "neutral",
      title:
        left === 0
          ? `All ${stats.habitTotal} habits done today.`
          : `${left} habit${left === 1 ? "" : "s"} left today.`,
      detail: stats.habitStreak > 0 ? `Best current streak is ${stats.habitStreak} days.` : "Build a streak today.",
    });
  }

  const weekMinutes = selectFocusSessions(state, weekStart, now, now)
    .filter((row) => row.session.status !== "aborted")
    .reduce((total, row) => total + row.durationMin, 0);

  if (weekMinutes > 0) {
    insights.push({
      id: "week-focus",
      tone: "positive",
      title: `You are ${Math.round(weekMinutes)} minutes into this week's focus.`,
      detail: "Consistency compounds over the week.",
    });
  }

  return insights.slice(0, limit);
}
