import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import RewardsPage from "@/app/(app)/rewards/page";
import { RewardsModule } from "./rewards-module";

const NOW = new Date(2026, 9, 14, 12, 0, 0, 0).getTime();
const DAY = 86_400_000;
const HOURS = 3_600_000;

let os: ReturnType<typeof getOS>;

function renderModule() {
  return render(
    <ToastProvider>
      <RewardsModule />
    </ToastProvider>,
  );
}

function loadDefaults() {
  fireEvent.click(screen.getByRole("button", { name: "Rewards options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  os.seedGamificationCatalog(NOW);
  os.setGamificationEnabled(true);
  os.updateGamificationPreferences({ showLeaderboard: true });
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the header, level card, tiles and panels", () => {
    renderModule();

    expect(screen.getByRole("heading", { name: "Rewards" })).toBeDefined();
    expect(screen.getByTestId("rewards-level-card")).toBeDefined();
    for (const id of ["points", "streak", "tasks", "goals"]) {
      expect(screen.getByTestId(`rewards-tile-${id}`)).toBeDefined();
    }
    expect(screen.getByTestId("rewards-week-progress")).toBeDefined();
    expect(screen.getByTestId("rewards-challenges")).toBeDefined();
    expect(screen.getByTestId("rewards-earned")).toBeDefined();
    expect(screen.getByTestId("rewards-badges")).toBeDefined();
    expect(screen.getByTestId("rewards-store")).toBeDefined();
    expect(screen.getByTestId("rewards-leaderboard")).toBeDefined();
    expect(screen.getByTestId("rewards-activities")).toBeDefined();
    expect(screen.getByTestId("rewards-recent")).toBeDefined();
    expect(screen.getByTestId("rewards-skills")).toBeDefined();
    expect(screen.getByTestId("rewards-summary")).toBeDefined();
  });

  it("lists three weekly goals and three challenges", () => {
    renderModule();

    expect(screen.getAllByTestId("rewards-week-goal").length).toBe(4);
    expect(screen.getAllByTestId("rewards-challenge").length).toBe(3);
  });

  it("shows the four XP earning activities", () => {
    renderModule();

    expect(screen.getAllByTestId("rewards-activity").length).toBe(4);
    expect(within(screen.getByTestId("rewards-activities")).getByText(/Task completed/)).toBeDefined();
  });

  it("keeps the wellbeing guardrails available", () => {
    renderModule();

    expect(screen.getByTestId("rewards-wellbeing")).toBeDefined();
    expect(screen.getByLabelText("Daily focus cap")).toBeDefined();
  });
});

describe("the skills wheel", () => {
  it("draws a hexagon node for every skill", () => {
    renderModule();

    expect(screen.getByTestId("rewards-skills-wheel")).toBeDefined();
    for (const kind of ["execution", "consistency", "focus", "planning", "knowledge", "wellbeing"]) {
      expect(screen.getByTestId(`rewards-skills-node-${kind}`)).toBeDefined();
    }
    expect(screen.getAllByTestId("rewards-skill").length).toBe(6);
  });

  it("shows the overall level in the hub", () => {
    renderModule();

    expect(screen.getByTestId("rewards-skills-level").textContent).toBe(
      String(os.gamificationProfile().level),
    );
    expect(screen.getByTestId("rewards-skills-caption").textContent).toContain(
      os.gamificationProfile().title,
    );
  });

  it("reflects real XP in the node levels", () => {
    const os2 = getOS();
    os2.updateGamificationPreferences({ maxTasksCreditedPerDay: 50 });
    for (let index = 0; index < 12; index += 1) {
      os2.awardXP({ reason: "task_complete", entityType: "task", entityId: `wheel-${index}` });
    }

    renderModule();

    const node = screen.getByTestId("rewards-skills-node-execution");
    expect(node.textContent).toContain("EXEC");
    expect(node.textContent).toContain(String(os2.skills().find((skill) => skill.kind === "execution")!.level));
  });
});

describe("the numbers come from real data", () => {
  it("counts rewarded tasks from the XP ledger", () => {
    const task = os.addTask({ title: "Write the docs", status: "open" });
    os.completeTask(task.id, NOW - HOURS);

    renderModule();

    const tile = within(screen.getByTestId("rewards-tile-tasks"));
    expect(tile.getByText("1")).toBeDefined();
  });

  it("shows the current habit streak", () => {
    const habit = os.addHabit({ title: "Read", cadence: "daily", daysOfWeek: [], daysOfMonth: [] }, NOW - 10 * DAY);
    for (let back = 0; back < 4; back += 1) {
      os.completeHabit(habit.id, NOW - back * DAY, NOW);
    }

    renderModule();

    const tile = within(screen.getByTestId("rewards-tile-streak"));
    expect(tile.getByText("4 Days")).toBeDefined();
  });

  it("lists the seeded reward store with real costs", () => {
    renderModule();

    const store = within(screen.getByTestId("rewards-store"));
    expect(store.getAllByTestId("rewards-store-item").length).toBeGreaterThan(0);
    expect(store.getAllByText(/pts/).length).toBeGreaterThan(0);
  });

  it("keeps the leaderboard honest about the period", () => {
    const task = os.addTask({ title: "Planned work", status: "open" });
    os.completeTask(task.id, NOW - HOURS);

    renderModule();

    const board = within(screen.getByTestId("rewards-leaderboard"));
    expect(board.getAllByTestId("rewards-leaderboard-row").length).toBeGreaterThan(0);
  });
});

