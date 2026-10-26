import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  computeTaskMetrics,
  computePlanningAccuracy,
  computeTimeUtilization,
  computeScheduleChurn,
  percentChange,
  direction,
} from "./metrics";
import { generateInsights, peakHour } from "./insights";
import { buildTodaySummary, buildReview, buildGoalAnalytics, buildHabitAnalytics, buildFocusAnalytics } from "./engine";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const NOW = new Date(2026, 9, 15, 18, 0, 0, 0).getTime();
const DAY = 86_400_000;
const WEEK = 7 * DAY;

function completeDaysAgo(os: PersonalOS, title: string, daysAgo: number, hour = 10) {
  const task = os.addTask({ title, status: "open" }, NOW - (daysAgo + 1) * DAY);
  const completedAt = new Date(NOW - daysAgo * DAY);
  completedAt.setHours(hour, 0, 0, 0);
  os.updateTask(task.id, {
    startedAt: completedAt.getTime() - 30 * 60_000,
    status: "done",
    completedAt: completedAt.getTime(),
  });
  return os.getTask(task.id)!;
}

describe("Analytics: task metrics", () => {
  it("counts completions, creations and overdue work in the window", () => {
    const os = makeOS();
    completeDaysAgo(os, "Finished A", 1);
    completeDaysAgo(os, "Finished B", 3);
    const open = os.addTask({ title: "Open task", status: "open", dueAt: NOW - 5 * DAY });

    const metrics = computeTaskMetrics(os.getState(), NOW - WEEK, NOW, NOW);
    expect(metrics.completed).toBe(2);
    expect(metrics.overdueNow).toBe(1);
    expect(metrics.overdueAgeDays?.oldest).toBe(5);
    expect(open.status).toBe("open");
  });

  it("computes duration statistics from started/completed pairs", () => {
    const os = makeOS();
    const a = completeDaysAgo(os, "Quick", 1);
    os.updateTask(a.id, { startedAt: a.completedAt! - 20 * 60_000 });
    const b = completeDaysAgo(os, "Longer", 2);
    os.updateTask(b.id, { startedAt: b.completedAt! - 80 * 60_000 });

    const metrics = computeTaskMetrics(os.getState(), NOW - WEEK, NOW, NOW);
    expect(metrics.averageDurationMin).toBe(50);
    expect(metrics.medianDurationMin).toBe(50);
  });

  it("reports created vs completed net", () => {
    const os = makeOS();
    completeDaysAgo(os, "One", 1);
    os.addTask({ title: "Two", status: "open" }, NOW - 2 * DAY);
    os.addTask({ title: "Three", status: "open" }, NOW - 3 * DAY);

    const metrics = computeTaskMetrics(os.getState(), NOW - WEEK, NOW, NOW);
    expect(metrics.createdVsCompleted.net).toBe(2);
  });

  it("tracks completions by hour", () => {
    const os = makeOS();
    completeDaysAgo(os, "Morning", 1, 9);
    completeDaysAgo(os, "Morning two", 2, 10);

    const metrics = computeTaskMetrics(os.getState(), NOW - WEEK, NOW, NOW);
    const morning = metrics.completionByHour.filter((entry) => entry.hour < 12);
    expect(morning.reduce((sum, entry) => sum + entry.completed, 0)).toBeGreaterThan(0);
  });
});

describe("Analytics: planning accuracy", () => {
  it("detects systematic underestimation", () => {
    const os = makeOS();
    for (let index = 1; index <= 4; index += 1) {
      const session = os.startFocusSession({ startedAt: NOW - index * DAY, plannedMin: 30 });
      os.completeFocusSession(session.id, {}, NOW - index * DAY + 90 * 60_000);
    }

    const before = os.gamificationXpTotal();
    const accuracy = computePlanningAccuracy(os.getState(), NOW - WEEK, NOW);
    expect(accuracy.totalTasksWithEstimate).toBeGreaterThanOrEqual(4);
    expect(accuracy.commonDirection).toBe("under");
    expect(accuracy.meanErrorMin).toBeGreaterThan(0);
    void before;
  });

  it("detects systematic overestimation", () => {
    const os = makeOS();
    for (let index = 1; index <= 4; index += 1) {
      const session = os.startFocusSession({ startedAt: NOW - index * DAY, plannedMin: 120 });
      os.completeFocusSession(session.id, {}, NOW - index * DAY + 20 * 60_000);
    }

    const accuracy = computePlanningAccuracy(os.getState(), NOW - WEEK, NOW);
    expect(accuracy.commonDirection).toBe("over");
    expect(accuracy.meanErrorMin).toBeLessThan(0);
  });
});

