import type { ID, Timestamp } from "./common";
import type { Priority } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";
import type { HabitCadence } from "./habit";

export type LifeAreaStatus = "active" | "archived";

export interface NewLifeAreaInput extends CanonicalInput {
  name: string;
  description?: string;
  color?: string | null;
  icon?: string | null;
  order?: number;
}

export interface LifeArea extends CanonicalEntity {
  type: "life_area";
  name: string;
  description: string;
  color: string | null;
  icon: string | null;
  order: number;
  status: LifeAreaStatus;
}

export function createLifeArea(input: NewLifeAreaInput, now: Timestamp = Date.now()): LifeArea {
  return {
    ...createCanonicalBase(input, now),
    type: "life_area",
    name: input.name.trim(),
    description: input.description ?? "",
    color: input.color ?? null,
    icon: input.icon ?? null,
    order: input.order ?? now,
    status: "active",
  };
}

export type MilestoneStatus = "open" | "completed" | "dropped" | "archived";

export interface NewMilestoneInput extends CanonicalInput {
  projectId: ID;
  title: string;
  summary?: string;
  dueAt?: Timestamp | null;
  order?: number;
}

export interface Milestone extends CanonicalEntity {
  type: "milestone";
  projectId: ID;
  title: string;
  summary: string;
  dueAt: Timestamp | null;
  order: number;
  completedAt: Timestamp | null;
  status: MilestoneStatus;
}

export function createMilestone(input: NewMilestoneInput, now: Timestamp = Date.now()): Milestone {
  return {
    ...createCanonicalBase(input, now),
    type: "milestone",
    projectId: input.projectId,
    title: input.title.trim(),
    summary: input.summary ?? "",
    dueAt: input.dueAt ?? null,
    order: input.order ?? now,
    completedAt: null,
    status: "open",
  };
}

export type RoutineStatus = "active" | "archived";
export type RoutineSlot = "morning" | "evening" | "work" | "custom";

export interface RoutineStep {
  title: string;
  taskId: ID | null;
  habitId: ID | null;
  durationMin: number | null;
}

export interface NewRoutineInput extends CanonicalInput {
  title: string;
  description?: string;
  slot?: RoutineSlot;
  lifeAreaId?: ID | null;
  steps?: RoutineStep[];
  cadence?: HabitCadence;
  daysOfWeek?: number[];
}

export interface Routine extends CanonicalEntity {
  type: "routine";
  title: string;
  description: string;
  slot: RoutineSlot;
  lifeAreaId: ID | null;
  steps: RoutineStep[];
  cadence: HabitCadence;
  daysOfWeek: number[];
  status: RoutineStatus;
}

export function createRoutine(input: NewRoutineInput, now: Timestamp = Date.now()): Routine {
  return {
    ...createCanonicalBase(input, now),
    type: "routine",
    title: input.title.trim(),
    description: input.description ?? "",
    slot: input.slot ?? "custom",
    lifeAreaId: input.lifeAreaId ?? null,
    steps: input.steps ?? [],
    cadence: input.cadence ?? "daily",
    daysOfWeek: input.daysOfWeek ?? [],
    status: "active",
  };
}

export type CalendarProvider = "local" | "google" | "outlook" | "apple";

export type CalendarStatus = "active" | "hidden" | "archived";

export interface NewCalendarInput extends CanonicalInput {
  name: string;
  color?: string | null;
  provider?: CalendarProvider;
  providerCalendarId?: string | null;
  isDefault?: boolean;
}

export interface Calendar extends CanonicalEntity {
  type: "calendar";
  name: string;
  color: string | null;
  provider: CalendarProvider;
  providerCalendarId: string | null;
  syncEnabled: boolean;
  isDefault: boolean;
  timezone: string | null;
  status: CalendarStatus;
}

export function createCalendar(input: NewCalendarInput, now: Timestamp = Date.now()): Calendar {
  return {
    ...createCanonicalBase(input, now),
    type: "calendar",
    name: input.name.trim(),
    color: input.color ?? null,
    provider: input.provider ?? "local",
    providerCalendarId: input.providerCalendarId ?? null,
    syncEnabled: false,
    isDefault: input.isDefault ?? false,
    timezone: null,
    status: "active",
  };
}

export type TemplateTarget =
  | "task"
  | "note"
  | "goal"
  | "habit"
  | "project"
  | "routine"
  | "meeting"
  | "journal_entry";

