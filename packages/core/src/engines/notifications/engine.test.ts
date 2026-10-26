import { describe, expect, it } from "vitest";

import {
  DEFAULT_SWIPE_CONFIG,
  DEFAULT_NOTIFICATION_PREFERENCES,
  MOBILE_WIDGETS,
  SWIPE_ACTIONS,
  createDefaultMobilePreferences,
  decideSwipe,
  hapticPattern,
  normalizeMobilePreferences,
  notificationAllowed,
  quietHourBoundaries,
  quickActionsForRole,
  swipeActionFor,
  swipeActionList,
  widgetsFor,
  type MobilePreferences,
} from "../../types/mobile";
import {
  buildFocusEndReminder,
  buildJournalReminders,
  evaluateDueReminders,
  journalStreakDays,
  nextReminderAt,
  remindersWithinQuietHours,
} from "./engine";
import { createMemoryStorage } from "../../store/persistence";
import { createNotification } from "../../types/engagement";
import { PersonalOS } from "../../os";

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

describe("mobile preferences", () => {
  it("ships safe defaults", () => {
    const preferences = createDefaultMobilePreferences();
    expect(preferences.oneHanded).toBe(false);
    expect(preferences.handedness).toBe("right");
    expect(preferences.hapticsEnabled).toBe(true);
    expect(preferences.swipe.enabled).toBe(true);
    expect(preferences.notifications.enabled).toBe(false);
    expect(preferences.offlineFirst).toBe(true);
  });

  it("never enables reminders without explicit opt-in", () => {
    const preferences = createDefaultMobilePreferences();
    expect(preferences.notifications.enabled).toBe(false);
    expect(notificationAllowed("morning_journal", preferences.notifications, NOW)).toBe(false);
  });

  it("respects opt-in once turned on", () => {
    const preferences = createDefaultMobilePreferences();
    const on = { ...preferences.notifications, enabled: true };
    expect(notificationAllowed("morning_journal", on, NOW)).toBe(true);
    expect(notificationAllowed("habit", on, NOW)).toBe(false);

    const withHabits = { ...on, habitReminders: true };
    expect(notificationAllowed("habit", withHabits, NOW)).toBe(true);
  });

  it("keeps quiet hours silent", () => {
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: true, quietHoursStart: 22, quietHoursEnd: 7 };
    const during = new Date(2026, 9, 15, 23, 0, 0, 0).getTime();
    expect(quietHourBoundaries(preferences, during).inQuietHours).toBe(true);
    expect(notificationAllowed("evening_reflection", preferences, during)).toBe(false);

    const daytime = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();
    expect(notificationAllowed("evening_reflection", preferences, daytime)).toBe(true);
  });

  it("normalises partial preference patches", () => {
    const base = createDefaultMobilePreferences();
    const next = normalizeMobilePreferences({ oneHanded: true, widgets: [] });
    expect(next.oneHanded).toBe(true);
    expect(next.widgets).toEqual(base.widgets);
    expect(next.swipe).toEqual(base.swipe);
    expect(next.notifications).toEqual(base.notifications);
  });

  it("limits quick actions and widgets", () => {
    const preferences = createDefaultMobilePreferences();
    expect(quickActionsForRole(preferences, 3)).toHaveLength(3);
    expect(widgetsFor(preferences, 3)).toHaveLength(3);
    expect(widgetsFor(preferences, 3).every((widget) => MOBILE_WIDGETS[widget.id])).toBe(true);
  });
});

