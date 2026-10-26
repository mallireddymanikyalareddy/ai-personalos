import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import {
  buildGoalsDashboard,
  goalHealth,
  goalTabMatches,
  upcomingGoalMilestones,
  quarterLabel,
} from "./goals";

const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();
const DAY = 86_400_000;

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS({ storage: undefined });
  os.clearAll();
});

function goalWithProgress(
  title: string,
  opts: {
    category?: Parameters<typeof os.addGoal>[0] extends string ? never : never;
  } = {},
) {
  void opts;
  return os.addGoal({ title }, NOW);
}

describe("goal categories", () => {
  it("defaults to other with no cover", () => {
    const goal = os.addGoal("Run a marathon", NOW);
    expect(goal.category).toBe("other");
    expect(goal.coverUrl).toBeNull();
  });

  it("stores an explicit category and cover", () => {
    const goal = os.addGoal(
      { title: "Grow wealth", category: "financial", coverUrl: "blob:cover" },
      NOW,
    );
    expect(goal.category).toBe("financial");
    expect(goal.coverUrl).toBe("blob:cover");
  });

  it("supports the on_hold status", () => {
    const goal = os.addGoal({ title: "Paused goal", status: "on_hold" }, NOW);
    expect(goal.status).toBe("on_hold");
  });
});

describe("goal health", () => {
  it("marks completed goals", () => {
    const goal = os.addGoal("Done goal", NOW - 10 * DAY);
    os.completeGoal(goal.id, NOW);
    const next = os.getGoal(goal.id)!;
    expect(goalHealth(next, 100, NOW)).toBe("completed");
  });

  it("marks on-hold goals", () => {
    const goal = os.addGoal({ title: "Held", status: "on_hold" }, NOW - 10 * DAY);
    expect(goalHealth(goal, 20, NOW)).toBe("on_hold");
  });

  it("marks overdue when the target date has passed", () => {
    const goal = os.addGoal({ title: "Late goal", targetAt: NOW - 5 * DAY }, NOW - 100 * DAY);
    expect(goalHealth(goal, 40, NOW)).toBe("overdue");
  });

  it("returns in_progress without a target date and low progress", () => {
    const goal = os.addGoal("Open ended", NOW - 10 * DAY);
    expect(goalHealth(goal, 20, NOW)).toBe("in_progress");
    expect(goalHealth(goal, 60, NOW)).toBe("on_track");
  });

  it("compares progress against elapsed time", () => {
    const created = NOW - 100 * DAY;
    const target = NOW + 100 * DAY;
    const goal = os.addGoal({ title: "Paced", targetAt: target }, created);

    expect(goalHealth(goal, 90, NOW)).toBe("ahead");
    expect(goalHealth(goal, 50, NOW)).toBe("on_track");
    expect(goalHealth(goal, 5, NOW)).toBe("at_risk");
  });
});

describe("goal tabs", () => {
  it("routes goals into the right tabs", () => {
    const created = NOW - 100 * DAY;
    const active = os.addGoal({ title: "Active", targetAt: NOW + 100 * DAY }, created);
    const overdue = os.addGoal({ title: "Overdue", targetAt: NOW - 3 * DAY }, created);
    const held = os.addGoal({ title: "Held", status: "on_hold" }, created);
    const done = os.addGoal("Finished", created);
    os.completeGoal(done.id, NOW);

    expect(goalTabMatches(active, 50, "in_progress", NOW)).toBe(true);
    expect(goalTabMatches(overdue, 10, "overdue", NOW)).toBe(true);
    expect(goalTabMatches(held, 10, "on_hold", NOW)).toBe(true);
    expect(goalTabMatches(os.getGoal(done.id)!, 100, "completed", NOW)).toBe(true);
    expect(goalTabMatches(active, 50, "all", NOW)).toBe(true);
    expect(goalTabMatches(active, 50, "completed", NOW)).toBe(false);
  });
});

