import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  buildGamificationProfile,
  canAward,
  evaluateAchievements,
  builtinAchievementSeeds,
  rewardSeeds,
  skillLevelFromXp,
} from "./engine";
import { levelForXp, xpForLevel, xpToNextLevel } from "../../types/gamification";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  os.seedGamificationCatalog();
  return os;
}

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();
const DAY = 86_400_000;

describe("Gamification: levels", () => {
  it("levels up at a steady floor and step", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(59)).toBe(1);
    expect(levelForXp(60)).toBe(2);
    expect(levelForXp(60 + 35)).toBe(3);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(60);

    const next = xpToNextLevel(60);
    expect(next.level).toBe(2);
    expect(next.needed).toBe(35);
  });

  it("maps skill xp onto skill levels", () => {
    expect(skillLevelFromXp(0)).toBe(1);
    expect(skillLevelFromXp(60)).toBe(2);
  });
});

describe("Gamification: awarding XP", () => {
  it("credits task completion once per action", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Write docs" });

    const award = os.awardXP({ reason: "task_complete", entityType: "task", entityId: task.id });
    expect(award.ok).toBe(true);
    expect(award.amount).toBe(10);
    expect(award.skill).toBe("execution");
    expect(award.coins).toBeGreaterThan(0);
    expect(os.gamificationXpTotal()).toBe(10);
    expect(os.coinBalance()).toBeGreaterThan(0);
  });

  it("never double-credits the same task on the same day", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Write docs" });
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: task.id });

    const second = os.awardXP({ reason: "task_complete", entityType: "task", entityId: task.id });
    expect(second.ok).toBe(false);
    expect(second.message).toMatch(/already credited/i);
    expect(os.gamificationXpTotal()).toBe(10);
  });

  it("stops task credits at the daily cap", () => {
    const os = makeOS();
    os.updateGamificationPreferences({ maxTasksCreditedPerDay: 2 });

    for (let index = 0; index < 3; index += 1) {
      os.awardXP({ reason: "task_complete", entityType: "task", entityId: `t-${index}`, note: `Task ${index}` });
    }

    const last = os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t-3", note: "Task 3" });
    expect(last.ok).toBe(false);
    expect(last.capped).toBe(true);
    expect(last.message).toMatch(/Daily cap/i);
  });

  it("stops focus credits at the daily focus cap", () => {
    const os = makeOS();
    os.updateGamificationPreferences({ dailyFocusCapMin: 30 });

    const first = os.awardXP({ reason: "focus_session", entityType: "focus_session", entityId: "f1", minutes: 15 });
    const second = os.awardXP({ reason: "focus_session", entityType: "focus_session", entityId: "f2", minutes: 15 });
    const third = os.awardXP({ reason: "focus_session", entityType: "focus_session", entityId: "f3", minutes: 15 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.message).toMatch(/Focus cap/i);
  });

  it("credits habits, milestones and goals", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Stretch" });
    os.completeHabit(habit.id, NOW, NOW);
    expect(os.gamificationXpTotal()).toBeGreaterThan(0);

    const os2 = makeOS();
    const project = os2.addProject({ name: "Ship" });
    const milestone = os2.addMilestone({ projectId: project.id, title: "Beta" });
    os2.completeMilestone(milestone.id);
    expect(os2.gamificationXpTotal()).toBe(25);
  });
});

describe("Gamification: the off switch", () => {
  it("awards nothing once gamification is disabled", () => {
    const os = makeOS();
    os.setGamificationEnabled(false);

    const verdict = canAward(os.getState(), "task_complete", "t1", NOW);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/switched off/i);

    const award = os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t1" });
    expect(award.ok).toBe(false);
    expect(os.gamificationXpTotal()).toBe(0);
    expect(os.coinBalance()).toBe(0);
  });

  it("still tracks real work when disabled", () => {
    const os = makeOS();
    os.setGamificationEnabled(false);
    const task = os.addTask({ title: "Write docs" });
    os.completeTask(task.id);

    expect(os.getTask(task.id)?.status).toBe("done");
    expect(os.gamificationXpTotal()).toBe(0);
  });

  it("re-enables without losing history", () => {
    const os = makeOS();
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t1", note: "First" });
    os.setGamificationEnabled(false);
    os.setGamificationEnabled(true);

    expect(os.gamificationXpTotal()).toBe(10);
    expect(os.gamificationEnabled()).toBe(true);
  });
});

