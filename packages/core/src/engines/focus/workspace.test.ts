import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import {
  FOCUS_ENVIRONMENTS,
  focusBreakdownToday,
  focusEnvironment,
  focusPlanForDay,
  focusStreak,
  focusStreakWeek,
  focusTasksForDay,
} from "./index";

const DAY = 86_400_000;
const T0 = new Date(2026, 4, 12, 9, 0, 0, 0).getTime();
const TODAY = T0;

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS();
});

function session(daysAgo: number, minutes: number, status: "running" | "paused" | "completed" | "aborted" = "completed") {
  const startedAt = TODAY - daysAgo * DAY;
  const created = os.startFocusSession({ startedAt, plannedMin: minutes }, startedAt);
  os.store.update("focusSessions", created.id, {
    activeMs: minutes * 60_000,
    status,
    completedAt: status === "completed" ? startedAt + minutes * 60_000 : null,
  });
  return os.getState().focusSessions[created.id]!;
}

describe("focus environments", () => {
  it("offers the four mockup environments", () => {
    expect(FOCUS_ENVIRONMENTS.map((entry) => entry.id)).toEqual([
      "nature",
      "library",
      "office",
      "cafe",
    ]);
  });

  it("gives every environment a gradient, accent and ambient sound", () => {
    for (const entry of FOCUS_ENVIRONMENTS) {
      expect(entry.gradient).toMatch(/linear-gradient/);
      expect(entry.accent).toMatch(/^#/);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.ambient.length).toBeGreaterThan(0);
    }
  });

  it("falls back to nature for an unknown id", () => {
    expect(focusEnvironment("nope").id).toBe("nature");
    expect(focusEnvironment("cafe").label).toBe("Café");
  });
});

describe("focus streak", () => {
  it("is zero with no sessions", () => {
    expect(focusStreak(os.getState(), TODAY).current).toBe(0);
  });

  it("counts a single day", () => {
    session(0, 25);
    expect(focusStreak(os.getState(), TODAY).current).toBe(1);
  });

  it("counts consecutive days including today", () => {
    session(0, 25);
    session(1, 30);
    session(2, 15);
    expect(focusStreak(os.getState(), TODAY).current).toBe(3);
  });

  it("keeps the streak alive when today is not yet done", () => {
    session(1, 25);
    session(2, 25);
    const streak = focusStreak(os.getState(), TODAY);
    expect(streak.current).toBe(2);
    expect(streak.activeToday).toBe(false);
  });

  it("breaks on a missed day", () => {
    session(0, 25);
    session(2, 25);
    expect(focusStreak(os.getState(), TODAY).current).toBe(1);
  });

  it("remembers the longest run", () => {
    session(5, 25);
    session(4, 25);
    session(3, 25);
    session(1, 25);
    expect(focusStreak(os.getState(), TODAY).longest).toBe(3);
  });

  it("ignores aborted sessions", () => {
    session(0, 25, "aborted");
    expect(focusStreak(os.getState(), TODAY).current).toBe(0);
  });

  it("ignores zero-minute sessions", () => {
    const started = os.startFocusSession({ startedAt: TODAY, plannedMin: 25 }, TODAY);
    os.store.update("focusSessions", started.id, { activeMs: 0, status: "completed" });
    expect(focusStreak(os.getState(), TODAY).current).toBe(0);
  });

  it("reports the last session time", () => {
    const made = session(0, 25);
    expect(focusStreak(os.getState(), TODAY).lastSessionAt).toBe(made.startedAt);
  });

  it("honours a minimum-minute threshold", () => {
    session(0, 1);
    expect(focusStreak(os.getState(), TODAY, 5).current).toBe(0);
  });
});

describe("focus streak week", () => {
  it("returns seven days ending today", () => {
    const week = focusStreakWeek(os.getState(), TODAY);
    expect(week).toHaveLength(7);
    expect(week[6]!.day).toBe(new Date(TODAY).setHours(0, 0, 0, 0));
  });

  it("marks days with focus minutes", () => {
    session(2, 25);
    const week = focusStreakWeek(os.getState(), TODAY);
    expect(week.filter((day) => day.active)).toHaveLength(1);
  });

  it("reports zero minutes for an empty week", () => {
    expect(focusStreakWeek(os.getState(), TODAY).every((day) => day.minutes === 0)).toBe(true);
  });
});

describe("focus plan", () => {
  function block(title: string, hourOffset: number, minutes: number, taskId: string | null = null) {
    return os.addTimeBlock(
      {
        title,
        startsAt: TODAY + hourOffset * 3_600_000,
        endsAt: TODAY + hourOffset * 3_600_000 + minutes * 60_000,
        taskId,
      },
      TODAY,
    );
  }

  it("is empty with no scheduled blocks", () => {
    expect(focusPlanForDay(os.getState(), TODAY)).toHaveLength(0);
  });

  it("lists today's blocks in time order", () => {
    block("Morning routine", 1, 30);
    block("Deep work", 2, 90);

    const plan = focusPlanForDay(os.getState(), TODAY);
    expect(plan.map((slot) => slot.title)).toEqual(["Morning routine", "Deep work"]);
  });

  it("excludes blocks on other days", () => {
    block("Tomorrow", 30, 30);
    expect(focusPlanForDay(os.getState(), TODAY)).toHaveLength(0);
  });

  it("uses the task title in preference to the block title", () => {
    const task = os.addTask({ title: "Write documentation" }, TODAY);
    block("Generic slot", 1, 45, task.id);

    const [slot] = focusPlanForDay(os.getState(), TODAY);
    expect(slot?.title).toBe("Write documentation");
    expect(slot?.taskId).toBe(task.id);
  });

  it("computes slot duration in minutes", () => {
    block("Deep work", 1, 50);
    expect(focusPlanForDay(os.getState(), TODAY)[0]?.minutes).toBe(50);
  });

  it("marks a slot done when the block is completed", () => {
    const made = block("Done thing", 1, 30);
    os.updateTimeBlock(made.id, { completedAt: TODAY });
    expect(focusPlanForDay(os.getState(), TODAY)[0]?.done).toBe(true);
  });

  it("carries task priority onto the slot", () => {
    const task = os.addTask({ title: "Urgent", priority: 3 }, TODAY);
    block("Urgent slot", 1, 30, task.id);
    expect(focusPlanForDay(os.getState(), TODAY)[0]?.priority).toBe(3);
  });
});

describe("focus tasks for day", () => {
  it("is empty with nothing scheduled or focused", () => {
    expect(focusTasksForDay(os.getState(), TODAY)).toHaveLength(0);
  });

  it("includes tasks focused today", () => {
    const task = os.addTask({ title: "Write tests" }, TODAY);
    const made = os.startFocusSession({ startedAt: TODAY, taskId: task.id }, TODAY);
    os.store.update("focusSessions", made.id, { activeMs: 30 * 60_000, status: "completed" });

    const rows = focusTasksForDay(os.getState(), TODAY);
    expect(rows[0]?.title).toBe("Write tests");
    expect(rows[0]?.focusedMin).toBe(30);
  });

  it("includes tasks due today", () => {
    os.addTask({ title: "Due today", dueAt: TODAY + 3_600_000 }, TODAY);
    expect(focusTasksForDay(os.getState(), TODAY).map((row) => row.title)).toContain("Due today");
  });

  it("excludes tasks due on other days", () => {
    os.addTask({ title: "Due tomorrow", dueAt: TODAY + 3 * DAY }, TODAY);
    expect(focusTasksForDay(os.getState(), TODAY)).toHaveLength(0);
  });

  it("puts unfinished work before finished work", () => {
    os.addTask({ title: "Done thing", status: "done", dueAt: TODAY + 3_600_000 }, TODAY);
    os.addTask({ title: "Open thing", dueAt: TODAY + 3_600_000 }, TODAY);

    const rows = focusTasksForDay(os.getState(), TODAY);
    expect(rows).toHaveLength(2);
    expect(rows[rows.length - 1]?.done).toBe(true);
  });

  it("sorts by priority within unfinished work", () => {
    os.addTask({ title: "Low", priority: 1, dueAt: TODAY + 3_600_000 }, TODAY);
    os.addTask({ title: "High", priority: 3, dueAt: TODAY + 3_600_000 }, TODAY);

    const rows = focusTasksForDay(os.getState(), TODAY);
    expect(rows[0]?.title).toBe("High");
  });

  it("carries the estimate as planned minutes", () => {
    os.addTask({ title: "Planned", estimateMin: 45, dueAt: TODAY + 3_600_000 }, TODAY);
    expect(focusTasksForDay(os.getState(), TODAY)[0]?.plannedMin).toBe(45);
  });
});

describe("focus breakdown today", () => {
  it("is empty with no sessions today", () => {
    expect(focusBreakdownToday(os.getState(), TODAY)).toHaveLength(0);
  });

  it("classifies a long untargeted session as deep work", () => {
    session(0, 50);
    expect(focusBreakdownToday(os.getState(), TODAY)[0]?.kind).toBe("deep");
  });

  it("classifies a task session as task work", () => {
    const task = os.addTask({ title: "Ship it" }, TODAY);
    const made = os.startFocusSession({ startedAt: TODAY, taskId: task.id }, TODAY);
    os.store.update("focusSessions", made.id, { activeMs: 20 * 60_000, status: "completed" });

    expect(focusBreakdownToday(os.getState(), TODAY)[0]?.kind).toBe("task");
  });

  it("classifies a goal-only session as planning", () => {
    const goal = os.addGoal({ title: "Plan the quarter" }, TODAY);
    const made = os.startFocusSession({ startedAt: TODAY, goalId: goal.id }, TODAY);
    os.store.update("focusSessions", made.id, { activeMs: 20 * 60_000, status: "completed" });

    expect(focusBreakdownToday(os.getState(), TODAY)[0]?.kind).toBe("planning");
  });

  it("classifies study-tagged task work", () => {
    const task = os.addTask({ title: "Read course", tags: ["study"] }, TODAY);
    const made = os.startFocusSession({ startedAt: TODAY, taskId: task.id }, TODAY);
    os.store.update("focusSessions", made.id, { activeMs: 20 * 60_000, status: "completed" });

    expect(focusBreakdownToday(os.getState(), TODAY)[0]?.kind).toBe("study");
  });

  it("sums minutes across sessions of the same kind", () => {
    const task = os.addTask({ title: "Ship it" }, TODAY);
    for (const index of [0, 1]) {
      const made = os.startFocusSession({ startedAt: TODAY - index * 3_600_000, taskId: task.id }, TODAY);
      os.store.update("focusSessions", made.id, { activeMs: 20 * 60_000, status: "completed" });
    }
    expect(focusBreakdownToday(os.getState(), TODAY)[0]?.minutes).toBe(40);
  });

  it("ignores yesterday's sessions", () => {
    session(1, 50);
    expect(focusBreakdownToday(os.getState(), TODAY)).toHaveLength(0);
  });
});