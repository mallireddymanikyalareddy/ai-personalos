import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";

export type GoalHorizon = "life" | "year" | "quarter" | "month" | "week";
export type GoalStatus = "draft" | "active" | "on_hold" | "completed" | "archived";

export type GoalCategory =
  | "financial"
  | "health"
  | "learning"
  | "personal"
  | "sports"
  | "career"
  | "other";

export const GOAL_CATEGORIES: readonly GoalCategory[] = [
  "financial",
  "health",
  "learning",
  "personal",
  "sports",
  "career",
  "other",
];

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  financial: "Financial",
  health: "Health",
  learning: "Learning",
  personal: "Personal",
  sports: "Sports",
  career: "Career",
  other: "Other",
};

export interface GoalMetric {
  label: string;
  current: number;
  target: number;
  unit: string;
}

export interface Goal extends EntityMeta {
  type: "goal";
  title: string;
  description: string;
  horizon: GoalHorizon;
  status: GoalStatus;
  targetAt: Timestamp | null;
  progress: number;
  metrics: GoalMetric[];
  lifeAreaId: ID | null;
  category: GoalCategory;
  coverUrl: string | null;
}

export interface NewGoalInput {
  title: string;
  description?: string;
  horizon?: GoalHorizon;
  status?: GoalStatus;
  targetAt?: Timestamp | null;
  progress?: number;
  metrics?: GoalMetric[];
  lifeAreaId?: ID | null;
  category?: GoalCategory;
  coverUrl?: string | null;
}

export function createGoal(input: NewGoalInput, now: Timestamp = Date.now()): Goal {
  return {
    type: "goal",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    description: input.description ?? "",
    horizon: input.horizon ?? "quarter",
    status: input.status ?? "active",
    targetAt: input.targetAt ?? null,
    progress: input.progress ?? 0,
    metrics: input.metrics ?? [],
    lifeAreaId: input.lifeAreaId ?? null,
    category: input.category ?? "other",
    coverUrl: input.coverUrl ?? null,
  };
}