describe("Gamification: coins and the reward shop", () => {
  it("only lets a reward be redeemed when coins cover it", () => {
    const os = makeOS();
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t1", note: "First" });

    const profile = os.gamificationProfile();
    expect(profile.coins).toBeGreaterThan(0);

    const rewards = os.availableRewards();
    const affordable = rewards.find((reward) => reward.cost <= profile.coins);
    if (affordable) {
      const result = os.redeemReward(affordable.id);
      expect(result.ok).toBe(true);
      expect(os.availableRewards().some((reward) => reward.id === affordable.id)).toBe(false);
    } else {
      const pricey = rewards[rewards.length - 1]!;
      expect(os.redeemReward(pricey.id).ok).toBe(false);
    }
  });

  it("refuses a reward the user cannot afford", () => {
    const os = makeOS();
    const pricey = os.availableRewards().reduce((max, reward) => (reward.cost > max.cost ? reward : max));
    expect(os.redeemReward(pricey.id).ok).toBe(false);
  });

  it("seeds a built-in catalog exactly once", () => {
    const os = makeOS();
    os.seedGamificationCatalog();
    const count = Object.keys(os.getState().achievements).length;
    os.seedGamificationCatalog();
    expect(Object.keys(os.getState().achievements)).toHaveLength(count);
    expect(os.skills().length + Object.values(builtinAchievementSeeds()).length).toBeGreaterThan(0);
    expect(Object.values(os.getState().rewards).length).toBe(rewardSeeds().length);
  });
});

describe("Gamification: skills and achievements", () => {
  it("tracks each skill level from its own xp", () => {
    const os = makeOS();
    os.updateGamificationPreferences({ maxTasksCreditedPerDay: 20 });
    for (let index = 0; index < 12; index += 1) {
      os.awardXP({ reason: "task_complete", entityType: "task", entityId: `skill-${index}`, note: `Task ${index}` });
    }

    const profile = os.gamificationProfile();
    expect(profile.xpTotal).toBeGreaterThan(0);
    expect(profile.level).toBe(levelForXp(profile.xpTotal));
    for (const skill of os.skills()) {
      expect(skill.level).toBe(skillLevelFromXp(skill.xp));
    }
  });

  it("reports achievement progress without unlocking it early", () => {
    const os = makeOS();
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t1", note: "First" });
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t2", note: "Second" });

    const progress = evaluateAchievements(os.getState(), NOW);
    const firstTask = progress.find((entry) => entry.achievement.key === "first_task");
    const tenTasks = progress.find((entry) => entry.achievement.key === "ten_tasks");

    expect(firstTask?.achievement.status).toBe("unlocked");
    expect(tenTasks?.complete).toBe(false);
    expect(tenTasks!.progress).toBeLessThan(tenTasks!.target);
  });

  it("unlocks an achievement once its threshold is met", () => {
    const os = makeOS();
    os.updateGamificationPreferences({ maxTasksCreditedPerDay: 50 });
    for (let index = 0; index < 50; index += 1) {
      os.awardXP({ reason: "task_complete", entityType: "task", entityId: `unlock-${index}`, note: `Task ${index}` });
    }

    const achievements = Object.values(os.getState().achievements);
    const ten = achievements.find((achievement) => achievement.key === "ten_tasks")!;
    const fifty = achievements.find((achievement) => achievement.key === "fifty_tasks")!;

    expect(ten.status).toBe("unlocked");
    expect(ten.unlockedAt).not.toBeNull();
    expect(fifty.status).toBe("unlocked");
  });

  it("keeps the profile consistent with the ledger", () => {
    const os = makeOS();
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t1", note: "First" });
    const profile = os.gamificationProfile();

    expect(profile.xpTotal).toBe(os.gamificationXpTotal());
    expect(profile.coins).toBe(os.coinBalance());
    expect(Object.values(profile.skills).every((skill) => skill.xp >= 0)).toBe(true);
  });
});