describe("swipe decisions", () => {
  it("ignores vertical drags", () => {
    expect(decideSwipe({ dx: 90, dy: 200, durationMs: 300 })).toBe("none");
  });

  it("commits past the threshold", () => {
    expect(decideSwipe({ dx: -90, dy: 4, durationMs: 240 })).toBe("commit-left");
    expect(decideSwipe({ dx: 90, dy: 4, durationMs: 240 })).toBe("commit-right");
  });

  it("commits a fast flick below the distance threshold", () => {
    expect(decideSwipe({ dx: -40, dy: 2, durationMs: 60 })).toBe("commit-left");
  });

  it("stays pending for a small movement", () => {
    expect(decideSwipe({ dx: -20, dy: 3, durationMs: 200 })).toBe("pending-left");
  });

  it("does nothing when swipes are disabled", () => {
    expect(decideSwipe({ dx: -120, dy: 0, durationMs: 100 }, { ...DEFAULT_SWIPE_CONFIG, enabled: false })).toBe("none");
  });

  it("maps actions per entity and direction", () => {
    const preferences = createDefaultMobilePreferences();
    expect(swipeActionFor(preferences, "task", "right").id).toBe("complete");
    expect(swipeActionFor(preferences, "task", "left").id).toBe("postpone");
    expect(swipeActionFor(preferences, "journal_entry", "right").id).toBe("open");
    expect(swipeActionFor(preferences, "journal_entry", "left").id).toBe("archive");
  });

  it("marks destructive actions for confirmation", () => {
    expect(SWIPE_ACTIONS.delete.confirmRequired).toBe(true);
    expect(SWIPE_ACTIONS.complete.confirmRequired).toBe(false);
    expect(swipeActionList("task").some((action) => action.destructive)).toBe(true);
  });
});

describe("haptic patterns", () => {
  it("grows with intensity", () => {
    const light = hapticPattern("light");
    const strong = hapticPattern("strong");
    expect(light).toHaveLength(1);
    expect(strong.length).toBeGreaterThan(light.length);
  });
});