describe("Analytics: time and schedule", () => {
  it("computes utilization from events and blocks", () => {
    const os = makeOS();
    const dayStart = NOW - 2 * DAY;
    os.addEvent({
      title: "Standup",
      startsAt: dayStart + 10 * 3_600_000,
      endsAt: dayStart + 11 * 3_600_000,
      attendees: [{ id: "att-1", name: "A", email: "a@b.c", isOrganizer: false, status: "accepted" }],
    });

    const time = computeTimeUtilization(os.getState(), dayStart, dayStart + DAY, NOW);
    expect(time.busyMinutes).toBeGreaterThan(0);
    expect(time.utilization).toBeGreaterThanOrEqual(0);
  });

  it("counts schedule churn from AI-sourced blocks", () => {
    const os = makeOS();
    const dayStart = NOW - DAY;
    os.addTimeBlock({
      startsAt: dayStart + 9 * 3_600_000,
      endsAt: dayStart + 10 * 3_600_000,
      title: "AI block",
      kind: "focus",
      source: "ai",
    });

    const churn = computeScheduleChurn(os.getState(), dayStart, dayStart + DAY);
    expect(churn.createdBlocks).toBe(1);
    expect(churn.aiMovedBlocks).toBe(1);
    expect(churn.churnRate).toBe(100);
  });
});

describe("Analytics: insights", () => {
  it("produces a time-of-day insight from real completions", () => {
    const os = makeOS();
    for (let day = 1; day <= 5; day += 1) {
      const task = os.addTask({ title: `Work ${day}`, status: "open", priority: 4 });
      os.updateTask(task.id, { createdAt: NOW - (day + 1) * DAY });
      const at = NOW - day * DAY;
      const date = new Date(at);
      date.setHours(9, 0, 0, 0);
      os.updateTask(task.id, { status: "done", completedAt: date.getTime(), startedAt: date.getTime() - 20 * 60_000 });
    }

    const insights = generateInsights(os.getState(), NOW - WEEK, NOW, NOW);
    const insight = insights.find((entry) => entry.id === "focus-window");
    expect(insight).toBeDefined();
    expect(insight!.headline).toMatch(/before noon/i);
    expect(insight!.sampleSize).toBeGreaterThanOrEqual(5);
  });

  it("produces an estimation insight", () => {
    const os = makeOS();
    for (let index = 1; index <= 5; index += 1) {
      const session = os.startFocusSession({ startedAt: NOW - index * DAY, plannedMin: 30 });
      os.completeFocusSession(session.id, {}, NOW - index * DAY + 90 * 60_000);
    }

    const insights = generateInsights(os.getState(), NOW - WEEK, NOW, NOW);
    const insight = insights.find((entry) => entry.id === "estimate-accuracy");
    expect(insight).toBeDefined();
    expect(insight!.headline).toMatch(/underestimate/i);
  });

  it("does not invent insights from thin data", () => {
    const os = makeOS();
    const one = os.addTask({ title: "One thing", status: "open" });
    os.updateTask(one.id, { status: "done", completedAt: NOW, startedAt: NOW - 15 * 60_000 });
    const insights = generateInsights(os.getState(), NOW - WEEK, NOW, NOW);
    expect(insights.find((entry) => entry.id === "focus-window")).toBeUndefined();
  });

  it("finds the peak completion hour", () => {
    const peak = peakHour([
      { hour: 9, completed: 4 },
      { hour: 14, completed: 2 },
    ]);
    expect(peak).toEqual({ hour: 9, count: 4 });
    expect(peakHour([])).toBeNull();
  });

  it("ignores an all-zero hour list", () => {
    expect(peakHour([{ hour: 9, completed: 0 }])).toBeNull();
  });
});

