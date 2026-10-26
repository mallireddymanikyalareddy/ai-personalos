import type { EntityType, ID, Priority, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";

export type AchievementStatus = "locked" | "unlocked" | "hidden";

export type AchievementCategory = "streak" | "volume" | "milestone" | "exploration";

export interface NewAchievementInput extends CanonicalInput {
  key: string;
  title: string;
  description?: string;
  category?: AchievementCategory;
  threshold?: number;
  xpAward?: number;
  builtin?: boolean;
}

export interface Achievement extends CanonicalEntity {
  type: "achievement";
  key: string;
  title: string;
  description: string;
  icon: string | null;
  category: AchievementCategory;
  threshold: number;
  xpAward: number;
  builtin: boolean;
  progress: number;
  unlockedAt: Timestamp | null;
  status: AchievementStatus;
}

export function createAchievement(input: NewAchievementInput, now: Timestamp = Date.now()): Achievement {
  return {
    ...createCanonicalBase({ ...input, origin: input.origin ?? (input.builtin ? "system" : "manual") }, now),
    type: "achievement",
    key: input.key.trim().toLowerCase(),
    title: input.title.trim(),
    description: input.description ?? "",
    icon: null,
    category: input.category ?? "volume",
    threshold: input.threshold ?? 1,
    xpAward: input.xpAward ?? 10,
    builtin: input.builtin ?? false,
    progress: 0,
    unlockedAt: null,
    status: "locked",
  };
}

export type XPReason =
  | "task_complete"
  | "habit_streak"
  | "goal_milestone"
  | "achievement"
  | "focus_session"
  | "reward_redeem"
  | "manual"
  | "correction";

export type XPTransactionStatus = "posted" | "reversed";

export interface NewXPTransactionInput extends CanonicalInput {
  amount: number;
  reason: XPReason;
  entityType?: EntityType | null;
  entityId?: ID | null;
  note?: string;
}

export interface XPTransaction extends CanonicalEntity {
  type: "xp_transaction";
  amount: number;
  reason: XPReason;
  entityType: EntityType | null;
  entityId: ID | null;
  note: string;
  balanceAfter: number | null;
  status: XPTransactionStatus;
}

export function createXPTransaction(
  input: NewXPTransactionInput,
  now: Timestamp = Date.now(),
): XPTransaction {
  return {
    ...createCanonicalBase({ ...input, origin: input.origin ?? "system" }, now),
    type: "xp_transaction",
    amount: Math.trunc(input.amount),
    reason: input.reason,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    note: input.note ?? "",
    balanceAfter: null,
    status: "posted",
  };
}

export type RewardStatus = "available" | "locked" | "redeemed" | "archived";

export interface NewRewardInput extends CanonicalInput {
  title: string;
  cost: number;
  description?: string;
  icon?: string | null;
  availableAt?: Timestamp | null;
  builtin?: boolean;
}

export interface Reward extends CanonicalEntity {
  type: "reward";
  title: string;
  description: string;
  cost: number;
  icon: string | null;
  availableAt: Timestamp | null;
  redeemedAt: Timestamp | null;
  status: RewardStatus;
  builtin: boolean;
}

export function createReward(input: NewRewardInput, now: Timestamp = Date.now()): Reward {
  return {
    ...createCanonicalBase(input, now),
    type: "reward",
    title: input.title.trim(),
    description: input.description ?? "",
    cost: Math.max(0, Math.trunc(input.cost)),
    icon: input.icon ?? null,
    availableAt: input.availableAt ?? null,
    redeemedAt: null,
    status: "available",
    builtin: input.builtin ?? false,
  };
}

export type FocusSessionStatus = "running" | "paused" | "completed" | "aborted";

export type FocusMode = "flow" | "pomodoro" | "custom" | "stopwatch" | "countdown" | "interval";

export type FocusPhase = "work" | "break" | "long_break";

export type FocusAmbient = "none" | "white" | "brown" | "rain" | "waves";

export interface NewFocusSessionInput extends CanonicalInput {
  startedAt: Timestamp;
  plannedMin?: number | null;
  taskId?: ID | null;
  goalId?: ID | null;
  timeBlockId?: ID | null;
  mode?: FocusMode;
  ambient?: FocusAmbient;
  rounds?: FocusRound[];
}

export interface FocusRound {
  index: number;
  phase: FocusPhase;
  startedAt: Timestamp;
  endsAt: Timestamp | null;
  completed: boolean;
}

export interface FocusDistraction {
  at: Timestamp;
  resumedAt: Timestamp | null;
  durationMs: number | null;
  reason: string;
}

export interface FocusSession extends CanonicalEntity {
  type: "focus_session";
  startedAt: Timestamp;
  endsAt: Timestamp | null;
  plannedMin: number | null;
  taskId: ID | null;
  goalId: ID | null;
  timeBlockId: ID | null;
  interruptions: number;
  distractionCount: number;
  distractions: FocusDistraction[];
  pausedAt: Timestamp | null;
  pausedMs: number;
  activeMs: number;
  rounds: FocusRound[];
  ambient: FocusAmbient;
  mode: FocusMode;
  status: FocusSessionStatus;
  completedAt: Timestamp | null;
  rating: number | null;
  note: string;
}

export function createFocusSession(
  input: NewFocusSessionInput,
  now: Timestamp = Date.now(),
): FocusSession {
  return {
    ...createCanonicalBase(input, now),
    type: "focus_session",
    startedAt: input.startedAt,
    endsAt: null,
    plannedMin: input.plannedMin ?? null,
    taskId: input.taskId ?? null,
    goalId: input.goalId ?? null,
    timeBlockId: input.timeBlockId ?? null,
    interruptions: 0,
    distractionCount: 0,
    distractions: [],
    pausedAt: null,
    pausedMs: 0,
    activeMs: 0,
    rounds: input.rounds ?? [],
    ambient: input.ambient ?? "none",
    mode: input.mode ?? "flow",
    status: "running",
    completedAt: null,
    rating: null,
    note: "",
  };
}

export type NotificationKind =
  | "reminder"
  | "achievement"
  | "streak"
  | "ai_insight"
  | "approval"
  | "system"
  | "mention"
  | "assignment"
  | "comment"
  | "shift"
  | "time_off";

export type NotificationStatus = "pending" | "delivered" | "read" | "dismissed";

export interface NewNotificationInput extends CanonicalInput {
  title: string;
  kind: NotificationKind;
  body?: string;
  entityType?: EntityType | null;
  entityId?: ID | null;
  fireAt?: Timestamp | null;
  priority?: Priority;
}

export interface Notification extends CanonicalEntity {
  type: "notification";
  title: string;
  kind: NotificationKind;
  body: string;
  entityType: EntityType | null;
  entityId: ID | null;
  fireAt: Timestamp | null;
  priority: Priority;
  readAt: Timestamp | null;
  dismissedAt: Timestamp | null;
  status: NotificationStatus;
}

export function createNotification(input: NewNotificationInput, now: Timestamp = Date.now()): Notification {
  return {
    ...createCanonicalBase({ ...input, origin: input.origin ?? "system" }, now),
    type: "notification",
    title: input.title.trim(),
    kind: input.kind,
    body: input.body ?? "",
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    fireAt: input.fireAt ?? null,
    priority: input.priority ?? 1,
    readAt: null,
    dismissedAt: null,
    status: "pending",
  };
}
