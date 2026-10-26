import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";
import type { XPReason } from "./engagement";

export type SkillKind = "execution" | "consistency" | "focus" | "planning" | "knowledge" | "wellbeing";

export interface SkillLevel {
  level: number;
  xp: number;
}

export interface Skill extends EntityMeta {
  type: "skill";
  kind: SkillKind;
  label: string;
  level: number;
  xp: number;
  updatedAt: Timestamp;
}

export type NewSkillInput = Omit<Skill, "id" | "createdAt" | "updatedAt" | "type">;

export function createSkill(input: NewSkillInput, now: Timestamp = Date.now()): Skill {
  return {
    type: "skill",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

export interface SkillLevels {
  execution: SkillLevel;
  consistency: SkillLevel;
  focus: SkillLevel;
  planning: SkillLevel;
  knowledge: SkillLevel;
  wellbeing: SkillLevel;
}

export interface SkillDefinition {
  kind: SkillKind;
  label: string;
  description: string;
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  { kind: "execution", label: "Execution", description: "Finishing the work you choose." },
  { kind: "consistency", label: "Consistency", description: "Keeping habits alive over time." },
  { kind: "focus", label: "Focus", description: "Deep work you actually protect." },
  { kind: "planning", label: "Planning", description: "Turning direction into milestones." },
  { kind: "knowledge", label: "Knowledge", description: "Capturing and summarising what you learn." },
  { kind: "wellbeing", label: "Wellbeing", description: "Rest and reflection, not just output." },
];

export const SKILL_KINDS = SKILL_DEFINITIONS.map((definition) => definition.kind);

export interface GamificationPreferences {
  enabled: boolean;
  showStreaks: boolean;
  showLeaderboard: boolean;
  gentleReminders: boolean;
  dailyFocusCapMin: number;
  maxTasksCreditedPerDay: number;
  breakReminderEveryMin: number;
}

export function createDefaultGamificationPreferences(): GamificationPreferences {
  return {
    enabled: true,
    showStreaks: true,
    showLeaderboard: false,
    gentleReminders: false,
    dailyFocusCapMin: 240,
    maxTasksCreditedPerDay: 20,
    breakReminderEveryMin: 90,
  };
}

export const LEVEL_FLOOR_XP = 60;
export const LEVEL_STEP_XP = 35;

export function levelForXp(totalXp: number): number {
  const safe = Math.max(0, Math.floor(totalXp));
  if (safe < LEVEL_FLOOR_XP) return 1;
  return Math.floor(1 + (safe - LEVEL_FLOOR_XP) / LEVEL_STEP_XP) + 1;
}

export function xpForLevel(level: number): number {
  const target = Math.max(1, Math.floor(level));
  if (target <= 1) return 0;
  return LEVEL_FLOOR_XP + (target - 2) * LEVEL_STEP_XP;
}

export function xpToNextLevel(totalXp: number): { level: number; next: number; current: number; needed: number } {
  const safe = Math.max(0, Math.floor(totalXp));
  const level = levelForXp(safe);
  const next = xpForLevel(level + 1);
  const current = xpForLevel(level);
  return { level, next, current, needed: Math.max(0, next - safe) };
}

export function levelTitle(level: number): string {
  if (level <= 1) return "Getting started";
  if (level <= 3) return "Finding your footing";
  if (level <= 5) return "Building momentum";
  if (level <= 8) return "In steady flow";
  if (level <= 12) return "Deeply practised";
  return "Mastered rhythm";
}

export interface XPRule {
  reason: XPReason;
  skill: SkillKind;
  base: number;
  label: string;
  wellnessNote: string;
}

export const XP_RULES: XPRule[] = [
  { reason: "task_complete", skill: "execution", base: 10, label: "Task completed", wellnessNote: "Finishing counts once — no bonus for speed." },
  { reason: "habit_streak", skill: "consistency", base: 12, label: "Habit kept", wellnessNote: "Streaks reward consistency, not perfection." },
  { reason: "focus_session", skill: "focus", base: 15, label: "Focus session", wellnessNote: "Time-boxed and capped so rest stays possible." },
  { reason: "goal_milestone", skill: "planning", base: 25, label: "Milestone reached", wellnessNote: "Milestones count once, not per task inside." },
  { reason: "achievement", skill: "execution", base: 0, label: "Achievement", wellnessNote: "Achievement XP is declared by the achievement." },
  { reason: "reward_redeem", skill: "wellbeing", base: 0, label: "Reward redeemed", wellnessNote: "Spending coins is the point, not the score." },
  { reason: "manual", skill: "execution", base: 0, label: "Manual adjustment", wellnessNote: "Use rarely — the ledger should stay honest." },
  { reason: "correction", skill: "execution", base: 0, label: "Correction", wellnessNote: "Reversals keep the ledger honest." },
];

export const XP_RULE_BY_REASON: Partial<Record<XPReason, XPRule>> = XP_RULES.reduce(
  (map, rule) => {
    map[rule.reason] = rule;
    return map;
  },
  {} as Partial<Record<XPReason, XPRule>>,
);

export const GAIN_REASONS: XPReason[] = [
  "task_complete",
  "habit_streak",
  "focus_session",
  "goal_milestone",
];

export type CoinSink = "reward" | "unlock" | "gift" | "manual";

export interface CoinLedgerEntry extends EntityMeta {
  type: "coin_transaction";
  amount: number;
  sink: CoinSink;
  reason: XPReason | "reward_redeem";
  entityType: string | null;
  entityId: ID | null;
  note: string;
  balanceAfter: number | null;
}

export interface NewCoinLedgerInput {
  amount: number;
  sink: CoinSink;
  reason: XPReason | "reward_redeem";
  entityType?: string | null;
  entityId?: ID | null;
  note?: string;
}

export function createCoinLedgerEntry(input: NewCoinLedgerInput, now: Timestamp = Date.now()): CoinLedgerEntry {
  return {
    type: "coin_transaction",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    amount: Math.trunc(input.amount),
    sink: input.sink,
    reason: input.reason,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    note: input.note ?? "",
    balanceAfter: null,
  };
}

export interface RewardShopItem {
  id: ID;
  title: string;
  description: string;
  cost: number;
  builtin: boolean;
  skill: SkillKind | null;
}

export interface GamificationState {
  xpTotal: number;
  coins: number;
  skills: SkillLevels;
}
