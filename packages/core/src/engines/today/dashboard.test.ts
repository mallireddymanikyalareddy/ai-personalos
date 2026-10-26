import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { addDays, startOfDay } from "../date-utils";
import {
  activeGoals,
  buildActivityFeed,
  buildTodayGoals,
  buildTodayInsights,
  buildTodayJournal,
  buildTodaySchedule,
  buildTodayStats,
  buildTodayTasks,
  buildTodayWelcome,
  greetingFor,
  habitsDueToday,
  todayTaskCounts,
} from "./dashboard";

const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();
const DAY = 86_400_000;
const HOUR = 3_600_000;

let os: PersonalOS;

function reset(): void {
  os = new PersonalOS({ storage: undefined });
  os.clearAll();
}

beforeEach(() => {
  reset();
  os.updateProfile({ displayName: "Mani Krishnan" });
});

describe("today: greeting", () => {
  it("picks a greeting from the hour", () => {
    expect(greetingFor(new Date(2026, 9, 8, 8).getTime())).toBe("Good morning");
    expect(greetingFor(new Date(2026, 9, 8, 14).getTime())).toBe("Good afternoon");
    expect(greetingFor(new Date(2026, 9, 8, 19).getTime())).toBe("Good evening");
    expect(greetingFor(new Date(2026, 9, 8, 23).getTime())).toBe("Good night");
  });

  it("uses only the first name and falls back when unset", () => {
    const welcome = buildTodayWelcome(os.getState(), NOW);
    expect(welcome.greeting).toBe("Good morning");
    expect(welcome.displayName).toBe("Mani");
    expect(welcome.quote.length).toBeGreaterThan(10);

    os.updateProfile({ displayName: "" });
    expect(buildTodayWelcome(os.getState(), NOW).displayName).toBe("there");
  });

  it("reports being ahead of plan when more is done than overdue", () => {
    os.completeTask(os.addTask({ title: "Ship it", dueAt: NOW - 2 * HOUR }, NOW).id, NOW);
    const welcome = buildTodayWelcome(os.getState(), NOW);
    expect(welcome.message).toContain("ahead of your plan");
  });

  it("reports being behind when overdue work outpaces progress", () => {
    os.addTask({ title: "Late thing", dueAt: addDays(NOW, -3) }, NOW);
    const welcome = buildTodayWelcome(os.getState(), NOW);
    expect(welcome.message).toContain("behind");
  });

  it("says the day is clear when nothing is due", () => {
    expect(buildTodayWelcome(os.getState(), NOW).message).toContain("Nothing is due");
  });
});

describe("today: stats", () => {
  it("starts every counter at zero", () => {
    const stats = buildTodayStats(os.getState(), NOW);
    expect(stats.focusMin).toBe(0);
    expect(stats.tasksDone).toBe(0);
    expect(stats.tasksTotal).toBe(0);
    expect(stats.habitStreak).toBe(0);
    expect(stats.moodId).toBeNull();
    expect(stats.moodLabel).toBeNull();
  });

  it("counts completed and due tasks for today", () => {
    const a = os.addTask({ title: "A", dueAt: NOW }, NOW);
    os.addTask({ title: "B", dueAt: NOW }, NOW);
    os.completeTask(a.id, NOW);

    const stats = buildTodayStats(os.getState(), NOW);
    expect(stats.tasksTotal).toBe(2);
    expect(stats.tasksDone).toBe(1);
  });

  it("sums focus minutes for today only", () => {
    const today = os.startFocusSession({ startedAt: NOW - 2 * HOUR, plannedMin: 50 }, NOW);
    os.completeFocusSession(today.id, {}, NOW - 2 * HOUR + 50 * 60000);
    const yesterday = os.startFocusSession({ startedAt: NOW - DAY - HOUR, plannedMin: 30 }, NOW);
    os.completeFocusSession(yesterday.id, {}, NOW - DAY - HOUR + 30 * 60000);

    const stats = buildTodayStats(os.getState(), NOW);
    expect(stats.focusMin).toBe(50);
    expect(stats.focusDeltaPct).toBe(67);
  });

  it("surfaces today's mood from the journal", () => {
    const entry = os.openJournalFor(NOW, NOW);
    os.updateJournalEntry(entry.id, { mood: "happy" }, NOW);

    const stats = buildTodayStats(os.getState(), NOW);
    expect(stats.moodId).toBe("happy");
    expect(stats.moodLabel).toBe("Happy");
    expect(stats.moodOptions.length).toBeGreaterThan(4);
  });

  it("tracks the best habit streak", () => {
    const habit = os.addHabit({ title: "Read", cadence: "daily" }, NOW - 10 * DAY);
    for (let day = 0; day < 4; day += 1) os.completeHabit(habit.id, NOW - day * DAY, NOW);

    const stats = buildTodayStats(os.getState(), NOW);
    expect(stats.habitStreak).toBe(4);
    expect(stats.habitTotal).toBe(1);
  });
});

