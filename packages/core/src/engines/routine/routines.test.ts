import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

function day(y: number, mo: number, d: number): number {
  return new Date(y, mo - 1, d, 12, 0, 0, 0).getTime();
}

describe("routine engines", () => {
  it("creates and lists an active routine", () => {
    const os = makeOS();
    os.addRoutine({ title: "Morning", slot: "morning", steps: [{ title: "Read", taskId: null, habitId: null, durationMin: 10 }] });

    expect(os.routinesFor()).toHaveLength(1);
    expect(os.routinesFor("morning")).toHaveLength(1);
    expect(os.routinesFor("evening")).toHaveLength(0);
  });

  it("resolves habit steps to tasks and materializes occurrence tasks", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Stretch", cadence: "daily" });
    const routine = os.addRoutine({
      title: "Morning",
      steps: [{ title: "", taskId: null, habitId: habit.id, durationMin: 5 }],
    });
    const monday = day(2026, 10, 5);

    const items = os.materializeRoutine(routine.id, monday);
    expect(items).toHaveLength(1);
    expect(items[0]!.habitId).toBe(habit.id);
    expect(items[0]!.taskId).not.toBeNull();
    expect(items[0]!.title).toBe("Stretch");
  });

  it("tracks completion for the day", () => {
    const os = makeOS();
    const routine = os.addRoutine({
      title: "Morning",
      steps: [
        { title: "Brush teeth", taskId: null, habitId: null, durationMin: 2 },
        { title: "Make bed", taskId: null, habitId: null, durationMin: 1 },
      ],
    });
    const monday = day(2026, 10, 5);
    const taskIds = os
      .materializeRoutine(routine.id, monday)
      .map((item) => item.taskId)
      .filter((id): id is string => id != null);

    expect(taskIds).toHaveLength(2);
    expect(os.routineCompleteOn(routine.id, monday)).toBe(false);

    for (const taskId of taskIds) os.completeTask(taskId, monday);
    expect(os.routineCompleteOn(routine.id, monday)).toBe(true);
    expect(os.routineStatsFor(routine.id, monday)?.doneToday).toBe(2);

    const nextDay = monday + 86_400_000;
    expect(os.routineCompleteOn(routine.id, nextDay)).toBe(false);
  });

  it("materializes habit occurrence tasks for all due routines", () => {
    const os = makeOS();
    const habit = os.addHabit({ title: "Journal", cadence: "daily" });
    os.addRoutine({ title: "Evening", steps: [{ title: "", taskId: null, habitId: habit.id, durationMin: 5 }] });
    const monday = day(2026, 10, 5);

    const created = os.ensureRoutineTasks(monday);
    expect(created).toBe(1);
    expect(os.ensureRoutineTasks(monday)).toBe(0);
  });

  it("unlinks tasks when a routine is deleted", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Water plants", status: "open" });
    const routine = os.addRoutine({
      title: "Garden",
      steps: [{ title: "", taskId: task.id, habitId: null, durationMin: 5 }],
    });
    os.updateTask(task.id, { routineId: routine.id });

    os.deleteRoutine(routine.id);

    expect(os.getTask(task.id)?.routineId).toBeNull();
    expect(os.routinesFor()).toHaveLength(0);
  });
});
describe("Routine due-day guards", () => {
  it("does not materialize a routine on a day it is not due", () => {
    const os = makeOS();
    const monday = new Date(2026, 0, 5, 0, 0, 0, 0).getTime();
    const tuesday = monday + 86_400_000;
    const routine = os.addRoutine(
      {
        title: "Weekly review",
        cadence: "weekly",
        daysOfWeek: [0],
        steps: [{ title: "Review the week", taskId: null, habitId: null, durationMin: 20 }],
      },
      monday,
    );

    expect(os.materializeRoutine(routine.id, tuesday)).toHaveLength(0);
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
    expect(os.materializeRoutine(routine.id, monday)).toHaveLength(1);
  });
});