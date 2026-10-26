import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";

const DAY = 86_400_000;

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

function day(y: number, mo: number, d: number): number {
  return new Date(y, mo - 1, d, 12, 0, 0, 0).getTime();
}

describe("habit engines", () => {
  it("syncs an occurrence task for a daily habit", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Meditate", cadence: "daily" });
    const monday = day(2026, 10, 5);
    const created = os.syncHabitTasks(monday);

    expect(created).toBe(1);
    const task = Object.values(os.getState().tasks).find((t) => t.habitId === habit.id);
    expect(task).toBeDefined();
    expect(task?.status).toBe("open");
    expect(task?.source).toBe("habit");
    expect(task?.dueAt).toBeLessThanOrEqual(monday);
  });

  it("does not duplicate occurrence tasks across syncs", () => {
    const os = makeOS();
    os.addHabit({ title: "Meditate", cadence: "daily" });
    const monday = day(2026, 10, 5);
    os.syncHabitTasks(monday);
    os.syncHabitTasks(monday);

    expect(Object.values(os.getState().tasks).filter((t) => t.source === "habit")).toHaveLength(1);
  });

  it("checks in and completes the occurrence task", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Meditate", cadence: "daily" });
    const monday = day(2026, 10, 5);
    os.syncHabitTasks(monday);

    const checkin = os.completeHabit(habit.id, monday);
    expect(checkin).not.toBeNull();
    expect(os.checkInsFor(habit.id)).toHaveLength(1);
    const task = Object.values(os.getState().tasks).find((t) => t.habitId === habit.id)!;
    expect(task.status).toBe("done");
    expect(task.completedAt).not.toBeNull();

    os.undoHabit(habit.id, monday);
    expect(os.checkInsFor(habit.id)).toHaveLength(0);
    expect(os.getTask(task.id)?.status).toBe("open");
  });

  it("is idempotent for the same day", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Meditate", cadence: "daily" });
    const monday = day(2026, 10, 5);
    os.completeHabit(habit.id, monday);
    os.completeHabit(habit.id, monday);

    expect(os.checkInsFor(habit.id)).toHaveLength(1);
  });

  it("counts consecutive met weeks as a streak", () => {
    const os = makeOS();
    const m0 = day(2026, 10, 5);
    const habit = os.addHabit({ title: "Deep work Sundays", cadence: "weekly", daysOfWeek: [0] }, m0);
    const m1 = m0 + 7 * DAY;
    const m2 = m1 + 7 * DAY;
    const m3 = m2 + 7 * DAY;

    os.completeHabit(habit.id, m0);
    os.completeHabit(habit.id, m1);
    os.completeHabit(habit.id, m2);

    const streaks = os.habitStreakFor(habit.id, m3)!;
    expect(streaks.current).toBe(3);
    expect(streaks.best).toBe(3);
  });

  it("counts the current streak back from the most recent period", () => {
    const os = makeOS();
    const monday = day(2026, 10, 5);
    const habit = os.addHabit({ title: "Read", cadence: "daily" }, monday);
    for (let back = 6; back >= 0; back -= 1) {
      os.completeHabit(habit.id, monday + back * DAY);
    }

    const streaks = os.habitStreakFor(habit.id, monday + 6 * DAY)!;
    expect(streaks.current).toBe(7);
    expect(streaks.best).toBe(7);
  });

  it("keeps the streak alive while today is still pending", () => {
    const os = makeOS();
    const monday = day(2026, 10, 5);
    const habit = os.addHabit({ title: "Read", cadence: "daily" }, monday);
    os.completeHabit(habit.id, monday);
    os.completeHabit(habit.id, monday + DAY);

    const streaks = os.habitStreakFor(habit.id, monday + 2 * DAY)!;
    expect(streaks.current).toBe(2);
  });

  it("reports stats for a daily habit", () => {
    const os = makeOS();
    const monday = day(2026, 10, 5);
    const habit = os.addHabit({ title: "Read", cadence: "daily" }, monday);
    os.completeHabit(habit.id, monday);
    os.completeHabit(habit.id, monday + DAY);

    const stats = os.habitStatsFor(habit.id, monday + 2 * DAY)!;
    expect(stats.totalCheckIns).toBe(2);
    expect(stats.currentStreak).toBe(2);
    expect(stats.completionRate).toBeGreaterThan(0);
    expect(stats.completionRate).toBeLessThanOrEqual(100);
  });

  it("is due on declared days of month", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Pay rent", cadence: "monthly", daysOfMonth: [1] });
    expect(os.habitDueOnDay(habit.id, day(2026, 10, 1))).toBe(true);
    expect(os.habitDueOnDay(habit.id, day(2026, 10, 15))).toBe(false);
    expect(os.habitDueOnDay(habit.id, day(2026, 10, 31))).toBe(false);
  });
});