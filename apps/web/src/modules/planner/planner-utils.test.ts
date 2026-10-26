import { describe, expect, it, beforeEach } from "vitest";

import { addDays, startOfDay } from "@personalos/core";

import { getOS } from "@/store/os";

import {
  moveDroppedBlock,
  placeDroppedTask,
  type BlockDragData,
  type TaskDragData,
} from "./planner-utils";

const HOUR_MS = 3_600_000;

function tomorrowAt(hour: number): number {
  return startOfDay(addDays(Date.now(), 1)) + hour * HOUR_MS;
}

describe("planner drop utils", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
  });

  it("drops an unplanned task into a free slot as a manual block", () => {
    const os = getOS();
    const task = os.addTask({ title: "Write report" });
    const start = tomorrowAt(10);

    const result = placeDroppedTask(
      os,
      { taskId: task.id, title: task.title, estimateMin: 60, kind: "focus" } satisfies TaskDragData,
      start,
    );

    expect(result.ok).toBe(true);
    const block = Object.values(os.getState().timeBlocks)[0]!;
    expect(block.title).toBe("Write report");
    expect(block.startsAt).toBe(start);
    expect(block.endsAt).toBe(start + 60 * 60_000);
    expect(block.taskId).toBe(task.id);
    expect(block.source).toBe("manual");
    expect(os.getState().tasks[task.id]!.scheduledAt).toBe(start);
  });

  it("rejects a drop onto an already-booked time", () => {
    const os = getOS();
    const start = tomorrowAt(10);
    const event = os.addEvent({ title: "Standup", startsAt: start, endsAt: start + 60 * 60_000 });

    const result = placeDroppedTask(
      os,
      { taskId: null, title: "Ignored", estimateMin: 30, kind: "focus" },
      start,
    );

    expect(result.ok).toBe(false);
    expect(Object.values(os.getState().timeBlocks)).toHaveLength(0);
    expect(event.title).toBe("Standup");
  });

  it("rejects a drop into the past", () => {
    const os = getOS();
    const result = placeDroppedTask(
      os,
      { taskId: null, title: "Ignored", estimateMin: 30, kind: "focus" },
      Date.now() - HOUR_MS,
    );

    expect(result.ok).toBe(false);
    expect(Object.values(os.getState().timeBlocks)).toHaveLength(0);
  });

  it("moves an existing block and re-anchors its task", () => {
    const os = getOS();
    const task = os.addTask({ title: "Deep work" });
    const block = os.addTimeBlock({
      title: task.title,
      startsAt: tomorrowAt(10),
      endsAt: tomorrowAt(11),
      kind: "focus",
      taskId: task.id,
      source: "manual",
    });
    const newStart = tomorrowAt(14);

    const result = moveDroppedBlock(
      os,
      block.id satisfies BlockDragData["blockId"],
      newStart,
    );

    expect(result.ok).toBe(true);
    expect(os.getState().timeBlocks[block.id]!.startsAt).toBe(newStart);
    expect(os.getState().timeBlocks[block.id]!.endsAt).toBe(newStart + HOUR_MS);
    expect(os.getState().tasks[task.id]!.scheduledAt).toBe(newStart);
  });

  it("keeps a block in place when the move overlaps another booking", () => {
    const os = getOS();
    const task = os.addTask({ title: "Deep work" });
    const block = os.addTimeBlock({
      title: task.title,
      startsAt: tomorrowAt(10),
      endsAt: tomorrowAt(11),
      kind: "focus",
      taskId: task.id,
      source: "manual",
    });
    os.updateTask(task.id, { scheduledAt: tomorrowAt(10) });
    os.addTimeBlock({
      title: "Meeting",
      startsAt: tomorrowAt(14),
      endsAt: tomorrowAt(15),
      kind: "meeting",
      source: "manual",
    });

    const result = moveDroppedBlock(os, block.id, tomorrowAt(14));

    expect(result.ok).toBe(false);
    expect(os.getState().timeBlocks[block.id]!.startsAt).toBe(tomorrowAt(10));
    expect(os.getState().tasks[task.id]!.scheduledAt).toBe(tomorrowAt(10));
  });
});