describe("goals dashboard", () => {
  it("returns an empty dashboard with no goals", () => {
    const dash = buildGoalsDashboard(os.getState(), NOW);
    expect(dash.stats.inProgress).toBe(0);
    expect(dash.stats.completed).toBe(0);
    expect(dash.stats.overdue).toBe(0);
    expect(dash.stats.dueThisQuarter).toBe(0);
    expect(dash.goals).toHaveLength(0);
    expect(dash.categories).toHaveLength(0);
    expect(dash.overallProgress).toBe(0);
  });

  it("counts each stat bucket", () => {
    const created = NOW - 100 * DAY;
    os.addGoal({ title: "Active one", category: "health", targetAt: NOW + 50 * DAY }, created);
    os.addGoal({ title: "Active two", category: "health", targetAt: NOW + 50 * DAY }, created);
    const overdue = os.addGoal({ title: "Overdue", category: "career", targetAt: NOW - 2 * DAY }, created);
    const done = os.addGoal({ title: "Done", category: "learning" }, created);
    os.completeGoal(done.id, NOW);
    void overdue;

    const dash = buildGoalsDashboard(os.getState(), NOW);
    expect(dash.stats.inProgress).toBe(2);
    expect(dash.stats.completed).toBe(1);
    expect(dash.stats.overdue).toBe(1);
    expect(dash.stats.inProgressTotal).toBe(4);
    expect(dash.totals.all).toBe(4);
    expect(dash.totals.completed).toBe(1);
    expect(dash.totals.overdue).toBe(1);
  });

  it("counts goals due this quarter", () => {
    os.addGoal({ title: "This quarter", targetAt: NOW + 10 * DAY }, NOW);
    os.addGoal({ title: "Next year", targetAt: NOW + 400 * DAY }, NOW);

    const dash = buildGoalsDashboard(os.getState(), NOW);
    expect(dash.stats.dueThisQuarter).toBe(1);
  });

  it("builds category progress rows for populated categories", () => {
    const created = NOW - 50 * DAY;
    const a = os.addGoal({ title: "A", category: "financial" }, created);
    const b = os.addGoal({ title: "B", category: "financial" }, created);
    os.addGoalMetric(a.id, { label: "Save", current: 60, target: 100, unit: "%" });
    os.addGoalMetric(b.id, { label: "Save", current: 80, target: 100, unit: "%" });
    os.addGoal({ title: "C", category: "sports" }, created);

    const dash = buildGoalsDashboard(os.getState(), NOW);
    const financial = dash.categories.find((row) => row.category === "financial")!;
    expect(financial.label).toBe("Financial");
    expect(financial.count).toBe(2);
    expect(financial.progress).toBe(70);
    expect(dash.categories.find((row) => row.category === "sports")!.progress).toBe(0);
  });

  it("covers the current month forward to the furthest deadline", () => {
    os.addGoal({ title: "Near", targetAt: NOW + 300 * DAY }, NOW);

    const dash = buildGoalsDashboard(os.getState(), NOW);
    const first = new Date(NOW);
    first.setMonth(first.getMonth() - 1, 1);
    first.setHours(0, 0, 0, 0);
    const horizon = new Date(NOW + 365 * DAY);
    horizon.setDate(1);
    horizon.setHours(0, 0, 0, 0);

    expect(dash.timeline[0]!.key).toBe(`${first.getFullYear()}-${first.getMonth() + 1}`);
    expect(dash.timeline[dash.timeline.length - 1]!.key).toBe(
      `${horizon.getFullYear()}-${horizon.getMonth() + 1}`,
    );
    expect(dash.timeline.length).toBeGreaterThanOrEqual(12);
    expect(new Set(dash.timeline.map((point) => point.label)).size).toBe(dash.timeline.length);
  });

  it("shows non-zero progress for goals due outside the current calendar year", () => {
    const goal = os.addGoal({ title: "Next year goal", targetAt: NOW + 300 * DAY }, NOW);
    os.addGoalMetric(goal.id, { label: "Saved", current: 40, target: 100, unit: "%" });

    const dash = buildGoalsDashboard(os.getState(), NOW);
    const values = new Set(dash.timeline.map((point) => point.progress));

    expect(values.size).toBeGreaterThan(1);
    expect(dash.timeline.some((point) => point.progress > 0)).toBe(true);
    expect(dash.timeline[dash.timeline.length - 1]!.progress).toBe(40);
  });

  it("tracks progress for goals without a deadline from the first bucket", () => {
    const goal = os.addGoal({ title: "Evergreen" }, NOW);
    os.addGoalMetric(goal.id, { label: "Done", current: 25, target: 100, unit: "%" });

    const dash = buildGoalsDashboard(os.getState(), NOW);
    expect(dash.timeline[0]!.progress).toBe(25);
    expect(dash.timeline[dash.timeline.length - 1]!.progress).toBe(25);
  });

  it("returns a flat zero series when there are no goals", () => {
    const dash = buildGoalsDashboard(os.getState(), NOW);
    expect(dash.timeline.length).toBeGreaterThanOrEqual(12);
    expect(dash.timeline.every((point) => point.progress === 0)).toBe(true);
  });

  it("summarises health counts and overall progress", () => {
    const created = NOW - 100 * DAY;
    const a = os.addGoal({ title: "On track", targetAt: NOW + 100 * DAY }, created);
    os.addGoalMetric(a.id, { label: "X", current: 50, target: 100, unit: "x" });
    const risky = os.addGoal({ title: "At risk", targetAt: NOW + 100 * DAY }, created);
    os.addGoalMetric(risky.id, { label: "X", current: 5, target: 100, unit: "x" });

    const dash = buildGoalsDashboard(os.getState(), NOW);
    expect(dash.health.on_track).toBe(1);
    expect(dash.health.at_risk).toBe(1);
    expect(dash.overallProgress).toBe(Math.round((50 + 5) / 2));
    expect(dash.insight.length).toBeGreaterThan(0);
  });

  it("filters by tab, category and timeframe", () => {
    const created = NOW - 50 * DAY;
    os.addGoal({ title: "Health active", category: "health", targetAt: NOW + 5 * DAY }, created);
    os.addGoal({ title: "Career active", category: "career", targetAt: NOW + 5 * DAY }, created);
    const done = os.addGoal({ title: "Done one", category: "health" }, created);
    os.completeGoal(done.id, NOW);

    const completedTab = buildGoalsDashboard(os.getState(), NOW, { tab: "completed" });
    expect(completedTab.goals.map((goal) => goal.title)).toEqual(["Done one"]);

    const healthOnly = buildGoalsDashboard(os.getState(), NOW, { category: "health" });
    expect(healthOnly.goals.map((goal) => goal.title)).toEqual(["Done one", "Health active"]);
    expect(healthOnly.categories.map((row) => row.category).sort()).toEqual(["career", "health"]);

    const monthOnly = buildGoalsDashboard(os.getState(), NOW, { timeframe: "month" });
    expect(monthOnly.goals.map((goal) => goal.title)).toContain("Health active");
  });

  it("reports each goal with its health, metric summary and due date", () => {
    const goal = os.addGoal(
      { title: "Save money", category: "financial", targetAt: new Date(2031, 11, 31).getTime() },
      NOW - 50 * DAY,
    );
    os.addGoalMetric(goal.id, { label: "Savings", current: 5, target: 10, unit: "Cr" });

    const dash = buildGoalsDashboard(os.getState(), NOW);
    const card = dash.goals.find((row) => row.id === goal.id)!;
    expect(card.category).toBe("financial");
    expect(card.metricSummary).toBe("5 / 10 Cr");
    expect(card.dueAt).toBe(new Date(2031, 11, 31).getTime());
    expect(card.progress).toBe(50);
  });
});