describe("notification engine", () => {
  it("counts the current journal streak", () => {
    const os = makeOS();
    const day = 86_400_000;
    os.addJournalEntry({ entryDate: NOW, body: "today" }, NOW);
    os.addJournalEntry({ entryDate: NOW - day, body: "yesterday" }, NOW);

    expect(journalStreakDays(os.getState(), NOW)).toBe(2);
  });

  it("breaks a streak when a day is missing", () => {
    const os = makeOS();
    const day = 86_400_000;
    os.addJournalEntry({ entryDate: NOW, body: "today" }, NOW);
    os.addJournalEntry({ entryDate: NOW - 2 * day, body: "older" }, NOW);

    expect(journalStreakDays(os.getState(), NOW)).toBe(1);
  });

  it("suggests reminders but sends nothing while reminders are off", () => {
    const os = makeOS();
    os.updateMobilePreferences({ notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: false } });

    const due = evaluateDueReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((entry) => !entry.allowed)).toBe(true);
    expect(nextReminderAt(os.getState(), os.mobilePreferences().notifications, NOW)).toBeNull();
  });

  it("sends a journal reminder when opted in", () => {
    const os = makeOS();
    os.setNotificationPreferences({ enabled: true });

    const due = evaluateDueReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    const journal = due.find((entry) => entry.reminder.kind === "morning_journal");
    expect(journal?.allowed).toBe(true);
    expect(nextReminderAt(os.getState(), os.mobilePreferences().notifications, NOW)).not.toBeNull();
  });

  it("does not ask for today's entry twice", () => {
    const os = makeOS();
    os.setNotificationPreferences({ enabled: true });
    os.addJournalEntry({ entryDate: NOW, body: "done" }, NOW);

    const due = evaluateDueReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    expect(due.some((entry) => entry.reminder.kind === "morning_journal")).toBe(false);
  });

  it("reminds about the streak once it is worth protecting", () => {
    const os = makeOS();
    const day = 86_400_000;
    os.addJournalEntry({ entryDate: NOW - day, body: "yesterday" }, NOW);
    os.addJournalEntry({ entryDate: NOW - 2 * day, body: "day before" }, NOW);
    os.setNotificationPreferences({ enabled: true });

    const due = evaluateDueReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    expect(due.some((entry) => entry.reminder.kind === "journal_streak")).toBe(true);
  });

  it("keeps habit reminders off by default", () => {
    const os = makeOS();
    os.addHabit({ title: "Gym" });
    const reminders = buildJournalReminders(os.getState(), os.mobilePreferences().notifications, NOW);

    expect(reminders.some((reminder) => reminder.kind === "habit")).toBe(false);
  });

  it("adds habit reminders once asked for", () => {
    const os = makeOS();
    os.addHabit({ title: "Gym" });
    os.setNotificationPreferences({ enabled: true, habitReminders: true });

    const reminders = buildJournalReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    expect(reminders.some((reminder) => reminder.kind === "habit")).toBe(true);
  });

  it("builds a focus-end reminder for the session", () => {
    const reminder = buildFocusEndReminder({
      sessionId: "focus-1",
      endsAt: NOW + 25 * 60_000,
      taskTitle: "Write docs",
    });
    expect(reminder.title).toBe("Focus block finished");
    expect(reminder.body).toContain("Write docs");
    expect(notificationAllowed("focus_end", { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: true, focusEnd: true }, NOW)).toBe(true);
  });

  it("does not mark reminders ready before their scheduled time", () => {
    const os = makeOS();
    os.setNotificationPreferences({ enabled: true });

    const due = evaluateDueReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    const morning = due.find((entry) => entry.reminder.kind === "morning_journal");
    const evening = due.find((entry) => entry.reminder.kind === "evening_reflection");

    expect(morning?.allowed).toBe(true);
    expect(evening?.allowed).toBe(false);
    expect(evening?.reason).toContain("Scheduled");
  });

  it("uses the supplied clock when checking habits", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Gym" });
    os.addCheckIn(habit.id, NOW, NOW);
    os.setNotificationPreferences({ enabled: true, habitReminders: true });

    const reminders = buildJournalReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    expect(reminders.some((reminder) => reminder.kind === "habit")).toBe(false);
  });

  it("only reminds for habits that are due today", () => {
    const os = makeOS();
    os.addHabit({ title: "Sunday reset", cadence: "weekly", daysOfWeek: [0] });
    os.setNotificationPreferences({ enabled: true, habitReminders: true });

    const reminders = buildJournalReminders(os.getState(), os.mobilePreferences().notifications, NOW);
    expect(reminders.some((reminder) => reminder.kind === "habit")).toBe(false);
  });

  it("surfaces a focus-end reminder when the block is over", () => {
    const os = makeOS();
    os.setNotificationPreferences({ enabled: true, focusEnd: true });
    os.startFocusSession({ plannedMin: 25, startedAt: NOW }, NOW);

    const later = NOW + 26 * 60_000;
    const due = evaluateDueReminders(os.getState(), os.mobilePreferences().notifications, later);
    expect(due.find((entry) => entry.reminder.kind === "focus_end")?.allowed).toBe(true);
  });

  it("keeps generated reminders dismissed for the rest of the day", () => {
    const os = makeOS();
    os.setNotificationPreferences({ enabled: true });
    const morning = os.dueReminders(NOW).find((entry) => entry.reminder.kind === "morning_journal");

    os.dismissScheduledReminder(morning!.reminder, NOW);
    expect(os.dueReminders(NOW).some((entry) => entry.reminder.id === "morning_journal")).toBe(false);
    expect(
      os.dueReminders(NOW + 86_400_000).some((entry) => entry.reminder.id === "morning_journal"),
    ).toBe(true);
  });

  it("schedules evening reminders before quiet hours start", () => {
    const os = makeOS();
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      enabled: true,
      quietHoursStart: 20,
      quietHoursEnd: 7,
    };
    const reminders = buildJournalReminders(os.getState(), preferences, NOW);
    const evening = reminders.find((reminder) => reminder.kind === "evening_reflection");

    expect(new Date(evening!.dueAt).getHours()).toBe(19);
    expect(notificationAllowed("evening_reflection", preferences, evening!.dueAt)).toBe(true);
  });

  it("filters quiet-hour reminders with non-wrapping windows", () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      enabled: true,
      quietHoursStart: 9,
      quietHoursEnd: 17,
    };
    const at = (hour: number) => new Date(2026, 9, 15, hour, 0, 0, 0).getTime();
    const reminders = [
      { id: "day", kind: "reminder" as const, title: "Day", body: "", dueAt: at(12) },
      { id: "night", kind: "reminder" as const, title: "Night", body: "", dueAt: at(20) },
    ];

    expect(remindersWithinQuietHours(reminders, preferences).map((reminder) => reminder.id)).toEqual([
      "day",
    ]);
  });
});