describe("today: schedule", () => {
  it("is empty with nothing booked", () => {
    expect(buildTodaySchedule(os.getState(), NOW)).toHaveLength(0);
  });

  it("merges events, time blocks and scheduled tasks in time order", () => {
    os.addEvent({ title: "Standup", startsAt: NOW + HOUR, endsAt: NOW + HOUR + 30 * 60000 }, NOW);
    os.addTimeBlock({ title: "Deep work", startsAt: NOW + 2 * HOUR, endsAt: NOW + 3 * HOUR }, NOW);
    const task = os.addTask({ title: "Reply to Ana", estimateMin: 20 }, NOW);
    os.scheduleTask(task.id, NOW + 30 * 60000);

    const schedule = buildTodaySchedule(os.getState(), NOW);
    expect(schedule.map((entry) => entry.title)).toEqual([
      "Reply to Ana",
      "Standup",
      "Deep work",
    ]);
    expect(schedule[0]!.kind).toBe("task");
    expect(schedule[1]!.kind).toBe("event");
    expect(schedule[2]!.kind).toBe("time_block");
  });

  it("excludes anything outside today", () => {
    os.addEvent({ title: "Tomorrow", startsAt: NOW + DAY, endsAt: NOW + DAY + HOUR }, NOW);
    expect(buildTodaySchedule(os.getState(), NOW)).toHaveLength(0);
  });

  it("marks past entries as informational and completed blocks as done", () => {
    os.addEvent({ title: "Past", startsAt: NOW - 3 * HOUR, endsAt: NOW - 2 * HOUR }, NOW);
    const block = os.addTimeBlock({ title: "Done block", startsAt: NOW - HOUR, endsAt: NOW }, NOW);
    os.updateTimeBlock(block.id, { completedAt: NOW - 10 * 60000 });

    const schedule = buildTodaySchedule(os.getState(), NOW);
    expect(schedule.find((entry) => entry.title === "Past")!.tone).toBe("info");
    expect(schedule.find((entry) => entry.title === "Done block")!.done).toBe(true);
  });

  it("skips completed tasks in the schedule", () => {
    const task = os.addTask({ title: "Finished", estimateMin: 30 }, NOW);
    os.scheduleTask(task.id, NOW + HOUR);
    os.completeTask(task.id, NOW);

    expect(buildTodaySchedule(os.getState(), NOW)).toHaveLength(0);
  });
});

describe("today: top tasks", () => {
  it("separates today, overdue and this week", () => {
    const overdue = os.addTask({ title: "Late", dueAt: NOW - 2 * DAY }, NOW);
    const today = os.addTask({ title: "Today", dueAt: NOW + HOUR }, NOW);
    const week = os.addTask({ title: "Week", dueAt: addDays(startOfDay(NOW), 3) }, NOW);
    void overdue;
    void week;

    const counts = todayTaskCounts(os.getState(), NOW);
    expect(counts.overdue).toBe(1);
    expect(counts.today).toBe(1);
    expect(counts.week).toBeGreaterThanOrEqual(2);

    const overdueRows = buildTodayTasks(os.getState(), NOW, "overdue");
    expect(overdueRows[0]!.title).toBe("Late");
    expect(overdueRows[0]!.overdue).toBe(true);
    expect(overdueRows[0]!.bucket).toBe("overdue");

    const weekRows = buildTodayTasks(os.getState(), NOW, "week");
    expect(weekRows.map((row) => row.title)).toContain("Week");

    const todayRows = buildTodayTasks(os.getState(), NOW, "today");
    expect(todayRows.map((row) => row.title)).toContain("Today");
    expect(todayRows.map((row) => row.id)).not.toContain(overdue.id);
    void today;
  });

  it("labels priority and time for due-today rows", () => {
    const task = os.addTask({ title: "Urgent", dueAt: NOW, priority: 3 }, NOW);
    const rows = buildTodayTasks(os.getState(), NOW, "today");
    const row = rows.find((entry) => entry.id === task.id)!;
    expect(row.priorityLabel).toBe("High");
    expect(row.dueLabel).toMatch(/\d/);
  });

  it("respects the limit", () => {
    for (let index = 0; index < 6; index += 1) {
      os.addTask({ title: `T${index}`, dueAt: NOW }, NOW);
    }
    expect(buildTodayTasks(os.getState(), NOW, "today", 3)).toHaveLength(3);
  });
});

