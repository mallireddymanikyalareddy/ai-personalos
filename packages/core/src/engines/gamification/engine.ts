import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type {
  CoinLedgerEntry,
  SkillKind,
  SkillLevel,
  SkillLevels,
} from "../../types/gamification";
import {
  GAIN_REASONS,
  LEVEL_FLOOR_XP,
  LEVEL_STEP_XP,
  SKILL_KINDS,
  XP_RULE_BY_REASON,
  levelTitle,
  xpForLevel,
  xpToNextLevel,
} from "../../types/gamification";
import { createCoinLedgerEntry } from "../../types/gamification";
import type { Achievement, Reward, XPTransaction } from "../../types/engagement";

const COIN_RATE = 0.1;

export { COIN_RATE };

export interface AwardOutcome {
  ok: boolean;
  message: string;
  amount: number;
  skill: SkillKind;
  coins: number;
  xpTotal: number;
  level: number;
  levelBefore?: number;
  capped: boolean;
  unlocked: Achievement[];
}

export interface RedeemResult {
  ok: boolean;
  message: string;
  cost: number;
}

export interface GamificationProfile {
  xpTotal: number;
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForLevel: number;
  nextLevelAt: number;
  progressToNextLevel: number;
  coins: number;
  skills: SkillLevels;
}

function emptySkillLevels(): SkillLevels {
  return SKILL_KINDS.reduce((map, kind) => {
    map[kind] = { level: 1, xp: 0 };
    return map;
  }, {} as SkillLevels);
}

export function skillLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  if (xp < LEVEL_FLOOR_XP) return 1;
  return Math.floor(1 + (xp - LEVEL_FLOOR_XP) / LEVEL_STEP_XP) + 1;
}

export function buildGamificationProfile(state: AppState): GamificationProfile {
  const skills = state.skills ?? ({} as AppState["skills"]);
  const levels = emptySkillLevels();

  let xpTotal = 0;
  for (const transaction of Object.values(state.xpTransactions)) {
    if (transaction.status !== "posted") continue;
    xpTotal += transaction.amount;
  }

  for (const kind of SKILL_KINDS) {
    const skill = Object.values(skills).find((entry) => entry.kind === kind);
    levels[kind] = skill
      ? { level: skill.level, xp: skill.xp }
      : { level: skillLevelFromXp(0), xp: 0 };
  }

  const xp = Math.max(0, Math.round(xpTotal));
  const next = xpToNextLevel(xp);
  const span = Math.max(1, xpForLevel(next.level + 1) - xpForLevel(next.level));
  const coins = state.coinLedger
    ? Object.values(state.coinLedger).reduce((sum, entry) => sum + entry.amount, 0)
    : 0;

  return {
    xpTotal: xp,
    level: next.level,
    title: levelTitle(next.level),
    xpIntoLevel: Math.max(0, xp - next.current),
    xpForLevel: span,
    nextLevelAt: next.needed,
    progressToNextLevel: Math.min(1, Math.max(0, (xp - next.current) / span)),
    coins: Math.max(0, Math.round(coins)),
    skills: levels,
  };
}

export interface AwardVerdict {
  allowed: boolean;
  reason: string;
  capped: boolean;
  amount: number;
}

export function canAward(
  state: AppState,
  reason: string,
  entityId: ID | null,
  now: Timestamp,
): AwardVerdict {
  const prefs = state.settings.gamification;
  if (!prefs.enabled) {
    return { allowed: false, reason: "Gamification is switched off.", capped: false, amount: 0 };
  }
  const rule = XP_RULE_BY_REASON[reason as keyof typeof XP_RULE_BY_REASON];
  if (!rule) {
    return { allowed: false, reason: "That activity does not earn XP.", capped: false, amount: 0 };
  }

  const dayStart = startOfLocalDay(now);
  const dayEnd = dayStart + 86_400_000;

  if (GAIN_REASONS.includes(rule.reason)) {
    if (entityId) {
      for (const transaction of Object.values(state.xpTransactions)) {
        if (
          transaction.status === "posted" &&
          transaction.reason === rule.reason &&
          transaction.entityId === entityId &&
          (transaction.createdAt >= dayStart && transaction.createdAt < dayEnd)
        ) {
          return {
            allowed: false,
            reason: "Already credited today — XP rewards each action once per day.",
            capped: false,
            amount: 0,
          };
        }
      }
    }
  }

  if (rule.reason === "task_complete") {
    const creditedToday = countCredited(state, "task_complete", dayStart, dayEnd);
    if (creditedToday >= prefs.maxTasksCreditedPerDay) {
      return {
        allowed: false,
        reason: `Daily cap reached (${prefs.maxTasksCreditedPerDay} tasks). Resting is part of the system.`,
        capped: true,
        amount: 0,
      };
    }
    return { allowed: true, reason: "", capped: false, amount: rule.base };
  }

  if (rule.reason === "focus_session") {
    const creditedMinutes = creditedFocusMinutes(state, dayStart, dayEnd);
    const remaining = Math.max(0, prefs.dailyFocusCapMin - creditedMinutes);
    const amount = rule.base;
    if (creditedMinutes >= prefs.dailyFocusCapMin) {
      return {
        allowed: false,
        reason: `Focus cap reached (${prefs.dailyFocusCapMin} min). Wellbeing points to rest now.`,
        capped: true,
        amount: 0,
      };
    }
    return {
      allowed: true,
      reason: remaining < 60 ? `Almost at the focus cap — ${remaining} min credited left.` : "",
      capped: remaining < 60,
      amount,
    };
  }

  return { allowed: true, reason: "", capped: false, amount: rule.base };
}

