import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";
import { DEFAULT_MODE, type Mode } from "./collaboration";

export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export type ProjectWipColumn = "todo" | "in_progress" | "review" | "done";

export type ProjectWipLimits = Partial<Record<ProjectWipColumn, number>>;

export function normalizeProjectWipLimits(input?: ProjectWipLimits | null): ProjectWipLimits {
  const limits: ProjectWipLimits = {};
  if (!input) return limits;
  for (const column of ["todo", "in_progress", "review", "done"] as const) {
    const value = input[column];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      limits[column] = Math.round(value);
    }
  }
  return limits;
}

export interface Project extends EntityMeta {
  type: "project";
  name: string;
  summary: string;
  status: ProjectStatus;
  color: string | null;
  goalIds: ID[];
  order: number;
  mode: Mode;
  wipLimits: ProjectWipLimits;
}

export interface NewProjectInput {
  name: string;
  summary?: string;
  status?: ProjectStatus;
  color?: string | null;
  goalIds?: ID[];
  order?: number;
  mode?: Mode;
  wipLimits?: ProjectWipLimits;
}

export function createProject(input: NewProjectInput, now: Timestamp = Date.now()): Project {
  return {
    type: "project",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name: input.name.trim(),
    summary: input.summary ?? "",
    status: input.status ?? "active",
    color: input.color ?? null,
    goalIds: input.goalIds ?? [],
    order: input.order ?? now,
    mode: input.mode ?? DEFAULT_MODE,
    wipLimits: normalizeProjectWipLimits(input.wipLimits),
  };
}
