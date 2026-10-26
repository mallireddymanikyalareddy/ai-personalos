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

describe("Today: meetings section", () => {
  it("lists only today's meetings, soonest first", () => {
    const os = makeOS();
    os.addMeeting({ title: "Later today", startsAt: NOW + 3 * HOUR, endsAt: NOW + 4 * HOUR }, NOW);
    os.addMeeting({ title: "Earlier today", startsAt: NOW + HOUR, endsAt: NOW + 2 * HOUR }, NOW);
    os.addMeeting({ title: "Tomorrow", startsAt: NOW + DAY, endsAt: NOW + DAY + HOUR }, NOW);

    const rows = os.todayMeetings(NOW);

    expect(rows.map((row) => row.title)).toEqual(["Earlier today", "Later today"]);
    expect(rows[0]!.timeLabel).toBeTruthy();
  });

  it("marks meetings that already have a summary", () => {
    const os = makeOS();
    const meeting = os.addMeeting({ title: "Retro", startsAt: NOW + HOUR, endsAt: null }, NOW);
    os.updateMeeting(meeting.id, { aiSummary: "We agreed to ship on Friday." });

    const rows = os.todayMeetings(NOW);

    expect(rows[0]!.hasSummary).toBe(true);
    expect(rows[0]!.hasTranscript).toBe(false);
  });
});

describe("Today: routine steps", () => {
  it("resolves routine steps and links them to their tasks", () => {
    const os = makeOS();
    const routine = os.addRoutine(
      {
        title: "Morning routine",
        steps: [{ title: "Stretch", taskId: null, habitId: null, durationMin: 10 }],
      },
      NOW - DAY,
    );
    const task = os.addTask({ title: "Stretch", routineId: routine.id, dueAt: NOW }, NOW);

    const rows = os.todaySteps(NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Stretch");
    expect(rows[0]!.taskId).toBe(task.id);
    expect(rows[0]!.done).toBe(false);

    os.completeTask(task.id, NOW);
    expect(os.todaySteps(NOW)[0]!.done).toBe(true);
  });
});

describe("Today: projects", () => {
  it("reports progress for active projects only", () => {
    const os = makeOS();
    const project = os.addProject({ name: "Relaunch" }, NOW - DAY);
    os.addTask({ title: "Scope", projectId: project.id, dueAt: NOW + DAY }, NOW);
    os.addProject({ name: "Archived idea", status: "archived" }, NOW);

    const rows = os.todayProjects(NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Relaunch");
    expect(rows[0]!.openTasks).toBe(1);
  });
});

describe("Today: deadlines", () => {
  it("lists tasks due in the next seven days", () => {
    const os = makeOS();
    os.addTask({ title: "Today", dueAt: NOW + HOUR }, NOW);
    os.addTask({ title: "In six days", dueAt: NOW + 6 * DAY }, NOW);
    os.addTask({ title: "Later", dueAt: NOW + 20 * DAY }, NOW);
    const done = os.addTask({ title: "Finished", dueAt: NOW + HOUR }, NOW);
    os.completeTask(done.id, NOW);

    const rows = os.todayDeadlines(NOW);

    expect(rows.map((row) => row.title)).toEqual(["Today", "In six days"]);
    expect(rows[0]!.dueLabel).toBe("Today");
  });
});

describe("Today: notes, focus, moments and reward", () => {
  it("returns the most recently updated notes", () => {
    const os = makeOS();
    os.addNote({ title: "Older" }, NOW - 2 * HOUR);
    os.addNote({ title: "Newer" }, NOW - HOUR);

    const rows = os.todayNotes(NOW);

    expect(rows[0]!.title).toBe("Newer");
    expect(rows[0]!.updatedLabel).toBeTruthy();
  });

  it("returns today's focus sessions", () => {
    const os = makeOS();
    const session = os.startFocusSession({ startedAt: NOW - 2 * HOUR, plannedMin: 50 }, NOW - 2 * HOUR);
    os.completeFocusSession(session.id, { note: "Deep work" }, NOW - HOUR);

    const rows = os.todayFocusLog(NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.note).toBe("Deep work");
    expect(rows[0]!.done).toBe(true);
  });

  it("returns today's memory moments", () => {
    const os = makeOS();
    os.addMemoryMoment({ title: "Coffee", happenedAt: NOW - HOUR }, NOW - HOUR);
    os.addMemoryMoment({ title: "Yesterday", happenedAt: NOW - DAY }, NOW - DAY);

    const rows = os.todayMoments(NOW);

    expect(rows.map((row) => row.title)).toEqual(["Coffee"]);
  });

  it("returns the reward snapshot", () => {
    const os = makeOS();
    os.awardXP({ reason: "task_complete", entityType: "task", entityId: "t1", note: "Ship" });

    const reward = os.todayReward();

    expect(reward.xpTotal).toBe(10);
    expect(reward.coins).toBeGreaterThan(0);
    expect(reward.level).toBeGreaterThanOrEqual(1);
  });
});