export type TemplateStatus = "active" | "archived";

export type TemplateCategory =
  | "work"
  | "personal"
  | "planning"
  | "finance"
  | "health"
  | "learning"
  | "productivity"
  | "projects";

export type TemplateKind =
  | "planner"
  | "tracker"
  | "summary"
  | "brief"
  | "log"
  | "plan"
  | "budget"
  | "checklist";

export type TemplateItemKind = "task" | "habit" | "goal" | "project" | "note" | "routine";

export type TemplateSource = "builtin" | "custom" | "imported" | "ai";

export interface TemplateUseCreated {
  kind: TemplateItemKind;
  id: ID;
  title: string;
}

export interface TemplateUseResult {
  ok: boolean;
  message: string;
  created: TemplateUseCreated[];
}

export interface TemplateItem {
  kind: TemplateItemKind;
  title: string;
  detail: string;
  cadence: "daily" | "weekly" | "monthly" | null;
  tags: string[];
  priority: Priority;
  sections: string[];
  group: string;
}

export interface NewTemplateInput extends CanonicalInput {
  name: string;
  target: TemplateTarget;
  title?: string;
  body?: string;
  payload?: Record<string, unknown> | null;
  tags?: string[];
  builtin?: boolean;
  order?: number;
  description?: string;
  category?: TemplateCategory;
  templateKind?: TemplateKind;
  icon?: string | null;
  items?: TemplateItem[];
  popularity?: number;
  source?: TemplateSource;
  createdFromId?: ID | null;
}

export interface Template extends CanonicalEntity {
  type: "template";
  name: string;
  target: TemplateTarget;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  tags: string[];
  icon: string | null;
  builtin: boolean;
  order: number;
  status: TemplateStatus;
  description: string;
  category: TemplateCategory;
  templateKind: TemplateKind;
  items: TemplateItem[];
  popularity: number;
  useCount: number;
  favorite: boolean;
  lastUsedAt: Timestamp | null;
  source: TemplateSource;
  createdFromId: ID | null;
}

export function createTemplateItem(input: Partial<TemplateItem> & { kind: TemplateItemKind; title: string }): TemplateItem {
  return {
    kind: input.kind,
    title: input.title.trim(),
    detail: input.detail ?? "",
    cadence: input.cadence ?? null,
    tags: input.tags ?? [],
    priority: input.priority ?? 2,
    sections: input.sections ?? [],
    group: input.group ?? "",
  };
}

export function createTemplate(input: NewTemplateInput, now: Timestamp = Date.now()): Template {
  return {
    ...createCanonicalBase(input, now),
    type: "template",
    name: input.name.trim(),
    target: input.target,
    title: input.title ?? "",
    body: input.body ?? "",
    payload: input.payload ?? null,
    tags: input.tags ?? [],
    icon: input.icon ?? null,
    builtin: input.builtin ?? false,
    order: input.order ?? now,
    status: "active",
    description: input.description ?? "",
    category: input.category ?? "productivity",
    templateKind: input.templateKind ?? "planner",
    items: input.items ?? [],
    popularity: input.popularity ?? 0,
    useCount: 0,
    favorite: false,
    lastUsedAt: null,
    source: input.source ?? (input.builtin ? "builtin" : "custom"),
    createdFromId: input.createdFromId ?? null,
  };
}

export interface PlanTemplateBlock {
  dayOffset: number;
  startMin: number;
  durationMin: number;
  title: string;
  kind: "focus" | "meeting" | "routine" | "buffer" | "personal";
  taskId: ID | null;
}

export interface PlanTemplatePayload {
  kind: "plan_template";
  dayCount: number;
  blocks: PlanTemplateBlock[];
}

export interface PlanTemplateApplyResult {
  ok: boolean;
  message: string;
  createdBlockIds: ID[];
  skipped: number;
}

export function planTemplatePayload(template: Template): PlanTemplatePayload | null {
  const payload = template.payload as Partial<PlanTemplatePayload> | null;
  if (!payload || payload.kind !== "plan_template" || !Array.isArray(payload.blocks)) return null;
  return {
    kind: "plan_template",
    dayCount: Math.max(1, Number(payload.dayCount) || 1),
    blocks: payload.blocks.filter(
      (block): block is PlanTemplateBlock =>
        block != null &&
        typeof block === "object" &&
        typeof block.title === "string" &&
        typeof block.startMin === "number" &&
        typeof block.durationMin === "number",
    ),
  };
}