describe("Gamification: wellbeing guardrails", () => {
  it("exposes caps that protect rest", () => {
    const os = makeOS();
    os.updateGamificationPreferences({ dailyFocusCapMin: 120, maxTasksCreditedPerDay: 8 });

    const prefs = os.getState().settings.gamification;
    expect(prefs.dailyFocusCapMin).toBe(120);
    expect(prefs.maxTasksCreditedPerDay).toBe(8);
    expect(prefs.enabled).toBe(true);
  });

  it("warns when the focus cap is nearly reached", () => {
    const os = makeOS();
    os.updateGamificationPreferences({ dailyFocusCapMin: 40 });
    os.awardXP({ reason: "focus_session", entityType: "focus_session", entityId: "f1", minutes: 15 });

    const second = os.awardXP({ reason: "focus_session", entityType: "focus_session", entityId: "f2", minutes: 20 });
    expect(second.ok).toBe(true);
    expect(second.capped).toBe(true);
  });

  it("builds a profile from an empty ledger without crashing", () => {
    const os = makeOS();
    os.clearAll();
    os.seedGamificationCatalog();
    const profile = buildGamificationProfile(os.getState());
    expect(profile.xpTotal).toBe(0);
    expect(profile.level).toBe(1);
    expect(profile.coins).toBe(0);
  });
});

describe("Gamification: rewards store", () => {
  it("adds a reward to the shop", () => {
    const os = makeOS();
    const before = os.availableRewards().length;

    const reward = os.addReward(
      { title: "₹500 Amazon Card", description: "A treat", cost: 120, icon: "🛒" },
      NOW,
    );

    expect(reward.status).toBe("available");
    expect(reward.cost).toBe(120);
    expect(os.availableRewards().length).toBe(before + 1);
    expect(os.availableRewards().some((entry) => entry.id === reward.id)).toBe(true);
  });

  it("keeps a reward that costs more than the balance un-redeemable", () => {
    const os = makeOS();
    const reward = os.addReward({ title: "Long weekend", description: "", cost: 5000 }, NOW);

    const result = os.redeemReward(reward.id, NOW);

    expect(result.ok).toBe(false);
    expect(os.redeemedRewards().length).toBe(0);
  });
});

describe("Gamification: claiming points", () => {
  it("credits the coin balance and records the claim", () => {
    const os = makeOS();
    const before = os.coinBalance();

    const result = os.grantRewardPoints({ points: 500, note: "Focus Master reward" }, NOW);

    expect(result.ok).toBe(true);
    expect(result.coins).toBe(500);
    expect(os.coinBalance()).toBe(before + 500);

    const entry = os.coinLedger()[0]!;
    expect(entry.amount).toBe(500);
    expect(entry.sink).toBe("gift");
    expect(entry.note).toBe("Focus Master reward");
  });

  it("refuses to claim when gamification is off or nothing is owed", () => {
    const os = makeOS();

    const empty = os.grantRewardPoints({ points: 0, note: "Nothing" }, NOW);
    expect(empty.ok).toBe(false);

    os.setGamificationEnabled(false);
    const off = os.grantRewardPoints({ points: 100, note: "Blocked" }, NOW);
    expect(off.ok).toBe(false);
    expect(os.coinBalance()).toBe(0);
  });
});

describe("Gamification: reward management", () => {
  it("marks seeded rewards as builtin and allows editing custom rewards", () => {
    const os = makeOS();
    const seeded = os.availableRewards().find((reward) => reward.title === "Coffee break")!;
    expect(seeded.builtin).toBe(true);

    const custom = os.addReward({ title: "Custom reward", cost: 10 }, NOW);
    expect(custom.builtin).toBe(false);

    os.updateReward(custom.id, { cost: 25, title: "Updated reward" });
    expect(os.getState().rewards[custom.id]?.cost).toBe(25);
    expect(os.getState().rewards[custom.id]?.title).toBe("Updated reward");

    os.deleteReward(custom.id);
    expect(os.getState().rewards[custom.id]).toBeUndefined();
  });
});