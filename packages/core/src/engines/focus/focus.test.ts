import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  createTimer,
  tick,
  pause,
  resume,
  advanceRound,
  remainingMs,
  formatClock,
  resolvePreset,
  FOCUS_PRESETS,
  logDistraction,
  resumeFromDistraction,
  focusRatio,
} from "./timer";
import { computeFocusStats, selectDeepWorkBlocks, focusSessionsForTask, bestFocusHours } from "./stats";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const MINUTE = 60_000;
const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

describe("Focus: timer modes", () => {
  it("counts up with stopwatch and never ends", () => {
    const timer = createTimer(resolvePreset("stopwatch"), NOW);
    const later = tick(timer, NOW + 90 * MINUTE);

    expect(remainingMs(timer, NOW)).toBeNull();
    expect(later.totalElapsedMs).toBe(90 * MINUTE);
  });

  it("counts down for a countdown session", () => {
    const timer = createTimer({ ...resolvePreset("pomodoro"), mode: "countdown", workMin: 25, breakMin: 0 }, NOW);
    const later = tick(timer, NOW + 10 * MINUTE);

    expect(remainingMs(timer, NOW)).toBe(25 * MINUTE);
    expect(remainingMs(later, NOW + 10 * MINUTE)).toBe(15 * MINUTE);
  });

  it("moves pomodoro from work to break to work", () => {
    const timer = createTimer(resolvePreset("pomodoro"), NOW);

    const afterWork = tick(timer, NOW + 25 * MINUTE);
    expect(afterWork.phase).toBe("break");
    expect(afterWork.completedRounds).toBe(1);
    expect(remainingMs(afterWork, NOW + 25 * MINUTE)).toBe(5 * MINUTE);

    const afterBreak = tick(afterWork, NOW + 30 * MINUTE);
    expect(afterBreak.phase).toBe("work");
    expect(afterBreak.round).toBe(3);
    expect(remainingMs(afterBreak, NOW + 30 * MINUTE)).toBe(25 * MINUTE);
  });

  it("takes a long break every fourth round", () => {
    let timer = createTimer(resolvePreset("pomodoro"), NOW);
    let now = NOW;
    for (let i = 0; i < 4; i += 1) {
      now += 25 * MINUTE;
      timer = advanceRound(timer, now);
      now += 5 * MINUTE;
      timer = advanceRound(timer, now);
    }

    timer.completedRounds = 3;
    const next = advanceRound(timer, now);
    expect(next.completedRounds).toBe(4);
  });

  it("stops an interval timer after its total rounds", () => {
    const timer = createTimer({ ...resolvePreset("interval"), totalRounds: 3 }, NOW);
    let now = NOW;
    let state = timer;
    for (let i = 0; i < 10 && state.status === "running"; i += 1) {
      now += 60 * MINUTE;
      state = advanceRound(state, now);
    }
    expect(state.status).toBe("completed");
    expect(state.completedRounds).toBe(3);
  });

  it("pauses and resumes, shifting the deadline", () => {
    const timer = createTimer(resolvePreset("pomodoro"), NOW);
    const paused = pause(timer, NOW + 10 * MINUTE);

    expect(paused.status).toBe("paused");
    expect(tick(paused, NOW + 20 * MINUTE).phaseElapsedMs).toBe(10 * MINUTE);

    const resumed = resume(paused, NOW + 40 * MINUTE);
    expect(resumed.status).toBe("running");
    expect(remainingMs(resumed, NOW + 40 * MINUTE)).toBe(15 * MINUTE);
  });

  it("formats the clock", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65_000)).toBe("01:05");
    expect(formatClock(3_600_000)).toBe("01:00:00");
  });
});

describe("Focus: sessions", () => {
  it("starts a session, pauses, resumes and completes it", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Write the spec", estimateMin: 60 });

    const session = os.startFocusSession({ startedAt: NOW, taskId: task.id, mode: "countdown" });
    expect(session.status).toBe("running");
    expect(os.getTask(task.id)?.status).toBe("in_progress");

    os.pauseFocusSession(session.id, NOW + 10 * MINUTE);
    expect(os.getFocusSession(session.id)?.status).toBe("paused");

    os.resumeFocusSession(session.id, NOW + 30 * MINUTE);

    const done = os.completeFocusSession(session.id, { note: "Drafted 3 sections", rating: 4 }, NOW + 90 * MINUTE)!;
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBe(NOW + 90 * MINUTE);
    expect(done.activeMs).toBe(70 * MINUTE);
    expect(os.activeFocusSession()).toBeNull();
  });

  it("links a session to a goal through the task", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Ship the API" });
    const task = os.addTask({ title: "Write endpoints", goalIds: [goal.id] });

    const session = os.startFocusSession({ startedAt: NOW, taskId: task.id });
    expect(session.goalId).toBe(goal.id);
    expect(os.focusSessionsForGoal(goal.id)).toHaveLength(1);
  });

  it("aborts a session and keeps it in history", () => {
    const os = makeOS();
    const session = os.startFocusSession({ startedAt: NOW });
    os.abortFocusSession(session.id, NOW + 15 * MINUTE);

    const aborted = os.getFocusSession(session.id)!;
    expect(aborted.status).toBe("aborted");
    expect(aborted.activeMs).toBe(15 * MINUTE);
  });

  it("records distractions and computes the focus ratio", () => {
    const os = makeOS();
    const session = os.startFocusSession({ startedAt: NOW });

    os.logFocusDistraction(session.id, "Slack ping", NOW + 20 * MINUTE);
    os.resumeFromFocusDistraction(session.id, NOW + 23 * MINUTE);

    const done = os.completeFocusSession(session.id, {}, NOW + 60 * MINUTE)!;
    expect(done.distractions).toHaveLength(1);
    expect(done.distractionCount).toBe(1);
    expect(done.distractions[0]!.durationMs).toBe(3 * MINUTE);

    const rows = os.focusSessionsForTask(session.taskId ?? "__none__", 10);
    expect(rows).toHaveLength(0);

    const stats = os.focusStats(NOW, NOW + 86_400_000);
    expect(stats.distractionCount).toBe(1);
    expect(Math.round(stats.focusRatio * 100)).toBe(95);
  });
});

