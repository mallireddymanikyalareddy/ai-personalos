"use client";

import type { ID, PersonalOS } from "@personalos/core";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const STORE_REWARDS = [
  { title: "₹500 Amazon Card", description: "Gift card for anything you need", cost: 120, icon: "🛒" },
  { title: "₹500 Flipkart Card", description: "A little treat for yourself", cost: 120, icon: "🛍️" },
  { title: "Coffee Treat", description: "Break Time", cost: 30, icon: "☕" },
  { title: "Movie Ticket", description: "BookMyShow", cost: 60, icon: "🎬" },
];

const TASK_TITLES = [
  "Ship the D365 runbook",
  "Read the design systems guide",
  "Plan the sprint",
  "Update the knowledge base",
  "Reply to the client thread",
  "Read the architecture chapter",
  "Write the release notes",
  "Fix the flaky test",
];

const TASK_TAGS = ["planning", "learning", "work"];

const HABIT_TITLES = [
  { title: "Exercise", tag: "health" },
  { title: "Read", tag: "learning" },
  { title: "Meditate", tag: "wellbeing" },
  { title: "Water", tag: "health" },
  { title: "Journal", tag: "learning" },
];

const FOCUS_NOTES = [
  "Deep work on the roadmap",
  "Write the design doc",
  "Refactor the parser",
  "Review the analytics spec",
  "Plan the quarter",
  "Walk through the backlog",
  "Draft the weekly note",
];

export function seedSampleRewards(os: PersonalOS, now: number = Date.now()): ID[] {
  const ids: ID[] = [];

  os.seedGamificationCatalog(now);

  const existingRewards = new Set(os.availableRewards().map((reward) => reward.title));
  for (const seed of STORE_REWARDS) {
    if (existingRewards.has(seed.title)) continue;
    os.addReward(
      { title: seed.title, description: seed.description, cost: seed.cost, icon: seed.icon },
      now,
    );
  }

  const existingTasks = new Set(Object.values(os.getState().tasks).map((task) => task.title));
  TASK_TITLES.forEach((title, index) => {
    if (existingTasks.has(title)) return;
    const task = os.addTask(
      {
        title,
        tags: [TASK_TAGS[index % TASK_TAGS.length]!],
        dueAt: now - index * DAY + 10 * HOUR,
        priority: index % 3 === 0 ? 4 : 3,
      },
      now - (index + 5) * DAY,
    );
    const completedAt = now - index * DAY + 9 * HOUR;
    os.completeTask(task.id, completedAt);
    ids.push(task.id);
  });

  const existingHabits = new Set(Object.values(os.getState().habits).map((habit) => habit.title));
  for (const habitSeed of HABIT_TITLES) {
    if (existingHabits.has(habitSeed.title)) continue;
    const habit = os.addHabit(
      { title: habitSeed.title, cadence: "daily", daysOfWeek: [], daysOfMonth: [] },
      now - 40 * DAY,
    );
    for (let back = 0; back < 7; back += 1) {
      os.completeHabit(habit.id, now - back * DAY + 8 * HOUR, now);
    }
    ids.push(habit.id);
  }

  const existingFocus = new Set(
    Object.values(os.getState().focusSessions).map((session) => session.note ?? ""),
  );
  FOCUS_NOTES.forEach((note, index) => {
    if (existingFocus.has(note)) return;
    const startedAt = now - index * DAY + 13 * HOUR;
    const minutes = 50 + index * 10;
    const session = os.startFocusSession(
      { startedAt, plannedMin: minutes, mode: "countdown" },
      startedAt,
    );
    os.completeFocusSession(session.id, { note }, startedAt + minutes * 60_000);
    ids.push(session.id);
  });

  const existingProjects = new Set(Object.values(os.getState().projects).map((p) => p.name));
  if (!existingProjects.has("Quarterly plan")) {
    const project = os.addProject({ name: "Quarterly plan" }, now - 30 * DAY);
    const milestone = os.addMilestone(
      { projectId: project.id, title: "First milestone", dueAt: now - DAY },
      now - 20 * DAY,
    );
    os.completeMilestone(milestone.id, now - DAY);
    ids.push(project.id);
  }

  const existingGoals = new Set(Object.values(os.getState().goals).map((goal) => goal.title));
  if (!existingGoals.has("Ship the quarterly plan")) {
    const goal = os.addGoal({ title: "Ship the quarterly plan" }, now - 30 * DAY);
    os.completeGoal(goal.id, now - DAY);
    ids.push(goal.id);
  }

  return ids;
}
