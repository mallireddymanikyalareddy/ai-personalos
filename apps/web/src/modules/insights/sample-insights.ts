"use client";

import { startOfDay, type ID, type PersonalOS } from "@personalos/core";

const DAY = 86_400_000;
const HOUR = 3_600_000;

interface SeedTask {
  title: string;
  tags: string[];
  dayOffset: number;
  done?: boolean;
  priority?: number;
}

const SEED_TASKS: SeedTask[] = [
  { title: "Review client deck", tags: ["work", "client"], dayOffset: 0, done: true, priority: 4 },
  { title: "Send the invoice", tags: ["finance"], dayOffset: 0, done: true, priority: 3 },
  { title: "Gym session", tags: ["health"], dayOffset: 0, done: true },
  { title: "Read two chapters", tags: ["learning", "book"], dayOffset: 0, done: true },
  { title: "Plan the week", tags: ["personal"], dayOffset: 0, done: true },
  { title: "Fix the D365 runbook", tags: ["work", "support"], dayOffset: 1, done: true, priority: 4 },
  { title: "Team retrospective", tags: ["work", "team"], dayOffset: 1, done: true },
  { title: "Meal prep", tags: ["health", "food"], dayOffset: 1, done: true },
  { title: "Write release notes", tags: ["work", "documentation"], dayOffset: 2, done: true, priority: 3 },
  { title: "Evening run", tags: ["health"], dayOffset: 2, done: true },
  { title: "Online course", tags: ["learning", "course"], dayOffset: 2, done: true },
  { title: "Review the budget", tags: ["finance"], dayOffset: 3, done: true },
  { title: "Update the project plan", tags: ["work", "project"], dayOffset: 3, done: true, priority: 4 },
  { title: "Call family", tags: ["personal", "family"], dayOffset: 3, done: true },
  { title: "Meditate", tags: ["health"], dayOffset: 4, done: true },
  { title: "Client workshop", tags: ["work", "client"], dayOffset: 4, done: true, priority: 4 },
  { title: "Read research paper", tags: ["learning"], dayOffset: 4, done: true },
  { title: "Grocery run", tags: ["personal"], dayOffset: 5, done: true },
  { title: "Sprint demo", tags: ["work", "sprint"], dayOffset: 5, done: true },
  { title: "Investor update", tags: ["finance"], dayOffset: 5, done: true },
  { title: "Yoga", tags: ["health"], dayOffset: 6, done: true },
  { title: "Design review", tags: ["work", "project"], dayOffset: 6, done: true, priority: 3 },
  { title: "Study session", tags: ["learning"], dayOffset: 6, done: true },
  { title: "Two high-priority tasks left", tags: ["work"], dayOffset: 6, done: false, priority: 4 },
  { title: "One more client call", tags: ["work", "client"], dayOffset: 6, done: false, priority: 4 },
];

interface SeedMeeting {
  title: string;
  dayOffset: number;
  hour: number;
  minutes: number;
  attendees: number;
  completed: boolean;
}

const SEED_MEETINGS: SeedMeeting[] = [
  { title: "Client sync", dayOffset: 1, hour: 11, minutes: 45, attendees: 3, completed: true },
  { title: "Team standup", dayOffset: 2, hour: 9, minutes: 30, attendees: 5, completed: true },
  { title: "Design review", dayOffset: 3, hour: 14, minutes: 60, attendees: 4, completed: true },
  { title: "1:1 with Alex", dayOffset: 4, hour: 15, minutes: 30, attendees: 2, completed: true },
  { title: "Sprint planning", dayOffset: -1, hour: 10, minutes: 60, attendees: 6, completed: false },
];

export function seedSampleInsights(os: PersonalOS, now: number = Date.now()): ID[] {
  const ids: ID[] = [];
  const existing = new Set(Object.values(os.getState().tasks).map((task) => task.title));

  for (const seed of SEED_TASKS) {
    if (existing.has(seed.title)) continue;
    const dueAt = now - seed.dayOffset * DAY + 10 * HOUR;
    const task = os.addTask(
      {
        title: seed.title,
        tags: seed.tags,
        dueAt,
        priority: (seed.priority ?? 2) as 0 | 1 | 2 | 3 | 4,
        status: seed.done ? "done" : "open",
      },
      now - 10 * DAY,
    );
    if (seed.done) {
      os.updateTask(task.id, { status: "done", completedAt: dueAt, startedAt: dueAt - 30 * 60_000 });
    }
    ids.push(task.id);
  }

  if (os.focusSessions(true).length === 0) {
    for (let day = 0; day < 7; day += 1) {
      const minutes = day === 0 ? 155 : 90 + (day % 4) * 35;
      const startedAt = now - day * DAY + 9 * HOUR;
      const session = os.startFocusSession(
        { startedAt, plannedMin: minutes, mode: "countdown" },
        startedAt,
      );
      os.completeFocusSession(session.id, {}, startedAt + minutes * 60_000);
      ids.push(session.id);
    }
  }

  const goalSeeds = [
    { title: "Build MedoriQ Platform", target: 100, current: 90 },
    { title: "Grow Investment Portfolio", target: 100, current: 75 },
    { title: "Improve Health & Fitness", target: 100, current: 85 },
    { title: "Learn AI & Automation", target: 100, current: 80 },
  ];
  for (const seed of goalSeeds) {
    if (Object.values(os.getState().goals).some((goal) => goal.title === seed.title)) continue;
    const goal = os.addGoal({ title: seed.title }, now - 40 * DAY);
    os.addGoalMetric(goal.id, {
      label: "Progress",
      current: seed.current,
      target: seed.target,
      unit: "%",
    });
    ids.push(goal.id);
  }

  if (Object.values(os.getState().habits).length === 0) {
    const habits = [
      { title: "Exercise", cadence: "daily" as const, days: 7 },
      { title: "Read", cadence: "daily" as const, days: 6 },
      { title: "Meditate", cadence: "daily" as const, days: 4 },
      { title: "Journal", cadence: "daily" as const, days: 5 },
      { title: "Water", cadence: "daily" as const, days: 6 },
    ];
    for (const habit of habits) {
      const created = os.addHabit(
        { title: habit.title, cadence: habit.cadence, daysOfWeek: [], daysOfMonth: [] },
        now - 30 * DAY,
      );
      for (let back = 0; back < habit.days; back += 1) {
        const at = now - back * DAY + 8 * HOUR;
        os.completeHabit(created.id, at, now);
      }
      ids.push(created.id);
    }
  }

  for (const seed of SEED_MEETINGS) {
    const date = new Date(now - seed.dayOffset * DAY);
    date.setHours(seed.hour, 0, 0, 0);
    const startsAt = date.getTime();
    const exists = Object.values(os.getState().meetings).some(
      (meeting) => meeting.title === seed.title && startOfDay(meeting.startsAt) === startOfDay(startsAt),
    );
    if (exists) continue;
    const meeting = os.addMeeting(
      {
        title: seed.title,
        startsAt,
        endsAt: startsAt + seed.minutes * 60_000,
        attendees: Array.from({ length: seed.attendees }, (_, index) => ({
          id: `sample-attendee-${seed.title}-${index}`,
          name: `Guest ${index + 1}`,
          email: `guest${index + 1}@example.com`,
        })),
      },
      now,
    );
    if (seed.completed) os.updateMeeting(meeting.id, { status: "completed" });
    ids.push(meeting.id);
  }

  return ids;
}