describe("mobile OS API", () => {
  it("persists preference changes", () => {
    const os = makeOS();
    os.setOneHandedMode(true, "left");
    expect(os.mobilePreferences().oneHanded).toBe(true);
    expect(os.mobilePreferences().handedness).toBe("left");

    os.setHaptics(false, "light");
    expect(os.mobilePreferences().hapticsEnabled).toBe(false);
    expect(os.mobilePreferences().hapticIntensity).toBe("light");

    os.setSwipeConfig({ enabled: false });
    expect(os.mobilePreferences().swipe.enabled).toBe(false);

    os.setSwipeActions({ entity: "task", right: "pin", left: "delete" });
    expect(os.mobilePreferences().swipeRightTask).toBe("pin");
    expect(os.mobilePreferences().swipeLeftTask).toBe("delete");

    os.setSwipeActions({ entity: "journal_entry", right: "archive", left: "capture" });
    expect(os.mobilePreferences().swipeRightJournal).toBe("archive");

    os.setQuickActions(["capture_voice"]);
    expect(os.mobilePreferences().quickActions).toEqual(["capture_voice"]);

    os.setMobileWidgets(["streak"]);
    expect(os.mobilePreferences().widgets).toEqual(["streak"]);

    os.setNotificationPreferences({ enabled: true, morningJournal: false });
    expect(os.mobilePreferences().notifications.enabled).toBe(true);
    expect(os.mobilePreferences().notifications.morningJournal).toBe(false);
  });

  it("surfaces due reminders through the OS", () => {
    const os = makeOS();
    os.setNotificationPreferences({ enabled: true });
    expect(os.dueReminders(NOW).length).toBeGreaterThan(0);
    expect(os.journalStreakDays(NOW)).toBe(0);
  });

  it("tracks unread app notifications", () => {
    const os = makeOS();
    const notification = createNotification(
      { title: "You were mentioned", kind: "mention", body: "Take a look" },
      NOW,
    );
    os.store.insert("notifications", notification);

    expect(os.unreadNotificationCount()).toBe(1);
    os.markNotificationRead(notification.id, NOW);
    expect(os.unreadNotificationCount()).toBe(0);

    os.dismissNotification(notification.id, NOW);
    expect(os.notifications().some((entry) => entry.id === notification.id)).toBe(false);
  });
});

describe("stored reminders surface in the bell", () => {
  it("includes a due note reminder with its note title", () => {
    const os = new PersonalOS({ storage: undefined });
    os.clearAll();
    const note = os.addNote({ title: "Call the dentist" }, NOW - 3_600_000);
    os.addNoteReminder(note.id, NOW - 60_000, NOW - 3_600_000);

    const reminders = buildJournalReminders(os.getState(), {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      enabled: true,
      quietHoursStart: 23,
      quietHoursEnd: 6,
    }, NOW);
    const stored = reminders.filter((entry) => entry.kind === "reminder");

    expect(stored).toHaveLength(1);
    expect(stored[0]!.title).toBe("Call the dentist");
  });

  it("hides future reminders and dismissed ones", () => {
    const os = new PersonalOS({ storage: undefined });
    os.clearAll();
    const note = os.addNote({ title: "Later" }, NOW);
    const future = os.addNoteReminder(note.id, NOW + 3_600_000, NOW);
    os.addNoteReminder(note.id, NOW - 60_000, NOW);
    os.fireReminder(future!.id);

    const reminders = buildJournalReminders(os.getState(), {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      enabled: true,
      quietHoursStart: 23,
      quietHoursEnd: 6,
    }, NOW);
    const stored = reminders.filter((entry) => entry.kind === "reminder");

    expect(stored).toHaveLength(1);
    expect(stored[0]!.title).toBe("Later");
  });
});