describe("upcoming goal milestones", () => {
  it("returns milestones from projects linked to active goals", () => {
    const goal = os.addGoal({ title: "Be fit", category: "health" }, NOW);
    const project = os.addProject({ name: "Training plan" }, NOW);
    os.linkGoalToProject(project.id, goal.id);
    os.addMilestone({ projectId: project.id, title: "Run 5k", dueAt: NOW + 5 * DAY }, NOW);
    os.addMilestone({ projectId: project.id, title: "Run 10k", dueAt: NOW + 20 * DAY }, NOW);

    const rows = upcomingGoalMilestones(os.getState(), NOW);
    expect(rows.map((row) => row.title)).toEqual(["Run 5k", "Run 10k"]);
    expect(rows[0]!.goalTitle).toBe("Be fit");
    expect(rows[0]!.category).toBe("health");
    expect(rows[0]!.health).toBe("on_track");
  });

  it("ignores completed and undated milestones", () => {
    const goal = os.addGoal({ title: "Ship it" }, NOW);
    const project = os.addProject({ name: "Launch" }, NOW);
    os.linkGoalToProject(project.id, goal.id);
    const done = os.addMilestone(
      { projectId: project.id, title: "Kickoff", dueAt: NOW + 3 * DAY },
      NOW,
    );
    os.completeMilestone(done.id, NOW);
    os.addMilestone({ projectId: project.id, title: "No date" }, NOW);

    expect(upcomingGoalMilestones(os.getState(), NOW)).toHaveLength(0);
  });

  it("respects the limit", () => {
    const goal = os.addGoal({ title: "Many" }, NOW);
    const project = os.addProject({ name: "Proj" }, NOW);
    os.linkGoalToProject(project.id, goal.id);
    for (let index = 0; index < 6; index += 1) {
      os.addMilestone({ projectId: project.id, title: `M${index}`, dueAt: NOW + (index + 1) * DAY }, NOW);
    }
    expect(upcomingGoalMilestones(os.getState(), NOW, 3)).toHaveLength(3);
  });
});

describe("OS goals methods", () => {
  it("exposes the dashboard, health and milestones through the OS", () => {
    const goal = os.addGoal({ title: "Via OS", category: "career" }, NOW);
    expect(os.goalsDashboard({}, NOW).totals.all).toBe(1);
    expect(os.goalHealthFor(goal.id, NOW)).toBe("in_progress");
    expect(os.upcomingGoalMilestones(5, NOW)).toEqual([]);
  });

  it("keeps the analytics goals row working with the new fields", () => {
    os.addGoal({ title: "Analytics goal", category: "learning" }, NOW);
    const rows = os.analyticsGoals(NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Analytics goal");
  });
});

describe("quarter label", () => {
  it("labels the quarter of a date", () => {
    expect(quarterLabel(new Date(2026, 0, 15).getTime())).toBe("Q1 2026");
    expect(quarterLabel(new Date(2026, 9, 8).getTime())).toBe("Q4 2026");
  });
});
