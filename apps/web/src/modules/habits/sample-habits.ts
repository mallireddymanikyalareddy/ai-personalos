"use client";

import type { HabitCadence, HabitPriority, NewHabitInput, PersonalOS } from "@personalos/core";

const DAY = 86_400_000;

interface SampleHabit extends NewHabitInput {
  /** How many consecutive days (back from today) should be checked in. */
  streakDays: number;
  /** How many extra scattered days in the last month should be checked in. */
  scatteredDays: number;
}

export const SAMPLE_HABITS: SampleHabit[] = [
  {
    title: "Drink Water",
    description: "Drink at least 8 glasses of water",
    cadence: "daily",
    priority: "high",
    color: "var(--chart-5)",
    icon: "water",
    streakDays: 24,
    scatteredDays: 4,
  },
  {
    title: "Exercise",
    description: "Exercise for at least 30 minutes",
    cadence: "daily",
    priority: "high",
    color: "var(--chart-4)",
    icon: "dumbbell",
    streakDays: 18,
    scatteredDays: 3,
  },
  {
    title: "Read Book",
    description: "Read for 20 minutes daily",
    cadence: "daily",
    priority: "medium",
    color: "var(--chart-6)",
    icon: "book",
    streakDays: 12,
    scatteredDays: 5,
  },
  {
    title: "Meditate",
    description: "Meditate for 10 minutes",
    cadence: "daily",
    priority: "medium",
    color: "var(--chart-7)",
    icon: "meditate",
    streakDays: 16,
    scatteredDays: 2,
  },
  {
    title: "Eat Healthy",
    description: "Eat healthy meals",
    cadence: "weekdays",
    priority: "medium",
    color: "var(--chart-6)",
    icon: "salad",
    streakDays: 20,
    scatteredDays: 3,
  },
  {
    title: "Limit Social Media",
    description: "Use social media less than 30 min",
    cadence: "daily",
    priority: "low",
    color: "var(--chart-3)",
    icon: "screen",
    streakDays: 8,
    scatteredDays: 6,
  },
  {
    title: "Weekly Review",
    description: "Review the week and plan the next one",
    cadence: "weekly",
    daysOfWeek: [0],
    priority: "medium",
    color: "var(--chart-2)",
    icon: "focus",
    streakDays: 6,
    scatteredDays: 1,
  },
  {
    title: "Pay Bills",
    description: "Pay every outstanding bill on the 1st",
    cadence: "monthly",
    daysOfMonth: [1],
    priority: "high",
    color: "var(--chart-2)",
    icon: "save",
    streakDays: 3,
    scatteredDays: 1,
  },
];

function startOfDay(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isDue(cadence: HabitCadence, day: number): boolean {
  const dow = (new Date(day).getDay() + 6) % 7;
  switch (cadence) {
    case "daily":
      return true;
    case "weekdays":
      return dow < 5;
    case "weekly":
      return dow === 0;
    case "monthly":
      return new Date(day).getDate() === 1;
    case "custom":
      return dow === 0;
  }
}

export function seedSampleHabits(os: PersonalOS, now: number = Date.now()): string[] {
  const today = startOfDay(now);
  const createdAt = today - 90 * DAY;
  const ids: string[] = [];

  for (const sample of SAMPLE_HABITS) {
    const { streakDays, scatteredDays, ...input } = sample;
    const habit = os.addHabit(input as NewHabitInput, createdAt);
    ids.push(habit.id);

    const dueDays: number[] = [];
    for (let back = 0; back < 30; back += 1) {
      const day = today - back * DAY;
      if (isDue(habit.cadence, day)) dueDays.push(day);
    }

    dueDays.forEach((day, index) => {
      const inStreak = index < streakDays;
      const scattered = index < streakDays + scatteredDays && index % 3 === 2;
      if (!inStreak && !scattered) return;
      os.completeHabit(habit.id, day + 12 * 3_600_000, now);
    });
  }

  return ids;
}

export const HABIT_SUGGESTIONS: { title: string; description: string; icon: string; color: string; cadence: HabitCadence; priority: HabitPriority }[] = [
  {
    title: "Morning walk",
    description: "Walk for 20 minutes before work",
    icon: "walk",
    color: "var(--chart-6)",
    cadence: "daily",
    priority: "medium",
  },
  {
    title: "No screens after 10pm",
    description: "Protect your sleep by switching off",
    icon: "sleep-early",
    color: "var(--chart-7)",
    cadence: "daily",
    priority: "high",
  },
  {
    title: "Stretch for 5 minutes",
    description: "Unwind your shoulders and back",
    icon: "stretch",
    color: "var(--chart-3)",
    cadence: "weekdays",
    priority: "low",
  },
  {
    title: "Water the plants",
    description: "Keep the greenery alive",
    icon: "plants",
    color: "var(--chart-2)",
    cadence: "weekly",
    priority: "low",
  },
];