describe("today: habits", () => {
  it("returns nothing when no habits are active", () => {
    expect(habitsDueToday(os.getState(), NOW)).toHaveLength(0);
  });

  it("lists due habits with streak and done state", () => {
    const habit = os.addHabit({ title: "Morning run", cadence: "daily" }, NOW - 6 * DAY);
    os.completeHabit(habit.id, NOW - DAY, NOW);

    const rows = habitsDueToday(os.getState(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Morning run");
    expect(rows[0]!.done).toBe(false);
    expect(rows[0]!.streak).toBe(1);
    expect(rows[0]!.streakLabel).toBe("1 day streak");

    os.completeHabit(habit.id, NOW, NOW);
    const done = habitsDueToday(os.getState(), NOW);
    expect(done[0]!.done).toBe(true);
    expect(done[0]!.streak).toBe(2);
    expect(done[0]!.streakLabel).toBe("2 day streak");
  });

  it("breaks the streak after a missed day", () => {
    const habit = os.addHabit({ title: "Read", cadence: "daily" }, NOW - 10 * DAY);
    os.completeHabit(habit.id, NOW, NOW);
    os.completeHabit(habit.id, NOW - DAY, NOW);
    os.completeHabit(habit.id, NOW - 2 * DAY, NOW);

    expect(habitsDueToday(os.getState(), NOW)[0]!.streak).toBe(3);

    os.completeHabit(habit.id, NOW - 4 * DAY, NOW);
    expect(habitsDueToday(os.getState(), NOW)[0]!.streak).toBe(3);
  });

  it("puts completed habits last", () => {
    const a = os.addHabit({ title: "Done one", cadence: "daily" }, NOW - DAY);
    os.addHabit({ title: "Pending one", cadence: "daily" }, NOW - DAY);
    os.completeHabit(a.id, NOW);

    const rows = habitsDueToday(os.getState(), NOW);
    expect(rows[rows.length - 1]!.done).toBe(true);
  });

  it("skips habits that are not due today", () => {
    os.addHabit({ title: "Mondays only", cadence: "weekly", daysOfWeek: [1], period: "day" }, NOW);
    const rows = habitsDueToday(os.getState(), NOW);
    expect(rows.every((row) => row.title !== "Mondays only")).toBe(true);
  });
});

describe("today: goals", () => {
  it("returns nothing without active goals", () => {
    expect(buildTodayGoals(os.getState(), NOW)).toHaveLength(0);
    expect(activeGoals(os.getState())).toHaveLength(0);
  });

  it("includes only active goals, best progress first", () => {
    const low = os.addGoal("Low goal", NOW);
    const high = os.addGoal("High goal", NOW);
    os.addGoalMetric(low.id, { label: "Sessions", current: 1, target: 10, unit: "x" });
    os.addGoalMetric(high.id, { label: "Sessions", current: 9, target: 10, unit: "x" });
    os.addGoal({ title: "Archived", status: "archived" } as never, NOW);

    const rows = buildTodayGoals(os.getState(), NOW);
    expect(rows.map((row) => row.title)).toEqual(["High goal", "Low goal"]);
    expect(rows[0]!.progress).toBe(90);
  });
});

describe("today: journal", () => {
  it("prompts when nothing is written today", () => {
    const preview = buildTodayJournal(os.getState(), NOW);
    expect(preview.written).toBe(false);
    expect(preview.entryId).toBeNull();
    expect(preview.preview).toBe("");
  });

  it("previews today's entry with streak, tags and photos", () => {
    const entry = os.openJournalFor(NOW, NOW);
    os.updateJournalEntry(entry.id, { body: "Long day at work", tags: ["work", "team"] }, NOW);
    const attachment = os.addAttachment({
      ownerType: "journal_entry",
      ownerId: entry.id,
      name: "photo.png",
      mimeType: "image/png",
      sizeBytes: 10,
      url: "blob:photo",
    });
    os.updateJournalEntry(entry.id, { attachmentIds: [attachment.id] }, NOW);

    const preview = buildTodayJournal(os.getState(), NOW);
    expect(preview.written).toBe(true);
    expect(preview.entryId).toBe(entry.id);
    expect(preview.preview).toContain("Long day at work");
    expect(preview.tags).toEqual(["work", "team"]);
    expect(preview.attachmentUrls).toEqual(["blob:photo"]);
    expect(preview.streakLabel).toContain("streak");
  });

  it("ignores trashed entries", () => {
    const entry = os.openJournalFor(NOW, NOW);
    os.updateJournalEntry(entry.id, { body: "Draft", status: "trashed" }, NOW);
    expect(buildTodayJournal(os.getState(), NOW).written).toBe(false);
  });
});

describe("today: activity feed", () => {
  it("is empty on a fresh install", () => {
    expect(buildActivityFeed(os.getState(), NOW)).toHaveLength(0);
  });

  it("collects completions, notes, habits, journals and memories newest first", () => {
    const task = os.addTask({ title: "Finish report" }, NOW - 5 * HOUR);
    os.completeTask(task.id, NOW - 4 * HOUR);
    os.addNote({ title: "Meeting notes" }, NOW - 3 * HOUR);
    const habit = os.addHabit({ title: "Stretch" }, NOW - 3 * HOUR);
    os.completeHabit(habit.id, NOW - 2 * HOUR);
    os.openJournalFor(NOW, NOW);
    os.addMemoryMoment({ title: "Andaman trip", happenedAt: NOW - 2 * HOUR }, NOW - HOUR);

    const feed = buildActivityFeed(os.getState(), NOW);
    const kinds = feed.map((entry) => entry.kind);
    expect(kinds).toContain("task_completed");
    expect(kinds).toContain("note_added");
    expect(kinds).toContain("habit_completed");
    expect(kinds).toContain("journal_written");
    expect(kinds).toContain("memory_added");

    for (let index = 1; index < feed.length; index += 1) {
      expect(feed[index - 1]!.when).toBeGreaterThanOrEqual(feed[index]!.when);
    }

    expect(feed.find((entry) => entry.kind === "task_completed")!.detail).toBe("Finish report");
    expect(feed.find((entry) => entry.kind === "habit_completed")!.detail).toBe("Stretch");
  });

  it("includes finished focus sessions and ignores aborted ones", () => {
    const done = os.startFocusSession({ startedAt: NOW - 2 * HOUR, plannedMin: 25 }, NOW);
    os.completeFocusSession(done.id, {}, NOW - HOUR);
    const aborted = os.startFocusSession({ startedAt: NOW - 2 * HOUR, plannedMin: 25 }, NOW);
    os.abortFocusSession(aborted.id, NOW - HOUR);

    const feed = buildActivityFeed(os.getState(), NOW);
    expect(feed.some((entry) => entry.kind === "focus_session")).toBe(true);
    expect(feed.filter((entry) => entry.kind === "focus_session")).toHaveLength(1);
  });

  it("drops entries older than the window", () => {
    const old = os.addNote({ title: "Old note" }, NOW - 10 * DAY);
    os.updateNote(old.id, { title: "Old note" });
    expect(buildActivityFeed(os.getState(), NOW, 12, 3)).toHaveLength(0);
    expect(buildActivityFeed(os.getState(), NOW, 12, 30)).toHaveLength(1);
  });

  it("respects the limit", () => {
    for (let index = 0; index < 8; index += 1) os.addNote({ title: `N${index}` }, NOW);
    expect(buildActivityFeed(os.getState(), NOW, 3)).toHaveLength(3);
  });
});

describe("today: insights", () => {
  it("nudges to start focus when none is logged", () => {
    const insights = buildTodayInsights(os.getState(), NOW);
    expect(insights.some((insight) => insight.title.includes("No focus time"))).toBe(true);
  });

  it("warns about overdue tasks with the oldest age", () => {
    os.addTask({ title: "Very late", dueAt: NOW - 5 * DAY }, NOW);
    const insights = buildTodayInsights(os.getState(), NOW);
    const overdue = insights.find((insight) => insight.id === "overdue")!;
    expect(overdue.tone).toBe("warning");
    expect(overdue.detail).toContain("5 days late");
  });

  it("reports task progress", () => {
    const a = os.addTask({ title: "A", dueAt: NOW }, NOW);
    os.addTask({ title: "B", dueAt: NOW }, NOW);
    os.completeTask(a.id, NOW);

    const progress = buildTodayInsights(os.getState(), NOW).find(
      (insight) => insight.id === "progress",
    )!;
    expect(progress.title).toContain("50%");
  });

  it("celebrates a finished habit list", () => {
    const habit = os.addHabit({ title: "Read", cadence: "daily" }, NOW - DAY);
    os.completeHabit(habit.id, NOW);

    const habitInsight = buildTodayInsights(os.getState(), NOW).find(
      (insight) => insight.id === "habits",
    )!;
    expect(habitInsight.tone).toBe("positive");
    expect(habitInsight.title).toContain("All 1 habits");
  });
});