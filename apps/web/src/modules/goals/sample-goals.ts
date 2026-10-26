import type { GoalCategory, GoalMetric } from "@personalos/core";

import type { PersonalOS } from "@personalos/core";

export interface SeedGoal {
  title: string;
  description: string;
  category: GoalCategory;
  horizon: "life" | "year" | "quarter" | "month" | "week";
  targetAt: number;
  metrics: GoalMetric[];
  coverUrl?: string | null;
}

export const SAMPLE_GOALS: SeedGoal[] = [
  {
    title: "Run a half marathon",
    description: "Build the endurance to complete 21.1 km without stopping.",
    category: "health",
    horizon: "quarter",
    targetAt: Date.now() + 90 * 86_400_000,
    metrics: [
      { label: "Weekly km", current: 18, target: 40, unit: "km" },
      { label: "Longest run", current: 8, target: 21, unit: "km" },
    ],
  },
  {
    title: "Save for an emergency fund",
    description: "Set aside six months of living expenses in a high-yield account.",
    category: "financial",
    horizon: "year",
    targetAt: Date.now() + 180 * 86_400_000,
    metrics: [
      { label: "Saved", current: 45000, target: 150000, unit: "INR" },
    ],
  },
  {
    title: "Read 12 books this year",
    description: "A mix of fiction and professional development titles.",
    category: "learning",
    horizon: "year",
    targetAt: Date.now() + 270 * 86_400_000,
    metrics: [
      { label: "Books read", current: 4, target: 12, unit: "books" },
    ],
  },
  {
    title: "Get promoted to senior engineer",
    description: "Lead a project end to end and mentor two junior engineers.",
    category: "career",
    horizon: "year",
    targetAt: Date.now() + 300 * 86_400_000,
    metrics: [
      { label: "Mentored engineers", current: 1, target: 2, unit: "people" },
      { label: "Projects led", current: 1, target: 1, unit: "project" },
    ],
  },
];

export function seedSampleGoals(os: PersonalOS, now: number = Date.now()): string[] {
  const ids: string[] = [];

  for (const sample of SAMPLE_GOALS) {
    const goal = os.addGoal(
      {
        title: sample.title,
        description: sample.description,
        category: sample.category,
        horizon: sample.horizon,
        targetAt: sample.targetAt,
        metrics: sample.metrics,
      },
      now,
    );
    ids.push(goal.id);
  }

  return ids;
}