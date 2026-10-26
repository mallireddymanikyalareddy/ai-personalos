import { describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();
const DAY = 86_400_000;
const HOUR = 3_600_000;

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

describe("Today: glance", () => {
  it("counts tasks, meetings, focus and points", () => {
    const os = makeOS();
    os.addTask({ title: "Due today", dueAt: NOW + HOUR }, NOW);
    const done = os.addTask({ title: "Done today", dueAt: NOW + HOUR }, NOW);
    os.completeTask(done.id, NOW);
    os.addMeeting({ title: "Standup", startsAt: NOW + HOUR, endsAt: null }, NOW);
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t1", note: "Ship" });

    const glance = os.todayGlance(NOW);

    expect(glance.tasksDue).toBe(1);
    expect(glance.tasksDone).toBe(1);
    expect(glance.tasksTotal).toBe(2);
    expect(glance.planProgress).toBe(50);
    expect(glance.meetings).toBe(1);
    expect(glance.rewardPoints).toBeGreaterThan(0);
  });

  it("counts everything the quick tiles show", () => {
    const os = makeOS();
    os.addTask({ title: "Due today", dueAt: NOW + HOUR }, NOW);
    os.addGoal({ title: "Grow" }, NOW);
    os.addHabit({ title: "Read", cadence: "daily", daysOfWeek: [], daysOfMonth: [] }, NOW);
    os.addProject({ name: "Relaunch" }, NOW);
    os.addNote({ title: "Idea" }, NOW);
    os.addNotebook({ title: "Notes" }, NOW);

    const counts = os.todayCounts(NOW);

    expect(counts.tasksDue).toBe(1);
    expect(counts.goals).toBe(1);
    expect(counts.habitsTotal).toBe(1);
    expect(counts.projects).toBe(1);
    expect(counts.notes).toBe(1);
    expect(counts.notebooks).toBe(1);
  });
});

describe("Today: week insights", () => {
  it("reports focus hours, goals progress and habit adherence", () => {
    const os = makeOS();
    const session = os.startFocusSession({ startedAt: NOW - 2 * HOUR, plannedMin: 60 }, NOW - 2 * HOUR);
    os.completeFocusSession(session.id, {}, NOW - HOUR);

    const week = os.todayWeekInsights(NOW);

    expect(week.focusHours).toBeGreaterThan(0);
    expect(week.goalsProgress).toBeGreaterThanOrEqual(0);
    expect(week.habitAdherence).toBeGreaterThanOrEqual(0);
    expect(week.productivity).toBeGreaterThanOrEqual(0);
  });
});

describe("Today: documents", () => {
  it("lists the newest documents with a readable size", () => {
    const os = makeOS();
    os.addDocument({ title: "Runbook.pdf", mimeType: "application/pdf", sizeBytes: 2_400_000 }, NOW);

    const rows = os.todayDocuments(NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Runbook.pdf");
    expect(rows[0]!.sizeLabel).toBe("2.3 MB");
  });

  it("lists documents through the os helper", () => {
    const os = makeOS();
    os.addDocument({ title: "Plan.xlsx", mimeType: "application/vnd.ms-excel", sizeBytes: 742_000 }, NOW);

    expect(os.documents()).toHaveLength(1);
    expect(os.documents()[0]!.title).toBe("Plan.xlsx");
  });
});

describe("Today: month grid", () => {
  it("marks today and days with events", () => {
    const os = makeOS();
    os.addEvent({ title: "Standup", startsAt: NOW + HOUR, endsAt: NOW + 2 * HOUR }, NOW);

    const days = os.todayMonth(NOW, NOW);

    expect(days).toHaveLength(42);
    expect(days.filter((day) => day.isToday)).toHaveLength(1);
    expect(days.some((day) => day.hasEvent)).toBe(true);
  });
});