function countCredited(state: AppState, reason: string, from: Timestamp, to: Timestamp): number {
  let count = 0;
  for (const transaction of Object.values(state.xpTransactions)) {
    if (
      transaction.status === "posted" &&
      transaction.reason === reason &&
      transaction.createdAt >= from &&
      transaction.createdAt < to
    ) {
      count += 1;
    }
  }
  return count;
}

function creditedFocusMinutes(state: AppState, from: Timestamp, to: Timestamp): number {
  let minutes = 0;
  for (const transaction of Object.values(state.xpTransactions)) {
    if (transaction.reason !== "focus_session" || transaction.status !== "posted") continue;
    if (transaction.createdAt < from || transaction.createdAt >= to) continue;
    minutes += transaction.amount;
  }
  return minutes;
}

function startOfLocalDay(now: Timestamp): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export interface AwardResult {
  transaction: XPTransaction;
  skill: SkillKind;
  skillLevel: number;
  coins: number;
  verdict: AwardVerdict;
  unlocked: Achievement | null;
  levelBefore: number;
  levelAfter: number;
}

export const WELLBEING_RULES = [
  "XP is earned once per action per day.",
  "Task credits stop at your daily cap.",
  "Focus credits stop at your focus cap.",
  "Coins are for rest, not pressure.",
  "Gamification can be switched off entirely.",
];
export interface AchievementProgress {
  achievement: Achievement;
  progress: number;
  target: number;
  complete: boolean;
}

export function achievementProgress(state: AppState, achievement: Achievement, now: Timestamp): AchievementProgress {
  const target = Math.max(1, achievement.threshold);
  let progress = 0;

  switch (achievement.category) {
    case "volume":
      progress = countReason(state, reasonForKey(achievement.key), now);
      break;
    case "streak":
      progress = bestSkillProgress(state);
      break;
    case "milestone":
      progress = Object.values(state.milestones).filter((milestone) => milestone.status === "completed").length;
      break;
    case "exploration":
      progress = Object.keys(state.projects).length;
      break;
  }

  progress = Math.min(target, Math.max(0, progress));
  return { achievement, progress, target, complete: progress >= target };
}

function reasonForKey(key: string): string {
  if (key.includes("habit")) return "habit_streak";
  if (key.includes("focus")) return "focus_session";
  if (key.includes("task")) return "task_complete";
  if (key.includes("milestone")) return "goal_milestone";
  return "task_complete";
}

function countReason(state: AppState, reason: string, now: Timestamp): number {
  const dayStart = startOfLocalDay(now);
  let count = 0;
  for (const transaction of Object.values(state.xpTransactions)) {
    if (transaction.reason === reason && transaction.status === "posted") {
      if (reason === "habit_streak") {
        if (transaction.createdAt >= dayStart - 30 * 86_400_000) count += 1;
      } else {
        count += 1;
      }
    }
  }
  return count;
}

function bestSkillProgress(state: AppState): number {
  let best = 0;
  for (const skill of Object.values(state.skills)) {
    if (skill.level > best) best = skill.level;
  }
  return best;
}

export function evaluateAchievements(
  state: AppState,
  now: Timestamp,
): AchievementProgress[] {
  return Object.values(state.achievements).map((achievement) =>
    achievementProgress(state, achievement, now),
  );
}

export function builtinAchievementSeeds(): Array<{ key: string; title: string; description: string; category: "streak" | "volume" | "milestone" | "exploration"; threshold: number; xpAward: number }> {
  return [
    { key: "first_task", title: "First step", description: "Complete your first task.", category: "volume", threshold: 1, xpAward: 5 },
    { key: "ten_tasks", title: "Ten down", description: "Complete ten tasks.", category: "volume", threshold: 10, xpAward: 15 },
    { key: "fifty_tasks", title: "Fifty down", description: "Complete fifty tasks.", category: "volume", threshold: 50, xpAward: 40 },
    { key: "habit_week", title: "Habit keeper", description: "Keep a habit alive for a week.", category: "streak", threshold: 2, xpAward: 20 },
    { key: "first_milestone", title: "Milestone reached", description: "Complete your first milestone.", category: "milestone", threshold: 1, xpAward: 25 },
    { key: "explorer", title: "Explorer", description: "Start three projects.", category: "exploration", threshold: 3, xpAward: 20 },
  ];
}

export function rewardSeeds(): Array<{ title: string; description: string; cost: number; icon: string | null }> {
  return [
    { title: "Coffee break", description: "Ten minutes away from the screen.", cost: 20, icon: "☕" },
    { title: "Episode", description: "One episode, guilt-free.", cost: 45, icon: "📺" },
    { title: "Walk outside", description: "Twenty minutes of fresh air.", cost: 60, icon: "🌤" },
    { title: "Long lunch", description: "A proper break, no inbox.", cost: 120, icon: "🍽" },
  ];
}

export function redeemReward(
  state: AppState,
  reward: Reward,
  now: Timestamp,
): { ok: boolean; message: string; entry: CoinLedgerEntry | null } {
  const prefs = state.settings.gamification;
  if (!prefs.enabled) {
    return { ok: false, message: "Gamification is switched off.", entry: null };
  }
  const profile = buildGamificationProfile(state);
  if (reward.status === "redeemed") {
    return { ok: false, message: "Already redeemed.", entry: null };
  }
  if (profile.coins < reward.cost) {
    return { ok: false, message: `Not enough coins — ${reward.cost - profile.coins} short.`, entry: null };
  }
  const entry = createCoinLedgerEntry({
    amount: -reward.cost,
    sink: "reward",
    reason: "reward_redeem",
    entityType: "reward",
    entityId: reward.id,
    note: reward.title,
  }, now);
  return { ok: true, message: `Redeemed "${reward.title}".`, entry };
}