describe("Analytics: today summary and reviews", () => {
  it("builds a today summary that surfaces overdue work first", () => {
    const os = makeOS();
    os.addTask({ title: "Stale task", status: "open", dueAt: NOW - 4 * DAY });
    os.addTask({ title: "Today task", status: "open", dueAt: NOW });

    const summary = buildTodaySummary(os.getState(), NOW);
    expect(summary.overdue).toBe(1);
    expect(summary.nextUp[0]!.title).toBe("Stale task");
    expect(summary.nextUp[0]!.reason).toMatch(/overdue/i);
    expect(summary.headline).toMatch(/need attention/i);
  });

  it("builds a weekly review with wins and watch items", () => {
    const os = makeOS();
    completeDaysAgo(os, "Shipped A", 1);
    completeDaysAgo(os, "Shipped B", 2);
    os.addTask({ title: "Stuck task", status: "open", dueAt: NOW - 3 * DAY });

    const review = buildReview(os.getState(), "week", NOW);
    expect(review.tasks.completed).toBe(2);
    expect(review.tasks.overdueNow).toBe(1);
    expect(review.watch.some((item) => item.includes("overdue"))).toBe(true);
    expect(review.label).toBeTruthy();
  });

  it("builds habit and focus analytics", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Stretch", cadence: "daily" }, NOW - 20 * DAY);
    os.completeHabit(habit.id, NOW - DAY, NOW - DAY);

    const habits = buildHabitAnalytics(os.getState(), NOW, 28);
    expect(habits.length).toBeGreaterThan(0);
    expect(habits[0]!.title).toBe("Stretch");

    const session = os.startFocusSession({ startedAt: NOW - DAY, plannedMin: 45 });
    os.completeFocusSession(session.id, {}, NOW - DAY + 45 * 60_000);

    const focus = buildFocusAnalytics(os.getState(), NOW - WEEK, NOW, NOW);
    expect(focus.sessionCount).toBe(1);
    expect(focus.totalMin).toBe(45);
    expect(focus.estimateError).toHaveLength(1);
  });

  it("builds goal analytics with metric and project rows", () => {
    const os = makeOS();
    const goal = os.addGoal({
      title: "Run further",
      metrics: [{ label: "km", current: 5, target: 10, unit: "km" }],
    });
    const project = os.addProject({ name: "Training" });
    os.linkGoalToProject(project.id, goal.id);

    const rows = buildGoalAnalytics(os.getState(), NOW);
    expect(rows[0]!.title).toBe("Run further");
    expect(rows[0]!.metricRows[0]!.percent).toBe(50);
    expect(rows[0]!.projects.some((entry) => entry.name === "Training")).toBe(true);
  });
});

describe("Analytics: trend helpers", () => {
  it("detects direction and percent change", () => {
    expect(direction([1, 1, 1, 5, 5, 5])).toBe("rising");
    expect(direction([5, 5, 5, 1, 1, 1])).toBe("falling");
    expect(direction([3, 3, 3, 3])).toBe("flat");
    expect(percentChange([10, 10, 20, 20])).toBe(100);
    expect(percentChange([0, 0, 5, 5])).toBeNull();
    expect(percentChange([5])).toBeNull();
  });
});

describe("Analytics: meetings", () => {
  it("counts meetings and event-based meetings without double counting", () => {
    const os = makeOS();
    const meeting = os.addMeeting({
      title: "Client call",
      startsAt: NOW - 2 * DAY,
      endsAt: NOW - 2 * DAY + 60 * 60_000,
      attendees: [{ id: "a1", name: "A", email: "a@b.c" }],
    });
    os.updateMeeting(meeting.id, { status: "completed" });
    const linked = os.addEvent({
      title: "Client call",
      startsAt: NOW - 2 * DAY,
      endsAt: NOW - 2 * DAY + 60 * 60_000,
      attendees: [{ id: "a1", name: "A", email: "a@b.c", status: "accepted", isOrganizer: true }],
    });
    os.updateMeeting(meeting.id, { eventId: linked.id });
    os.addEvent({
      title: "Board sync",
      startsAt: NOW - DAY,
      endsAt: NOW - DAY + 30 * 60_000,
      attendees: [{ id: "a2", name: "B", email: "b@b.c", status: "accepted", isOrganizer: true }],
    });

    const analytics = os.analyticsMeetings(NOW - WEEK, NOW, NOW);

    expect(analytics.count).toBe(2);
    expect(analytics.minutes).toBe(90);
    expect(analytics.completed).toBe(1);
  });

  it("excludes cancelled meetings", () => {
    const os = makeOS();
    const meeting = os.addMeeting({
      title: "Cancelled call",
      startsAt: NOW - DAY,
      endsAt: NOW - DAY + 30 * 60_000,
    });
    os.updateMeeting(meeting.id, { status: "cancelled" });

    const analytics = os.analyticsMeetings(NOW - WEEK, NOW, NOW);

    expect(analytics.count).toBe(0);
    expect(analytics.cancelled).toBe(1);
  });
});

describe("Analytics: explicit ranges", () => {
  it("computes overview metrics for the exact window requested", () => {
    const os = makeOS();
    completeDaysAgo(os, "Done this week", 1);
    completeDaysAgo(os, "Done long ago", 20);

    const recent = os.analyticsOverviewRange(NOW - WEEK, NOW, NOW);
    const older = os.analyticsOverviewRange(NOW - 30 * DAY, NOW - 10 * DAY, NOW);

    expect(recent.tasks.completed).toBe(1);
    expect(older.tasks.completed).toBe(1);
  });

  it("attributes focus to areas even when activeMs is missing", () => {
    const os = makeOS();
    const session = os.startFocusSession({ startedAt: NOW - DAY, plannedMin: 60 });
    os.completeFocusSession(session.id, {}, NOW - DAY + 60 * 60_000);
    os.getState().focusSessions[session.id]!.activeMs = 0;

    const areas = os.focusByArea(NOW - WEEK, NOW);

    expect(areas.reduce((sum, area) => sum + area.minutes, 0)).toBe(60);
  });
});