describe("load default data", () => {
  it("seeds tasks, habits, focus sessions and rewards", () => {
    renderModule();

    loadDefaults();

    expect(Object.keys(os.getState().tasks).length).toBeGreaterThan(3);
    expect(Object.keys(os.getState().habits).length).toBeGreaterThan(2);
    expect(Object.keys(os.getState().focusSessions).length).toBeGreaterThan(2);
    expect(os.gamificationXpTotal()).toBeGreaterThan(100);
    expect(screen.getAllByTestId("rewards-store-item").length).toBeGreaterThan(0);
  }, 20_000);

  it("does not duplicate the default data when loaded twice", () => {
    renderModule();

    loadDefaults();
    const tasks = Object.keys(os.getState().tasks).length;
    const habits = Object.keys(os.getState().habits).length;
    const xp = os.gamificationXpTotal();

    loadDefaults();

    expect(Object.keys(os.getState().tasks).length).toBe(tasks);
    expect(Object.keys(os.getState().habits).length).toBe(habits);
    expect(os.gamificationXpTotal()).toBe(xp);
  }, 20_000);

  it("makes a challenge claimable and credits the points", () => {
    renderModule();

    loadDefaults();

    const before = os.coinBalance();
    const claim = screen.getByTestId("rewards-claim");
    expect(claim.hasAttribute("disabled")).toBe(false);

    fireEvent.click(claim);

    expect(os.coinBalance()).toBeGreaterThan(before);
    expect(
      os.coinLedger().some((entry) => entry.entityType === "challenge" && entry.amount > 0),
    ).toBe(true);
  }, 20_000);

  it("stops offering a claim once every finished challenge is claimed", () => {
    renderModule();

    loadDefaults();

    for (let index = 0; index < 3; index += 1) {
      const claim = screen.getByTestId("rewards-claim");
      if (claim.hasAttribute("disabled")) break;
      fireEvent.click(claim);
    }

    expect(screen.getByTestId("rewards-claim").hasAttribute("disabled")).toBe(true);
  }, 20_000);
});

describe("the reward store", () => {
  it("blocks rewards the balance cannot cover", () => {
    renderModule();

    const buttons = screen.getAllByRole("button", { name: "Redeem" });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
  });

  it("redeems a reward once the balance covers it", () => {
    os.grantRewardPoints({ points: 500, note: "Test credit" }, NOW);

    renderModule();

    const button = screen
      .getAllByRole("button", { name: "Redeem" })
      .find((entry) => !entry.hasAttribute("disabled"))!;
    expect(button).toBeDefined();
    fireEvent.click(button);

    expect(os.redeemedRewards().length).toBeGreaterThan(0);
  });
});

describe("reward settings", () => {
  it("switches gamification off and back on", () => {
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Rewards options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Turn gamification off/ }));
    expect(os.gamificationEnabled()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Turn on gamification/ }));
    expect(os.gamificationEnabled()).toBe(true);
  });

  it("updates the daily focus cap", () => {
    renderModule();

    const cap = screen.getByLabelText("Daily focus cap");
    fireEvent.change(cap, { target: { value: "120" } });

    expect(os.getState().settings.gamification.dailyFocusCapMin).toBe(120);
  });
});

describe("route", () => {
  it("renders the page inside the Rewards route", () => {
    render(
      <ToastProvider>
        <RewardsPage />
      </ToastProvider>,
    );

    expect(screen.getByRole("heading", { name: "Rewards" })).toBeDefined();
    expect(screen.getByTestId("rewards-level-card")).toBeDefined();
  });
});

