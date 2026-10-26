import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Habit } from "../../types/habit";
import type { NotificationPreferences, ScheduledReminder } from "../../types/mobile";
import { notificationAllowed, quietHourBoundaries } from "../../types/mobile";
import { habitDueOn } from "../habit/habits";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type ReminderKind = ScheduledReminder["kind"];

export interface DueReminder {
  reminder: ScheduledReminder;
  allowed: boolean;
  reason: string;
}

function hourOn(at: Timestamp, hour: number, minute = 0): Timestamp {
  const date = new Date(at);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function beforeQuietHours(preferences: NotificationPreferences, latest: number, fallback: number): number {
  if (preferences.quietHoursStart <= 0) return fallback;
  return Math.max(0, Math.min(latest, preferences.quietHoursStart - 1));
}

function journalHasEntryToday(state: AppState, now: Timestamp): boolean {
  const dayKey = dateKeyOf(now);
  return Object.values(state.journalEntries).some(
    (entry) => entry.dateKey === dayKey && entry.status !== "trashed",
  );
}

function habitsDueToday(state: AppState, habits: Habit[], now: Timestamp): Habit[] {
  const dayKey = dateKeyOf(now);
  const dayStart = hourOn(now, 0);
  const checked = new Set(
    Object.values(state.habitCheckins)
      .filter((checkin) => dateKeyOf(checkin.checkedAt) === dayKey)
      .map((checkin) => checkin.habitId),
  );
  return habits.filter(
    (habit) => !habit.archived && habitDueOn(state, habit, dayStart) && !checked.has(habit.id),
  );
}

function dateKeyOf(at: Timestamp): string {
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function weekStartOf(at: Timestamp, weekStart = 1): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getDay() - weekStart + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date.getTime();
}

function isScheduledReminderDismissed(state: AppState, id: string, now: Timestamp): boolean {
  const dayKey = dateKeyOf(now);
  return Object.values(state.notifications).some(
    (notification) =>
      notification.kind === "reminder" &&
      notification.entityId === id &&
      notification.status === "dismissed" &&
      notification.dismissedAt != null &&
      dateKeyOf(notification.dismissedAt) === dayKey,
  );
}

function focusEndReminders(state: AppState, now: Timestamp): ScheduledReminder[] {
  const reminders: ScheduledReminder[] = [];
  for (const session of Object.values(state.focusSessions)) {
    if (session.status !== "running" && session.status !== "paused") continue;
    if (session.plannedMin == null || session.plannedMin <= 0) continue;
    const currentPause =
      session.status === "paused" && session.pausedAt != null
        ? Math.max(0, now - session.pausedAt)
        : 0;
    const dueAt = session.startedAt + session.plannedMin * 60_000 + session.pausedMs + currentPause;
    const taskTitle = session.taskId ? state.tasks[session.taskId]?.title ?? null : null;
    reminders.push(
      buildFocusEndReminder({
        sessionId: session.id,
        endsAt: dueAt,
        taskTitle,
      }),
    );
  }
  return reminders;
}

export function buildJournalReminders(
  state: AppState,
  preferences: NotificationPreferences,
  now: Timestamp = Date.now(),
): ScheduledReminder[] {
  const reminders: ScheduledReminder[] = [];

  if (preferences.morningJournal && !journalHasEntryToday(state, now)) {
    reminders.push({
      id: "morning_journal",
      kind: "morning_journal",
      title: "Morning journal",
      body: "Take a minute to set today's intention.",
      dueAt: hourOn(now, Math.max(6, preferences.quietHoursEnd)),
    });
  }

  if (preferences.eveningReflection && !journalHasEntryToday(state, now)) {
    reminders.push({
      id: "evening_reflection",
      kind: "evening_reflection",
      title: "Evening reflection",
      body: "Close the day: one highlight, one lesson, one gratitude.",
      dueAt: hourOn(now, beforeQuietHours(preferences, 21, 21)),
    });
  }

  if (preferences.journalStreak && journalStreakAtRisk(state, now) >= 2 && !journalHasEntryToday(state, now)) {
    reminders.push({
      id: "journal_streak",
      kind: "journal_streak",
      title: `${journalStreakAtRisk(state, now)} day journal streak`,
      body: "Write a few words before the day ends to keep the streak going.",
      dueAt: hourOn(now, beforeQuietHours(preferences, 20, 20), 30),
    });
  }

  if (preferences.weeklyReview) {
    const isFridayEvening = isWeeklyReviewDue(state, now);
    if (isFridayEvening) {
      reminders.push({
        id: "weekly_review",
        kind: "weekly_review",
        title: "Weekly review is ready",
        body: "Your week in one page, drafted from your entries.",
        dueAt: hourOn(now, beforeQuietHours(preferences, 18, 18)),
      });
    }
  }

  for (const habit of habitsDueToday(state, Object.values(state.habits), now)) {
    if (!preferences.habitReminders) continue;
    reminders.push(buildHabitDueReminder(habit, now, beforeQuietHours(preferences, 19, 19)));
  }

  if (preferences.focusEnd) reminders.push(...focusEndReminders(state, now));

  for (const reminder of storedReminders(state, now)) reminders.push(reminder);

  return reminders.filter((reminder) => !isScheduledReminderDismissed(state, reminder.id, now));
}

function storedReminders(state: AppState, now: Timestamp): ScheduledReminder[] {
  return Object.values(state.reminders)
    .filter((reminder) => reminder.firedAt == null && reminder.fireAt <= now)
    .sort((a, b) => a.fireAt - b.fireAt)
    .map((reminder) => {
      const target = reminder.meetingId
        ? state.meetings[reminder.meetingId]?.title
        : reminder.noteId
        ? state.notes[reminder.noteId]?.title
        : reminder.taskId
          ? state.tasks[reminder.taskId]?.title
          : reminder.eventId
            ? state.events[reminder.eventId]?.title
            : reminder.habitId
              ? state.habits[reminder.habitId]?.title
              : null;
      const kindLabel = reminder.meetingId
        ? "Meeting"
        : reminder.noteId
        ? "Note"
        : reminder.taskId
          ? "Task"
          : reminder.eventId
            ? "Event"
            : reminder.habitId
              ? "Habit"
              : "Reminder";
      return {
        id: reminder.id,
        kind: "reminder" as const,
        title: target ?? reminder.message ?? "Reminder",
        body: kindLabel,
        dueAt: reminder.fireAt,
      };
    });
}

function isWeeklyReviewDue(state: AppState, now: Timestamp): boolean {
  const date = new Date(now);
  const isFriday = date.getDay() === 5;
  if (!isFriday) return false;
  const weekStart = weekStartOf(now, state.settings.weekStart);
  return !Object.values(state.journalEntries).some(
    (entry) => entry.entryDate >= weekStart && entry.status !== "trashed" && entry.title.includes("Weekly"),
  );
}

export function journalStreakDays(state: AppState, now: Timestamp = Date.now()): number {
  const days = new Set(
    Object.values(state.journalEntries)
      .filter((entry) => entry.status !== "trashed")
      .map((entry) => entry.dateKey),
  );
  let streak = 0;
  let cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (days.has(dateKeyOf(cursor.getTime()))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export function journalStreakAtRisk(state: AppState, now: Timestamp = Date.now()): number {
  const days = new Set(
    Object.values(state.journalEntries)
      .filter((entry) => entry.status !== "trashed")
      .map((entry) => entry.dateKey),
  );
  let cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (days.has(dateKeyOf(cursor.getTime()))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export function evaluateDueReminders(
  state: AppState,
  preferences: NotificationPreferences,
  now: Timestamp = Date.now(),
): DueReminder[] {
  return buildJournalReminders(state, preferences, now).map((reminder) => {
    const allowed = notificationAllowed(reminder.kind, preferences, now);
    if (!preferences.enabled) {
      return { reminder, allowed: false, reason: "Reminders are off until you turn them on." };
    }
    if (!allowed) {
      const { inQuietHours } = quietHourBoundaries(preferences, now);
      return {
        reminder,
        allowed: false,
        reason: inQuietHours ? "Quiet hours are active." : "This reminder type is switched off.",
      };
    }
    if (reminder.dueAt > now) {
      return {
        reminder,
        allowed: false,
        reason: `Scheduled for ${formatReminderTime(reminder.dueAt)}.`,
      };
    }
    return { reminder, allowed: true, reason: "Ready to send." };
  });
}

export function remindersWithinQuietHours(
  reminders: ScheduledReminder[],
  preferences: NotificationPreferences,
): ScheduledReminder[] {
  return reminders.filter(
    (reminder) => quietHourBoundaries(preferences, reminder.dueAt).inQuietHours,
  );
}

export function nextReminderAt(
  state: AppState,
  preferences: NotificationPreferences,
  now: Timestamp = Date.now(),
): Timestamp | null {
  const upcoming = buildJournalReminders(state, preferences, now).filter(
    (reminder) => notificationAllowed(reminder.kind, preferences, now) && reminder.dueAt >= now,
  );
  if (upcoming.length === 0) return null;
  return upcoming.reduce(
    (earliest, reminder) => (reminder.dueAt < earliest ? reminder.dueAt : earliest),
    now + DAY_MS,
  );
}

export function formatReminderTime(at: Timestamp, hour12 = false): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });
}

export interface FocusEndReminderInput {
  sessionId: ID;
  endsAt: Timestamp;
  taskTitle: string | null;
}

export function buildFocusEndReminder(input: FocusEndReminderInput): ScheduledReminder {
  return {
    id: `focus_end_${input.sessionId}`,
    kind: "focus_end",
    title: "Focus block finished",
    body: input.taskTitle ? `${input.taskTitle} - nice work.` : "Take a short break.",
    dueAt: input.endsAt,
  };
}

export function buildHabitDueReminder(habit: Habit, now: Timestamp, hour = 19): ScheduledReminder {
  return {
    id: `habit_${habit.id}`,
    kind: "habit",
    title: habit.title,
    body: "Still unchecked today.",
    dueAt: hourOn(now, hour),
  };
}

export function buildHabitReminder(habit: Habit, at: Timestamp): ScheduledReminder {
  return {
    id: `habit_${habit.id}`,
    kind: "habit",
    title: habit.title,
    body: "Still unchecked today.",
    dueAt: at,
  };
}
