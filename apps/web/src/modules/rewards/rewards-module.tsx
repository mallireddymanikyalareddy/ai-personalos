"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  Award,
  BookOpen,
  Check,
  Coins,
  Flame,
  Gift,
  HeartHandshake,
  Info,
  Layers,
  Lock,
  Medal,
  MoreHorizontal,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import { startOfDay, XP_RULES } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAppState, useOS } from "@/store/use-os";
import { useFocusNow } from "@/modules/focus/use-focus-now";

import { RewardDialog } from "./reward-dialog";
import { seedSampleRewards } from "./sample-rewards";
import { SkillsWheel } from "./skills-wheel";

const DAY = 86_400_000;

function startOfWeek(now: number, weekStart: 0 | 1 = 1): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const weekday = (date.getDay() - weekStart + 7) % 7;
  date.setDate(date.getDate() - weekday);
  return date.getTime();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value));
}

function relative(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function RewardsModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [showSettings, setShowSettings] = React.useState(false);
  const [rewardDialogOpen, setRewardDialogOpen] = React.useState(false);
  const [editingReward, setEditingReward] = React.useState<import("@personalos/core").Reward | null>(null);
  const [showAllBadges, setShowAllBadges] = React.useState(false);
  const [showAllRewards, setShowAllRewards] = React.useState(false);
  const [showAllLedger, setShowAllLedger] = React.useState(false);
  const [leaderPeriod, setLeaderPeriod] = React.useState<"This Month" | "This Week" | "All Time">("This Month");

  React.useEffect(() => {
    os.seedGamificationCatalog();
  }, [os]);

  const now = useFocusNow(60_000);
  const prefs = state.settings.gamification;
  const enabled = prefs.enabled;
  const profile = os.gamificationProfile();
  const achievements = os.evaluateGamificationAchievements(now);
  const rewards = os.availableRewards();
  const redeemed = os.redeemedRewards();
  const ledger = os.coinLedger();
  const coins = os.coinBalance();
  const weekStart = startOfWeek(now, state.settings.weekStart);

  const tasksRewarded = Object.values(state.xpTransactions).filter(
    (txn) => txn.reason === "task_complete" && txn.status === "posted",
  ).length;
  const goalsAchieved = Object.values(state.goals).filter(
    (goal) => goal.status === "completed",
  ).length;
  const habitStreak = Object.values(state.habits).reduce(
    (best, habit) => Math.max(best, os.habitStatsFor(habit.id, now)?.currentStreak ?? 0),
    0,
  );

  const focusThisWeek = Object.values(state.focusSessions).filter(
    (session) => session.status === "completed" && session.startedAt >= weekStart,
  ).length;
  const highPriorityDone = Object.values(state.tasks).filter(
    (task) =>
      task.status === "done" &&
      task.priority >= 3 &&
      task.completedAt != null &&
      task.completedAt >= weekStart,
  ).length;
  const planningDone = Object.values(state.tasks).filter(
    (task) =>
      task.status === "done" &&
      task.tags.some((tag) => tag.toLowerCase() === "planning") &&
      task.completedAt != null &&
      task.completedAt >= weekStart,
  ).length;

  const rollingStart = now - 7 * DAY;
  const focusLast7 = Object.values(state.focusSessions).filter(
    (session) => session.status === "completed" && session.startedAt >= rollingStart,
  ).length;
  const habitDaysLast7 = new Set(
    Object.values(state.habitCheckins)
      .filter((checkin) => checkin.checkedAt >= rollingStart)
      .map((checkin) => startOfDay(checkin.checkedAt)),
  ).size;
  const learningLast7 = Object.values(state.tasks).filter(
    (task) =>
      task.status === "done" &&
      task.tags.some((tag) => tag.toLowerCase() === "learning") &&
      task.completedAt != null &&
      task.completedAt >= rollingStart,
  ).length;

  const weeklyGoals = [
    { id: "focus", label: "Complete 5 focus sessions", points: 250, current: Math.min(5, focusThisWeek), target: 5 },
    { id: "streak", label: "Maintain 7-day habit streak", points: 300, current: Math.min(7, habitStreak), target: 7 },
    { id: "priority", label: "Finish 3 high-priority tasks", points: 200, current: Math.min(3, highPriorityDone), target: 3 },
    { id: "plan", label: "Plan next week", points: 150, current: Math.min(1, planningDone), target: 1 },
  ];
  const weeklyPct = Math.round(
    (weeklyGoals.filter((goal) => goal.current >= goal.target).length / weeklyGoals.length) * 100,
  );

  const claimedWeeklyKeys = new Set(
    ledger
      .filter((entry) => entry.entityType === "weekly_goal" && entry.entityId != null)
      .map((entry) => entry.entityId as string),
  );

  const claimWeekly = (goal: (typeof weeklyGoals)[number]) => {
    const result = os.grantRewardPoints({
      points: goal.points,
      note: `${goal.label} weekly reward`,
      entityType: "weekly_goal",
      entityId: `${goal.id}:${weekStart}`,
    });
    toast(result.message, { tone: result.ok ? "success" : "danger" });
  };

  const claimableWeekly = weeklyGoals.filter(
    (goal) =>
      goal.current >= goal.target &&
      !claimedWeeklyKeys.has(`${goal.id}:${weekStart}`),
  );

  const claimAllWeekly = () => {
    let claimed = 0;
    let total = 0;
    for (const goal of claimableWeekly) {
      const result = os.grantRewardPoints({
        points: goal.points,
        note: `${goal.label} weekly reward`,
        entityType: "weekly_goal",
        entityId: `${goal.id}:${weekStart}`,
      });
      if (result.ok) {
        claimed += 1;
        total += goal.points;
      }
    }
    toast(
      claimed > 0
        ? `Claimed ${claimed} weekly reward${claimed === 1 ? "" : "s"} - +${total} points`
        : "Nothing to claim yet",
      { tone: claimed > 0 ? "success" : "danger" },
    );
  };

  const challenges = [
    { id: "focus-master", label: "Focus Master", detail: "Finish 5 focus sessions in 7 days", current: Math.min(5, focusLast7), target: 5, points: 500, icon: Target, tone: "bg-danger-soft text-danger" },
    { id: "healthy-you", label: "Healthy You", detail: "Keep your habits for 5 days in 7", current: Math.min(5, habitDaysLast7), target: 5, points: 400, icon: Flame, tone: "bg-accent-soft text-accent-ink" },
    { id: "learning-streak", label: "Learning Sprint", detail: "Finish 3 learning tasks in 7 days", current: Math.min(3, learningLast7), target: 3, points: 300, icon: BookOpen, tone: "bg-success-soft text-success" },
  ];

  const claimedChallengeIds = new Set(
    ledger
      .filter((entry) => entry.entityType === "challenge" && entry.entityId != null)
      .map((entry) => entry.entityId as string),
  );

  const claimable = challenges.find(
    (challenge) => challenge.current >= challenge.target && !claimedChallengeIds.has(challenge.id),
  );
  const claimedCount = challenges.filter((challenge) => claimedChallengeIds.has(challenge.id)).length;

  const monthStart = (() => {
    const date = new Date(now);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  })();

  const leaderboard = React.useMemo(() => {
    const from =
      leaderPeriod === "This Week" ? weekStart : leaderPeriod === "This Month" ? monthStart : 0;
    const byReason = new Map<string, number>();
    for (const txn of Object.values(state.xpTransactions)) {
      if (txn.status !== "posted") continue;
      if (txn.createdAt < from) continue;
      byReason.set(txn.reason, (byReason.get(txn.reason) ?? 0) + txn.amount);
    }
    return [...byReason.entries()]
      .map(([reason, points]) => ({
        reason,
        label: XP_RULES.find((rule) => rule.reason === reason)?.label ?? reason,
        points,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  }, [state.xpTransactions, leaderPeriod, monthStart, weekStart]);

  const activities = XP_RULES.filter((rule) => rule.base > 0).map((rule) => ({
    id: rule.reason,
    label: rule.label,
    points: rule.base,
    skill: rule.skill,
    icon:
      rule.reason === "task_complete"
        ? Check
        : rule.reason === "habit_streak"
          ? Flame
          : rule.reason === "focus_session"
            ? Zap
            : rule.reason === "goal_milestone"
              ? Target
              : Medal,
    tone:
      rule.reason === "task_complete"
        ? "bg-success-soft text-success"
        : rule.reason === "habit_streak"
          ? "bg-warning-soft text-warning"
          : rule.reason === "focus_session"
            ? "bg-accent-soft text-accent-ink"
            : "bg-danger-soft text-danger",
  }));

  const loadDefaults = () => {
    const ids = seedSampleRewards(os, now);
    toast(
      ids.length > 0
        ? `Sample reward data loaded — ${ids.length} items added`
        : "Sample reward data is already loaded",
    );
  };

  if (!enabled) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Lock}
          title="Gamification is off"
          description="XP, levels, skills, coins, achievements, and the reward shop are switched off. Your work is tracked exactly the same either way."
          action={
            <Button
              variant="primary"
              onClick={() => {
                os.setGamificationEnabled(true);
                toast("Gamification turned on");
              }}
            >
              Turn on gamification
            </Button>
          }
        />
        <WellbeingPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        testId="rewards-header"
        icon={Medal}
        tone="bg-warning-soft text-warning"
        title="Rewards"
        subtitle="Stay consistent, build better habits, complete your goals and earn rewards."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings((value) => !value)}
              data-testid="rewards-settings"
            >
              {showSettings ? <Info className="size-4" aria-hidden="true" /> : <Settings className="size-4" aria-hidden="true" />}
              {showSettings ? "Hide how it works" : "How it Works"}
            </Button>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Rewards",
                  items: [
                    { label: "Load default data", onSelect: loadDefaults },
                    {
                      label: "Turn gamification off",
                      onSelect: () => {
                        os.setGamificationEnabled(false);
                        toast("Gamification turned off — nothing is tracked or nudged");
                      },
                    },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Rewards options">
                  <span aria-hidden="true">&#8942;</span>
                </Button>
              }
            />
          </>
        }
      />

      {showSettings ? (
        <section
          aria-label="How it works"
          data-testid="rewards-how-it-works"
          className="rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <h2 className="mb-2 text-sm font-semibold text-ink">How it works</h2>
          <ul className="grid gap-1.5 text-[12px] leading-snug text-ink-3 sm:grid-cols-2">
            {XP_RULES.filter((rule) => rule.base > 0).map((rule) => (
              <li key={rule.reason}>
                <span className="font-medium text-ink-2">{rule.label}</span> — {rule.wellnessNote}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div
            className={cn(
              "grid gap-3",
              prefs.showStreaks
                ? "lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]"
                : "lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]",
            )}
          >
            <div
              data-testid="rewards-level-card"
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-chart-1 to-chart-7 p-5 text-white shadow-card"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Your Current Level
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">Level {profile.level}</p>
              <p className="text-sm text-white/85">{profile.title}</p>
              <span
                className="mt-4 block h-2.5 overflow-hidden rounded-full bg-white/25"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-chart-3"
                  style={{
                    width: `${profile.xpForLevel > 0 ? Math.min(100, Math.round((profile.xpIntoLevel / profile.xpForLevel) * 100)) : 0}%`,
                  }}
                />
              </span>
              <p className="mt-1.5 text-[11px] text-white/80">
                {formatNumber(profile.xpIntoLevel)} / {formatNumber(profile.xpForLevel)} XP ·{" "}
                {formatNumber(profile.nextLevelAt)} XP to Level {profile.level + 1}
              </p>
            </div>

            <RewardTile
              id="points"
              icon={Coins}
              tone="bg-warning-soft text-warning"
              value={formatNumber(coins)}
              label="Reward Points"
            />
            {prefs.showStreaks ? (
              <RewardTile
                id="streak"
                icon={Flame}
                tone="bg-info-soft text-info"
                value={`${habitStreak} Days`}
                label="Current Streak"
              />
            ) : null}
            <RewardTile
              id="tasks"
              icon={Layers}
              tone="bg-success-soft text-success"
              value={formatNumber(tasksRewarded)}
              label="Tasks Rewarded"
            />
            <RewardTile
              id="goals"
              icon={Target}
              tone="bg-danger-soft text-danger"
              value={formatNumber(goalsAchieved)}
              label="Goals Achieved"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section
              aria-label="This Week's Progress"
              data-testid="rewards-week-progress"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <TrendingUp className="size-4 text-accent-ink" aria-hidden="true" />
                  This Week&apos;s Progress
                </h2>
                <div className="flex items-center gap-2">
                  {claimableWeekly.length > 0 ? (
                    <button
                      type="button"
                      data-testid="rewards-week-claim-all"
                      onClick={claimAllWeekly}
                      className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink hover:bg-accent hover:text-white"
                    >
                      Claim all
                    </button>
                  ) : null}
                  <span className="text-[11px] font-semibold text-ink-3">{weeklyPct}% Complete</span>
                </div>
              </header>
              <span className="mb-3 block h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <span className="block h-full rounded-full bg-chart-5" style={{ width: `${weeklyPct}%` }} />
              </span>
              <ul className="space-y-2">
                {weeklyGoals.map((goal) => {
                  const done = goal.current >= goal.target;
                  const claimed = claimedWeeklyKeys.has(`${goal.id}:${weekStart}`);
                  return (
                    <li key={goal.id} className="flex items-center gap-2.5" data-testid="rewards-week-goal">
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-full border",
                          done ? "border-success bg-success text-white" : "border-line-strong",
                        )}
                        aria-hidden="true"
                      >
                        {done ? <Check className="size-2.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{goal.label}</span>
                      {done ? (
                        claimed ? (
                          <Badge tone="success" className="shrink-0">Claimed</Badge>
                        ) : (
                          <button
                            type="button"
                            data-testid="rewards-week-claim"
                            onClick={() => claimWeekly(goal)}
                            className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink hover:bg-accent hover:text-white"
                          >
                            Claim +{goal.points}
                          </button>
                        )
                      ) : (
                        <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
                          +{goal.points} pts
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              aria-label="Active Challenges"
              data-testid="rewards-challenges"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Target className="size-4 text-accent-ink" aria-hidden="true" />
                  Active Challenges
                </h2>
              </header>
              <ul className="space-y-2.5">
                {challenges.map((challenge) => {
                  const Icon = challenge.icon;
                  const pct = Math.round((challenge.current / challenge.target) * 100);
                  const claimed = claimedChallengeIds.has(challenge.id);
                  return (
                    <li key={challenge.id} data-testid="rewards-challenge" className="flex items-start gap-2.5">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${challenge.tone}`} aria-hidden="true">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-ink">{challenge.label}</span>
                        <span className="block truncate text-[11px] text-ink-3">{challenge.detail}</span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                            <span
                              className="block h-full rounded-full bg-chart-5"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
                            {challenge.current} / {challenge.target}
                          </span>
                        </span>
                      </span>
                      {claimed ? (
                        <Badge tone="success" className="shrink-0">Claimed</Badge>
                      ) : (
                        <Badge tone="warning" className="shrink-0">
                          +{challenge.points} pts
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              aria-label="Earned reward"
              data-testid="rewards-earned"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-gradient-to-br from-danger-soft via-surface to-warning-soft p-5 text-center shadow-card"
            >
              <Gift className="size-9 text-danger" aria-hidden="true" />
              <h2 className="text-base font-bold tracking-tight text-ink">You Earned a Reward!</h2>
              <p className="text-[12px] text-ink-2">
                {claimable != null
                  ? `Completed ${claimable.label.toLowerCase()}`
                  : claimedCount > 0
                    ? `All ${claimedCount} finished challenges claimed. Nice work.`
                    : "Complete a challenge to unlock a reward."}
              </p>
              <Button
                variant="primary"
                className="mt-1 w-full"
                disabled={claimable == null}
                data-testid="rewards-claim"
                onClick={() => {
                  if (claimable == null) return;
                  const result = os.grantRewardPoints({
                    points: claimable.points,
                    note: `${claimable.label} reward`,
                    entityType: "challenge",
                    entityId: claimable.id,
                  });
                  toast(result.message, { tone: result.ok ? "success" : "danger" });
                }}
              >
                {claimable != null ? `Claim ${claimable.points} Points` : "Keep going"}
              </Button>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section
              aria-label="Your Badges"
              data-testid="rewards-badges"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Award className="size-4 text-accent-ink" aria-hidden="true" />
                  Your Badges ({achievements.filter((entry) => entry.achievement.status === "unlocked").length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAllBadges((value) => !value)}
                  className="text-[11px] font-medium text-accent-ink hover:underline"
                >
                  {showAllBadges ? "Show less" : "Show all"}
                </button>
              </header>
              {achievements.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-ink-3">No badges yet.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2">
                  {(showAllBadges ? achievements : achievements.slice(0, 6)).map((entry) => (
                    <li
                      key={entry.achievement.id}
                      data-testid="rewards-badge"
                      title={`${entry.achievement.description} (${entry.achievement.progress}/${entry.achievement.threshold})`}
                      className="flex flex-col items-center gap-1 rounded-xl border border-line p-2 text-center"
                    >
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-xl text-lg",
                          entry.achievement.status === "unlocked"
                            ? "bg-success-soft"
                            : "bg-surface-2 opacity-60",
                        )}
                        aria-hidden="true"
                      >
                        {entry.achievement.icon ?? "🏅"}
                      </span>
                      <span className="w-full truncate text-[11px] font-medium text-ink-2">
                        {entry.achievement.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-label="Rewards Store"
              data-testid="rewards-store"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Gift className="size-4 text-accent-ink" aria-hidden="true" />
                  Rewards Store
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReward(null);
                      setRewardDialogOpen(true);
                    }}
                    data-testid="rewards-add"
                    className="text-[11px] font-medium text-accent-ink hover:underline"
                  >
                    Add reward
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllRewards((value) => !value)}
                    className="text-[11px] font-medium text-accent-ink hover:underline"
                  >
                    {showAllRewards ? "Show less" : "Show all"}
                  </button>
                </div>
              </header>
              {rewards.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-ink-3">
                  Every reward has been redeemed. Time to actually take the break.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {(showAllRewards ? rewards : rewards.slice(0, 6)).map((reward) => {
                    const affordable = coins >= reward.cost;
                    return (
                      <li
                        key={reward.id}
                        data-testid="rewards-store-item"
                        className="relative flex flex-col gap-1 rounded-xl border border-line p-2.5"
                      >
                        <span className="text-lg" aria-hidden="true">
                          {reward.icon ?? "🎁"}
                        </span>
                        <span className="truncate text-[11px] font-medium text-ink">{reward.title}</span>
                        {reward.description ? (
                          <span className="truncate text-[10px] text-ink-3">{reward.description}</span>
                        ) : null}
                        <span className="mt-auto flex items-center justify-between gap-1 pt-1">
                          <span className="text-[11px] font-semibold tabular-nums text-ink">
                            {formatNumber(reward.cost)} pts
                          </span>
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => {
                              const result = os.redeemReward(reward.id, now);
                              toast(result.message, { tone: result.ok ? "success" : "danger" });
                            }}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                              affordable
                                ? "bg-accent-soft text-accent-ink hover:bg-accent hover:text-white"
                                : "cursor-not-allowed bg-surface-2 text-ink-3",
                            )}
                          >
                            Redeem
                          </button>
                        </span>
                        {!reward.builtin ? (
                          <DropdownMenu
                            align="end"
                            sections={[
                              {
                                label: reward.title,
                                items: [
                                  {
                                    label: "Edit reward",
                                    onSelect: () => {
                                      setEditingReward(reward);
                                      setRewardDialogOpen(true);
                                    },
                                  },
                                  {
                                    label: "Delete reward",
                                    danger: true,
                                    onSelect: () => {
                                      if (!window.confirm(`Delete "${reward.title}"?`)) return;
                                      os.deleteReward(reward.id);
                                      toast("Reward deleted", { tone: "success" });
                                    },
                                  },
                                ],
                              },
                            ]}
                            trigger={
                              <button
                                type="button"
                                aria-label={`${reward.title} options`}
                                className="absolute right-1 top-1 grid size-5 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
                              >
                                <MoreHorizontal className="size-3" aria-hidden="true" />
                              </button>
                            }
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {redeemed.length > 0 ? (
                <div className="mt-3 border-t border-line pt-2">
                  <p className="mb-1 text-[11px] font-medium text-ink-3">
                    Redeemed ({redeemed.length})
                  </p>
                  <ul className="space-y-1">
                    {(showAllRewards ? redeemed : redeemed.slice(0, 3)).map((reward) => (
                      <li
                        key={reward.id}
                        className="flex items-center justify-between gap-2 text-[11px] text-ink-2"
                      >
                        <span className="min-w-0 flex-1 truncate">{reward.title}</span>
                        <span className="shrink-0 text-ink-3">
                          {relative(reward.redeemedAt ?? reward.updatedAt, now)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {prefs.showLeaderboard ? (
            <section
              aria-label="Leaderboard"
              data-testid="rewards-leaderboard"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <TrendingUp className="size-4 text-accent-ink" aria-hidden="true" />
                  Leaderboard
                </h2>
                <DropdownMenu
                  align="end"
                  sections={[
                    {
                      label: "Period",
                      items: (["This Week", "This Month", "All Time"] as const).map((option) => ({
                        label: option,
                        selected: leaderPeriod === option,
                        onSelect: () => setLeaderPeriod(option),
                      })),
                    },
                  ]}
                  trigger={
                    <button
                      type="button"
                      className="rounded-lg border border-line px-2 py-0.5 text-[11px] text-ink-2"
                      aria-label="Leaderboard period"
                    >
                      {leaderPeriod}
                    </button>
                  }
                />
              </header>
              <p className="mb-2 text-[11px] text-ink-3">Top earning activities</p>
              {leaderboard.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-ink-3">
                  No points earned in this period yet.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {leaderboard.map((entry, index) => (
                    <li
                      key={entry.reason}
                      data-testid="rewards-leaderboard-row"
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5",
                        index === 0 ? "bg-warning-soft" : "bg-surface-2/60",
                      )}
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface text-[10px] font-bold text-ink-3">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{entry.label}</span>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink">
                        {formatNumber(entry.points)} pts
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section
              aria-label="Reward Earning Activities"
              data-testid="rewards-activities"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center gap-1.5">
                <Layers className="size-4 text-accent-ink" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">Reward Earning Activities</h2>
              </header>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {activities.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <li
                      key={activity.id}
                      data-testid="rewards-activity"
                      className="flex flex-col items-center gap-1 rounded-xl border border-line p-2.5 text-center"
                    >
                      <span className={`grid size-8 place-items-center rounded-lg ${activity.tone}`} aria-hidden="true">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-[11px] font-medium text-ink-2">{activity.label}</span>
                      <span className="text-[11px] font-semibold text-success">+{activity.points} XP</span>
                      <span className="text-[10px] capitalize text-ink-3">{activity.skill}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              aria-label="Recent Reward Activity"
              data-testid="rewards-recent"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <ClockIcon />
                  Recent Reward Activity
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAllLedger((value) => !value)}
                  className="text-[11px] font-medium text-accent-ink hover:underline"
                >
                  {showAllLedger ? "Show less" : "Show all"}
                </button>
              </header>
              {ledger.length === 0 ? (
                <p className="text-[12px] text-ink-3">Nothing yet — points arrive as you work.</p>
              ) : (
                <ul className="space-y-2">
                  {(showAllLedger ? ledger : ledger.slice(0, 4)).map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2" data-testid="rewards-recent-row">
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink" aria-hidden="true">
                        <Coins className="size-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                        {entry.note || entry.reason}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-semibold tabular-nums",
                          entry.amount >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount}
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-3">{relative(entry.createdAt, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Reward details">
          <section
            aria-label="Your Skills"
            data-testid="rewards-skills"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center gap-1.5">
              <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Your Skills</h2>
            </header>
            <SkillsWheel skills={profile.skills} level={profile.level} title={profile.title} />
          </section>

          <section
            aria-label="Rewards summary"
            data-testid="rewards-summary"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <h2 className="mb-2 text-sm font-semibold text-ink">Summary</h2>
            <ul className="space-y-1.5 text-[12px]">
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-3">Total XP</span>
                <span className="font-semibold tabular-nums text-ink">{formatNumber(os.gamificationXpTotal())}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-3">Points balance</span>
                <span className="font-semibold tabular-nums text-ink">{formatNumber(coins)}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-3">Badges unlocked</span>
                <span className="font-semibold tabular-nums text-ink">
                  {achievements.filter((entry) => entry.achievement.status === "unlocked").length}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-3">Rewards redeemed</span>
                <span className="font-semibold tabular-nums text-ink">{redeemed.length}</span>
              </li>
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={loadDefaults}
              data-testid="rewards-load-defaults"
            >
              Load default data
            </Button>
          </section>

          <WellbeingPanel />
        </aside>
      </div>

      <RewardDialog
        open={rewardDialogOpen}
        reward={editingReward}
        onClose={() => {
          setRewardDialogOpen(false);
          setEditingReward(null);
        }}
      />
    </div>
  );
}

function ClockIcon() {
  return (
    <span className="text-accent-ink" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function RewardTile({
  id,
  icon: Icon,
  tone,
  value,
  label,
}: {
  id: string;
  icon: LucideIcon;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div
      data-testid={`rewards-tile-${id}`}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface p-4 text-center shadow-card"
    >
      <span className={`grid size-9 place-items-center rounded-xl ${tone}`} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <span className="text-xl font-bold tabular-nums text-ink">{value}</span>
      <span className="text-[11px] text-ink-3">{label}</span>
    </div>
  );
}

function WellbeingPanel() {
  const os = useOS();
  const prefs = os.getState().settings.gamification;
  const update = (patch: Partial<typeof prefs>) => os.updateGamificationPreferences(patch);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" data-testid="rewards-wellbeing">
      <div className="mb-3 flex items-center gap-2">
        <HeartHandshake className="size-4 text-accent" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Wellbeing guardrails</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-ink">Show streaks</div>
            <p className="text-xs text-ink-3">Streaks reward consistency, never perfection.</p>
          </div>
          <Switch
            checked={prefs.showStreaks}
            onCheckedChange={(value) => update({ showStreaks: value })}
            label="Show streaks"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-ink">Show leaderboard</div>
            <p className="text-xs text-ink-3">Keep your top-earning activities visible on this page.</p>
          </div>
          <Switch
            checked={prefs.showLeaderboard}
            onCheckedChange={(value) => update({ showLeaderboard: value })}
            label="Show leaderboard"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-ink">Gentle reminders</div>
            <p className="text-xs text-ink-3">A quiet nudge — never a badge or a red dot.</p>
          </div>
          <Switch
            checked={prefs.gentleReminders}
            onCheckedChange={(value) => update({ gentleReminders: value })}
            label="Gentle reminders"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-ink">Daily focus cap</div>
            <p className="text-xs text-ink-3">Focus XP stops here so rest stays possible.</p>
          </div>
          <input
            type="number"
            min={30}
            max={600}
            step={15}
            value={prefs.dailyFocusCapMin}
            onChange={(event) =>
              update({
                dailyFocusCapMin: Math.min(600, Math.max(30, Number(event.target.value) || 30)),
              })
            }
            aria-label="Daily focus cap"
            className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-sm tabular-nums"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-ink">Daily task cap</div>
            <p className="text-xs text-ink-3">Task XP stops here too — there is always tomorrow.</p>
          </div>
          <input
            type="number"
            min={1}
            max={50}
            value={prefs.maxTasksCreditedPerDay}
            onChange={(event) =>
              update({
                maxTasksCreditedPerDay: Math.min(50, Math.max(1, Number(event.target.value) || 1)),
              })
            }
            aria-label="Daily task cap"
            className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-sm tabular-nums"
          />
        </div>
      </div>
    </section>
  );
}