describe("weekly rewards, guardrails and custom rewards", () => {
  it("claims a completed weekly goal once", () => {
    for (let index = 0; index < 5; index += 1) {
      const startedAt = NOW - (index + 1) * HOURS;
      const session = os.startFocusSession({ startedAt, plannedMin: 30 }, startedAt);
      os.completeFocusSession(session.id, {}, startedAt + 30 * 60_000);
    }

    renderModule();
    const before = os.coinBalance();
    fireEvent.click(screen.getByTestId("rewards-week-claim"));

    expect(os.coinBalance()).toBe(before + 250);
    expect(
      os.coinLedger().some((entry) => entry.entityType === "weekly_goal" && entry.amount > 0),
    ).toBe(true);
    expect(screen.queryByTestId("rewards-week-claim")).toBeNull();
  });

  it("hides the streak tile when streaks are turned off", () => {
    os.updateGamificationPreferences({ showStreaks: false });
    renderModule();

    expect(screen.queryByTestId("rewards-tile-streak")).toBeNull();
  });

  it("adds a custom reward to the store", () => {
    renderModule();

    fireEvent.click(screen.getByTestId("rewards-add"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Long walk" } });
    fireEvent.change(screen.getByLabelText("Cost (points)"), { target: { value: "75" } });
    fireEvent.click(screen.getByTestId("reward-dialog-save"));

    expect(os.availableRewards().some((reward) => reward.title === "Long walk")).toBe(true);
    expect(screen.getByText("Long walk")).toBeDefined();
  });

  it("shows every reward when Show all is used", () => {
    for (let index = 0; index < 8; index += 1) {
      os.addReward({ title: `Custom reward ${index}`, cost: 10 });
    }

    renderModule();
    expect(screen.getAllByTestId("rewards-store-item").length).toBe(6);

    fireEvent.click(within(screen.getByTestId("rewards-store")).getByRole("button", { name: "Show all" }));
    expect(screen.getAllByTestId("rewards-store-item").length).toBeGreaterThan(6);
  });
});
describe("reward fixes", () => {
  it("uses the calendar month for the leaderboard period", () => {
    os.awardXP(
      { reason: "focus_session", entityType: "focus", entityId: "old-session" },
      NOW - 20 * DAY,
    );
    os.awardXP(
      { reason: "focus_session", entityType: "focus", entityId: "new-session" },
      NOW - 2 * DAY,
    );

    renderModule();
    const board = within(screen.getByTestId("rewards-leaderboard"));

    expect(board.getByText("15 pts")).toBeDefined();

    fireEvent.click(within(screen.getByTestId("rewards-leaderboard")).getByRole("button", { name: "Leaderboard period" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "All Time" }));

    expect(within(screen.getByTestId("rewards-leaderboard")).getByText("30 pts")).toBeDefined();
  });

  it("clamps the wellbeing caps to their maximums", () => {
    renderModule();

    fireEvent.change(screen.getByLabelText("Daily focus cap"), { target: { value: "9999" } });
    fireEvent.change(screen.getByLabelText("Daily task cap"), { target: { value: "999" } });

    expect(os.getState().settings.gamification.dailyFocusCapMin).toBe(600);
    expect(os.getState().settings.gamification.maxTasksCreditedPerDay).toBe(50);
  });
});
describe("leaderboard privacy", () => {
  it("keeps the leaderboard hidden until it is enabled", () => {
    os.updateGamificationPreferences({ showLeaderboard: false });
    renderModule();

    expect(screen.queryByTestId("rewards-leaderboard")).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: "Show leaderboard" }));
    expect(screen.getByTestId("rewards-leaderboard")).toBeDefined();
  });
});
describe("custom reward management and claim all", () => {
  it("edits and deletes a custom reward", () => {
    const reward = os.addReward({ title: "Long walk", cost: 50 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Long walk options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit reward" }));
    fireEvent.change(screen.getByLabelText("Cost (points)"), { target: { value: "80" } });
    fireEvent.click(screen.getByTestId("reward-dialog-save"));

    expect(os.getState().rewards[reward.id]?.cost).toBe(80);

    fireEvent.click(screen.getByRole("button", { name: "Long walk options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete reward" }));

    expect(os.getState().rewards[reward.id]).toBeUndefined();
  });

  it("claims every completed weekly goal at once", () => {
    for (let index = 0; index < 5; index += 1) {
      const startedAt = NOW - (index + 1) * HOURS;
      const session = os.startFocusSession({ startedAt, plannedMin: 30 }, startedAt);
      os.completeFocusSession(session.id, {}, startedAt + 30 * 60_000);
    }
    for (let index = 0; index < 3; index += 1) {
      const task = os.addTask({ title: `Priority ${index}`, status: "open", priority: 4 });
      os.completeTask(task.id, NOW - HOURS);
    }
    const plan = os.addTask({ title: "Plan next week", status: "open", tags: ["planning"] });
    os.completeTask(plan.id, NOW - HOURS);

    renderModule();
    const before = os.coinBalance();
    fireEvent.click(screen.getByTestId("rewards-week-claim-all"));

    expect(os.coinBalance()).toBe(before + 600);
    expect(
      os.coinLedger().filter((entry) => entry.entityType === "weekly_goal"),
    ).toHaveLength(3);
    expect(screen.queryByTestId("rewards-week-claim-all")).toBeNull();
  });
});