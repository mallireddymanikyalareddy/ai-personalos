"use client";

import type { PersonalOS } from "@personalos/core";

const DAY = 86_400_000;
const HOUR = 3_600_000;


interface TaskSeed {
  title: string;
  hour: number;
  minute: number;
  priority: 1 | 2 | 3 | 4;
  done: boolean;
}

const DONE_TASKS: TaskSeed[] = [
  { title: "Update user licenses", hour: 9, minute: 15, priority: 2, done: true },
  { title: "Update D365 runbook documentation", hour: 10, minute: 30, priority: 3, done: true },
  { title: "Review purchase agreement workflow", hour: 12, minute: 0, priority: 3, done: true },
];

const OPEN_TASKS: TaskSeed[] = [
  { title: "Fix warehouse issue with slotting", hour: 14, minute: 0, priority: 2, done: false },
  { title: "Prepare KT session for next week", hour: 16, minute: 0, priority: 2, done: false },
  { title: "Review trade agreement configuration", hour: 18, minute: 0, priority: 1, done: false },
];

const OVERDUE_TASKS = [
  { title: "Send revised pricing sheet", daysAgo: 1 },
  { title: "Confirm the vendor call", daysAgo: 2 },
];

const HABITS: Array<{ title: string; streak: number; doneToday: boolean }> = [
  { title: "Morning Exercise", streak: 12, doneToday: true },
  { title: "Read Book", streak: 5, doneToday: true },
  { title: "Meditation", streak: 8, doneToday: true },
  { title: "Healthy Eating", streak: 4, doneToday: false },
  { title: "No Sugar", streak: 2, doneToday: false },
  { title: "Sleep 7+ Hours", streak: 6, doneToday: false },
];

const GOALS = [
  { title: "Grow Wealth", description: "Build long-term financial security.", current: 6, target: 10, unit: "%" },
  { title: "Improve Health", description: "Exercise, eat healthy and stay fit.", current: 75, target: 100, unit: "%" },
  { title: "Learn New Technologies", description: "Next.js, AI and automation.", current: 4, target: 10, unit: "%" },
  { title: "Play More Cricket", description: "Weekly practice and improve performance.", current: 8, target: 10, unit: "%" },
];

