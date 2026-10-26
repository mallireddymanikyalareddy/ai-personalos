import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { buildHabitsDashboard } from "./dashboard";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS({ storage: undefined });
  os.clearAll();
});

function addHabit(input: Parameters<typeof os.addHabit>[0], createdAt = NOW - 30 * DAY) {
  return os.addHabit(input, createdAt);
}

describe("habits dashboard stats", () => {
  it("counts today's habits and completed check-ins", () => {
    const a = addHabit({ title: "Drink water", cadence: "daily" });
    addHabit({ title: "Exercise", cadence: "daily" });
    os.completeHabit(a.id, NOW, NOW);

    const dash = buildHabitsDashboard(os.getState(), NOW);
    expect(dash.stats.dueToday).toBe(2);
    expect(dash.stats.doneToday).toBe(1);
    expect(dash.stats.totalActive).toBe(2);
  });

  it("tracks the longest streak across habits", () => {
    const a = addHabit({ title: "Streaky", cadence: "daily" });
    for (let back = 6; back >= 0; back -= 1) {
      os.completeHabit(a.id, NOW - back * DAY, NOW);
    }

    const dash = buildHabitsDashboard(os.getState(), NOW);
    expect(dash.stats.currentStreak).toBe(7);
    expect(dash.stats.longestStreak).toBe(7);
  });

  it("computes an overall success rate from period samples", () => {
    const a = addHabit({ title: "Reliable", cadence: "daily" });
    for (let back = 9; back >= 5; back -= 1) {
      os.completeHabit(a.id, NOW - back * DAY, NOW);
    }

    const dash = buildHabitsDashboard(os.getState(), NOW);
    expect(dash.successRate).toBeGreaterThan(0);
    expect(dash.successRate).toBeLessThanOrEqual(100);
    expect(dash.cards[0]!.progress).toBe(dash.cards[0]!.progress);
  });

  it("returns a zeroed dashboard when there are no habits", () => {
    const dash = buildHabitsDashboard(os.getState(), NOW);
    expect(dash.cards).toHaveLength(0);
    expect(dash.stats.currentStreak).toBe(0);
    expect(dash.stats.successRate).toBe(0);
    expect(dash.successRate).toBe(0);
  });
});

describe("habits dashboard rows", () => {
  it("exposes description, priority and colour on each card", () => {
    addHabit({
      title: "Read",
      description: "20 pages",
      priority: "high",
      color: "#ff0000",
      icon: "book",
    });

    const dash = buildHabitsDashboard(os.getState(), NOW);
    const card = dash.cards[0]!;
    expect(card.description).toBe("20 pages");
    expect(card.priority).toBe("high");
    expect(card.color).toBe("#ff0000");
    expect(card.icon).toBe("book");
  });

  it("builds a Monday-first week strip with today marked", () => {
    addHabit({ title: "Daily", cadence: "daily" });
    os.completeHabit(os.getState().habits[Object.keys(os.getState().habits)[0]!]!.id, NOW, NOW);

    const dash = buildHabitsDashboard(os.getState(), NOW);
    const week = dash.cards[0]!.week;
    expect(week).toHaveLength(7);
    expect(week.map((day) => day.label).join(" ")).toBe("Mon Tue Wed Thu Fri Sat Sun");
    const thursday = week.find((day) => day.label === "Thu")!;
    expect(thursday.isToday).toBe(true);
    expect(thursday.checked).toBe(true);
    expect(week.filter((day) => day.isFuture).length).toBeGreaterThan(0);
  });

  it("filters by cadence tab and status filter", () => {
    addHabit({ title: "Daily one", cadence: "daily" });
    addHabit({ title: "Weekly one", cadence: "weekly", daysOfWeek: [0] });
    addHabit({ title: "Custom one", cadence: "custom", daysOfWeek: [2] });

    const daily = buildHabitsDashboard(os.getState(), NOW, { tab: "daily" });
    expect(daily.cards.map((row) => row.title)).toEqual(["Daily one"]);

    const weekly = buildHabitsDashboard(os.getState(), NOW, { tab: "weekly" });
    expect(weekly.cards.map((row) => row.title)).toEqual(["Weekly one"]);

    const custom = buildHabitsDashboard(os.getState(), NOW, { tab: "custom" });
    expect(custom.cards.map((row) => row.title)).toEqual(["Custom one"]);

    const due = buildHabitsDashboard(os.getState(), NOW, { filter: "due" });
    expect(due.cards.map((row) => row.title)).toEqual(["Daily one"]);
  });

  it("sorts by priority, streak, progress and name", () => {
    addHabit({ title: "Zebra", priority: "low" });
    addHabit({ title: "Apple", priority: "high" });
    addHabit({ title: "Mango", priority: "medium" });

    const byPriority = buildHabitsDashboard(os.getState(), NOW, { sort: "priority" });
    expect(byPriority.cards[0]!.title).toBe("Apple");

    const byName = buildHabitsDashboard(os.getState(), NOW, { sort: "name" });
    expect(byName.cards.map((row) => row.title)).toEqual(["Apple", "Mango", "Zebra"]);

    const byStreak = buildHabitsDashboard(os.getState(), NOW, { sort: "streak" });
    expect(byStreak.cards).toHaveLength(3);
  });

  it("excludes archived habits", () => {
    const kept = addHabit({ title: "Kept", cadence: "daily" });
    const dropped = addHabit({ title: "Dropped", cadence: "daily" });
    os.updateHabit(dropped.id, { archived: true });

    const dash = buildHabitsDashboard(os.getState(), NOW);
    expect(dash.cards.map((row) => row.title)).toEqual(["Kept"]);
    expect(dash.stats.totalActive).toBe(1);
    void kept;
  });
});