describe("Focus: statistics", () => {
  it("summarises sessions across the window", () => {
    const os = makeOS();
    const a = os.addTask({ title: "Deep work" });
    const b = os.addTask({ title: "Quick task" });

    const first = os.startFocusSession({ startedAt: NOW, taskId: a.id, mode: "countdown", ambient: "white" });
    os.completeFocusSession(first.id, {}, NOW + 90 * MINUTE);

    const second = os.startFocusSession({ startedAt: NOW + 2 * 3_600_000, taskId: b.id, ambient: "brown" });
    os.logFocusDistraction(second.id, "", NOW + 2 * 3_600_000 + 5 * MINUTE);
    os.resumeFromFocusDistraction(second.id, NOW + 2 * 3_600_000 + 7 * MINUTE);
    os.completeFocusSession(second.id, {}, NOW + 2 * 3_600_000 + 30 * MINUTE);

    const aborted = os.startFocusSession({ startedAt: NOW + 5 * 3_600_000, taskId: b.id });
    os.abortFocusSession(aborted.id, NOW + 5 * 3_600_000 + 10 * MINUTE);

    const stats = computeFocusStats(os.getState(), NOW, NOW + 86_400_000);
    expect(stats.sessionCount).toBe(3);
    expect(stats.completedCount).toBe(2);
    expect(stats.abortedCount).toBe(1);
    expect(stats.totalFocusMin).toBe(130);
    expect(stats.completionRate).toBe(67);
    expect(stats.byDay).toHaveLength(1);
    expect(stats.byTask[0]!.minutes).toBe(90);
    expect(stats.byAmbient.map((entry) => entry.ambient)).toContain("white");
  });

  it("tracks deep work blocks separately", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Long block" });
    const session = os.startFocusSession({ startedAt: NOW, taskId: task.id });
    os.completeFocusSession(session.id, {}, NOW + 75 * MINUTE);

    const blocks = selectDeepWorkBlocks(os.getState(), NOW, NOW + 86_400_000);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.durationMin).toBe(75);
  });

  it("finds the best hours for focus", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Morning work" });
    const morning = os.startFocusSession({ startedAt: NOW, taskId: task.id });
    os.completeFocusSession(morning.id, {}, NOW + 60 * MINUTE);

    const evening = os.startFocusSession({ startedAt: NOW + 12 * 3_600_000, taskId: task.id });
    os.completeFocusSession(evening.id, {}, NOW + 12 * 3_600_000 + 20 * MINUTE);

    expect(bestFocusHours(os.getState(), NOW, NOW + 86_400_000)).toEqual([10, 22]);
  });
});

describe("Focus: the task → focus flow", () => {
  it("runs Task → Start Focus → Timer → Complete Task → Record Session", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Review the pull request", estimateMin: 45 });

    const session = os.startFocusSession({ startedAt: NOW, taskId: task.id, mode: "countdown", plannedMin: task.estimateMin });
    expect(os.activeFocusSession()?.id).toBe(session.id);

    os.pauseFocusSession(session.id, NOW + 10 * MINUTE);
    os.resumeFocusSession(session.id, NOW + 12 * MINUTE);

    os.completeTask(task.id, NOW + 50 * MINUTE);
    const recorded = os.completeFocusSession(session.id, { note: "Approved with comments", rating: 5 }, NOW + 50 * MINUTE)!;

    expect(os.getTask(task.id)?.status).toBe("done");
    expect(recorded.status).toBe("completed");
    expect(recorded.taskId).toBe(task.id);
    expect(recorded.plannedMin).toBe(45);
    expect(recorded.note).toBe("Approved with comments");

    const rows = focusSessionsForTask(os.getState(), task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.durationMin).toBe(48);
    expect(os.focusSummaryLine(NOW, NOW + 86_400_000)).toContain("1 session");
  });

  it("feeds task estimation back from real focus time", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Write documentation", estimateMin: 30 });
    const session = os.startFocusSession({ startedAt: NOW, taskId: task.id, plannedMin: 30 });
    os.completeFocusSession(session.id, {}, NOW + 60 * MINUTE);

    const stats = computeFocusStats(os.getState(), NOW, NOW + 86_400_000);
    expect(stats.estimateAccuracy).toHaveLength(1);
    expect(stats.estimateAccuracy[0]!.deltaMin).toBe(30);
  });
});