export function seedSampleDay(os: PersonalOS, now: number = Date.now()): number {
  let created = 0;

  const at = (hour: number, minute = 0, dayOffset = 0): number => {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date.getTime();
  };

  const state = os.getState();
  const has = (collection: Record<string, { title?: string; name?: string }>, title: string): boolean =>
    Object.values(collection).some((entry) => entry.title === title || entry.name === title);

  for (const seed of DONE_TASKS) {
    if (has(state.tasks, seed.title)) continue;
    const task = os.addTask(
      { title: seed.title, dueAt: at(seed.hour, seed.minute), priority: seed.priority },
      now - HOUR,
    );
    os.completeTask(task.id, at(seed.hour, seed.minute));
    created += 1;
  }

  for (const seed of OPEN_TASKS) {
    if (has(state.tasks, seed.title)) continue;
    os.addTask(
      { title: seed.title, dueAt: at(seed.hour, seed.minute), priority: seed.priority },
      now - HOUR,
    );
    created += 1;
  }

  for (const seed of OVERDUE_TASKS) {
    if (has(state.tasks, seed.title)) continue;
    os.addTask(
      { title: seed.title, dueAt: at(11, 0, -seed.daysAgo), priority: 3 },
      now - seed.daysAgo * DAY,
    );
    created += 1;
  }

  const scheduled = Object.values(state.tasks).find((task) => task.title === "Review warehouse issues");
  if (!scheduled) {
    const task = os.addTask(
      {
        title: "Review warehouse issues",
        estimateMin: 90,
        dueAt: at(10, 0),
        priority: 3,
      },
      now - HOUR,
    );
    os.scheduleTask(task.id, at(10, 0));
    created += 1;
  }

  for (const seed of HABITS) {
    const existing = Object.values(state.habits).find((habit) => habit.title === seed.title);
    const habit =
      existing ??
      os.addHabit(
        { title: seed.title, cadence: "daily", daysOfWeek: [], daysOfMonth: [] },
        now - (seed.streak + 2) * DAY,
      );
    if (!existing) created += 1;
    const offset = seed.doneToday ? 0 : 1;
    for (let back = offset; back < offset + seed.streak; back += 1) {
      os.completeHabit(habit.id, now - back * DAY, now);
    }
  }

  for (const seed of GOALS) {
    if (has(state.goals, seed.title)) continue;
    const goal = os.addGoal(
      { title: seed.title, description: seed.description, horizon: "quarter" },
      now - DAY,
    );
    os.addGoalMetric(goal.id, {
      label: "Progress",
      current: seed.current,
      target: seed.target,
      unit: seed.unit,
    });
    created += 1;
  }

  for (const meeting of [
    { title: "D365 Support Standup", hour: 9, minutes: 30, summarized: true },
    { title: "Trade agreement discussion", hour: 14, minutes: 60, summarized: false },
  ]) {
    if (has(state.meetings, meeting.title)) continue;
    const startsAt = at(meeting.hour, 0);
    const record = os.addMeeting(
      { title: meeting.title, startsAt, endsAt: startsAt + meeting.minutes * 60_000, attendeeIds: [] },
      now - HOUR,
    );
    if (meeting.summarized) {
      os.updateMeeting(record.id, {
        aiSummary: "Team aligned on the support backlog and the next release window.",
        status: "completed",
      });
    }
    created += 1;
  }

  for (const event of [
    { title: "Lunch with Team", hour: 12, minutes: 60 },
    { title: "Cricket practice", hour: 16, minutes: 120 },
    { title: "Family time", hour: 19, minutes: 60 },
  ]) {
    if (Object.values(state.events).some((entry) => entry.title === event.title)) continue;
    const startsAt = at(event.hour, 0);
    os.addEvent({ title: event.title, startsAt, endsAt: startsAt + event.minutes * 60_000 }, now - DAY);
    created += 1;
  }

  if (!has(state.notes, "Trade agreement ideas")) {
    os.addNote(
      { title: "Trade agreement ideas", body: "Draft the clause list and share with legal." },
      now - DAY,
    );
    created += 1;
  }

  if (!Object.values(state.memoryMoments).some((moment) => moment.title === "Cricket match photos")) {
    os.addMemoryMoment(
      { title: "Cricket match photos", happenedAt: now - 2 * DAY },
      now - 2 * DAY,
    );
    created += 1;
  }

  const journalEntry = os.journalEntryFor(now);
  if (!journalEntry) {
    os.addJournalEntry(
      {
        entryDate: now,
        body:
          "Today was a productive day. Completed support documentation, had a good meeting with the team and went for cricket practice. Felt energetic and happy.",
        tags: ["work", "cricket", "family"],
        mood: "happy",
      },
      now,
    );
    created += 1;
  }

  const sessions = Object.values(state.focusSessions);
  if (!sessions.some((session) => session.completedAt != null && session.completedAt >= at(0, 0))) {
    const startedAt = now - 3 * HOUR;
    const session = os.startFocusSession({ startedAt, plannedMin: 150, mode: "countdown" }, startedAt);
    os.completeFocusSession(session.id, { note: "Deep work on the roadmap" }, startedAt + 150 * 60_000);
    created += 1;
  }
  if (!sessions.some((session) => session.completedAt != null && session.completedAt < at(0, 0))) {
    const startedAt = at(9, 0, -1);
    const session = os.startFocusSession({ startedAt, plannedMin: 125, mode: "countdown" }, startedAt);
    os.completeFocusSession(session.id, { note: "Yesterday's deep work" }, startedAt + 125 * 60_000);
    created += 1;
  }

  const completedYesterday = Object.values(os.getState().tasks).filter(
    (task) => task.completedAt != null && task.completedAt >= at(0, 0, -1) && task.completedAt < at(0, 0),
  ).length;
  if (completedYesterday === 0) {
    for (const title of ["Clear the inbox", "Morning review", "Update the board", "Send the daily note"]) {
      if (has(os.getState().tasks, title)) continue;
      const task = os.addTask(
        { title, dueAt: at(17, 0, -1), priority: 2 },
        now - 2 * DAY,
      );
      os.completeTask(task.id, at(16, 0, -1));
      created += 1;
    }
  }

  return created;
}