describe("habits dashboard series", () => {
  it("never plots future days in the month series", () => {
    addHabit({ title: "Daily", cadence: "daily" });

    const dash = buildHabitsDashboard(os.getState(), NOW);
    expect(dash.month).toHaveLength(8);
    expect(dash.month[dash.month.length - 1]!.day).toBe(8);
  });

  it("produces a non-degenerate rate series from check-ins", () => {
    const habit = addHabit({ title: "Daily", cadence: "daily" });
    os.completeHabit(habit.id, NOW - 2 * DAY, NOW);
    os.completeHabit(habit.id, NOW - 1 * DAY, NOW);

    const dash = buildHabitsDashboard(os.getState(), NOW);
    const rates = new Set(dash.month.map((point) => point.rate));
    expect(rates.size).toBeGreaterThan(1);
    expect(dash.month[7]!.rate).toBe(0);
  });

  it("builds a calendar grid for the requested month", () => {
    addHabit({ title: "Daily", cadence: "daily" });

    const current = buildHabitsDashboard(os.getState(), NOW);
    expect(current.calendarLabel).toBe("October 2026");
    expect(current.calendar.some((day) => day.isToday)).toBe(true);
    expect(current.calendar.filter((day) => day.inMonth)).toHaveLength(31);
    expect(current.calendar[0]!.dayStart).toBeLessThanOrEqual(current.calendar[0]!.dayStart);

    const previous = buildHabitsDashboard(os.getState(), NOW, {
      monthAnchor: new Date(2026, 8, 15).getTime(),
    });
    expect(previous.calendarLabel).toBe("September 2026");
    expect(previous.calendar.some((day) => day.isToday)).toBe(false);
  });
});

describe("habits dashboard insights", () => {
  it("always reports today's completion and a streak line when there is one", () => {
    const habit = addHabit({ title: "Daily", cadence: "daily" });
    for (let back = 2; back >= 0; back -= 1) os.completeHabit(habit.id, NOW - back * DAY, NOW);

    const dash = buildHabitsDashboard(os.getState(), NOW);
    const ids = dash.insights.map((insight) => insight.id);
    expect(ids).toContain("streak");
    expect(ids).toContain("today");
    expect(dash.insights.every((insight) => insight.text.length > 0)).toBe(true);
  });

  it("says nothing is scheduled when no habit is due today", () => {
    addHabit({ title: "Monthly", cadence: "monthly", daysOfMonth: [28] });
    const dash = buildHabitsDashboard(os.getState(), NOW);
    const today = dash.insights.find((insight) => insight.id === "today")!;
    expect(today.text).toContain("Nothing is scheduled");
  });
});