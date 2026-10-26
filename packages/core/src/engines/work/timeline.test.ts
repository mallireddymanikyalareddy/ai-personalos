import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import {
  milestoneEnd,
  milestoneStart,
  spanPosition,
  timelineMonths,
  timelineRange,
  timelineSpans,
  todayPosition,
} from "./index";

const T0 = new Date(2026, 4, 10, 9, 0, 0, 0).getTime();
const DAY = 86_400_000;

let os: PersonalOS;
let projectId: string;

beforeEach(() => {
  os = new PersonalOS();
  projectId = os.addProject({ name: "MedoriQ" }, T0).id;
});

function milestone(title: string, dueInDays: number) {
  return os.addMilestone({ projectId, title, dueAt: T0 + dueInDays * DAY }, T0);
}

describe("milestone span bounds", () => {
  it("starts at creation when no task carries a date", () => {
    const m = milestone("Beta", 10);
    expect(milestoneStart(os.getState(), m)).toBe(new Date(T0).setHours(0, 0, 0, 0));
  });

  it("starts at the earliest dated task when a task predates the milestone", () => {
    const m = milestone("Beta", 20);
    os.addTask({ title: "Backdated", projectId, milestoneId: m.id, dueAt: T0 - 4 * DAY }, T0);
    os.addTask({ title: "Later", projectId, milestoneId: m.id, dueAt: T0 + 8 * DAY }, T0);
    expect(milestoneStart(os.getState(), m)).toBe(new Date(T0 - 4 * DAY).setHours(0, 0, 0, 0));
  });

  it("keeps creation as the start when tasks are dated later", () => {
    const m = milestone("Beta", 10);
    os.addTask({ title: "Sooner", projectId, milestoneId: m.id, dueAt: T0 + 2 * DAY }, T0);
    expect(milestoneStart(os.getState(), m)).toBe(new Date(T0).setHours(0, 0, 0, 0));
  });

  it("ends at the milestone due date when that is latest", () => {
    const m = milestone("Beta", 20);
    os.addTask({ title: "Early", projectId, milestoneId: m.id, dueAt: T0 + DAY }, T0);
    expect(milestoneEnd(os.getState(), m)).toBe(new Date(T0 + 20 * DAY).setHours(0, 0, 0, 0));
  });

  it("ends at the latest task date when it runs past the due date", () => {
    const m = milestone("Beta", 5);
    os.addTask({ title: "Slip", projectId, milestoneId: m.id, dueAt: T0 + 30 * DAY }, T0);
    expect(milestoneEnd(os.getState(), m)).toBe(new Date(T0 + 30 * DAY).setHours(0, 0, 0, 0));
  });

  it("never ends before it starts", () => {
    const m = milestone("Instant", 0);
    os.addTask({ title: "Backdated", projectId, milestoneId: m.id, dueAt: T0 - 5 * DAY }, T0);
    expect(milestoneEnd(os.getState(), m)).toBeGreaterThanOrEqual(milestoneStart(os.getState(), m));
  });
});

describe("timelineRange", () => {
  it("spans at least a month around today with no milestones", () => {
    const range = timelineRange(os.getState(), projectId, T0);
    expect(range.days).toBeGreaterThan(30);
    expect(range.start).toBeLessThan(T0);
    expect(range.end).toBeGreaterThan(T0);
  });

  it("grows to cover the widest milestone", () => {
    milestone("Far out", 120);
    const range = timelineRange(os.getState(), projectId, T0);
    expect(range.end).toBeGreaterThan(T0 + 120 * DAY);
  });

  it("pads both ends", () => {
    const range = timelineRange(os.getState(), projectId, T0, 7);
    expect(range.start).toBeLessThanOrEqual(new Date(T0).setHours(0, 0, 0, 0) - 7 * DAY);
  });
});

describe("timelineSpans", () => {
  it("is empty when the project has no milestones", () => {
    expect(timelineSpans(os.getState(), projectId, T0)).toHaveLength(0);
  });

  it("computes percent from completed tasks", () => {
    const m = milestone("Beta", 10);
    const a = os.addTask({ title: "a", projectId, milestoneId: m.id }, T0);
    os.addTask({ title: "b", projectId, milestoneId: m.id }, T0);
    os.updateTask(a.id, { status: "done" });

    const [span] = timelineSpans(os.getState(), projectId, T0);
    expect(span?.percent).toBe(50);
  });

  it("flags an overdue open milestone", () => {
    milestone("Slipping", -5);
    const [span] = timelineSpans(os.getState(), projectId, T0);
    expect(span?.overdue).toBe(true);
    expect(span?.complete).toBe(false);
  });

  it("does not flag a completed milestone as overdue", () => {
    const m = milestone("Shipped", -5);
    os.updateMilestone(m.id, { status: "completed", completedAt: T0 - 6 * DAY });
    const [span] = timelineSpans(os.getState(), projectId, T0);
    expect(span?.complete).toBe(true);
    expect(span?.overdue).toBe(false);
  });

  it("clamps a completed span to its completion date", () => {
    const m = milestone("Shipped", 20);
    os.updateMilestone(m.id, { status: "completed", completedAt: T0 + 2 * DAY });
    const [span] = timelineSpans(os.getState(), projectId, T0);
    expect(span?.end).toBeLessThanOrEqual(new Date(T0 + 3 * DAY).setHours(0, 0, 0, 0));
  });

  it("gives every span at least a day of width", () => {
    const m = milestone("Instant", 0);
    const [span] = timelineSpans(os.getState(), projectId, T0);
    expect(span!.end).toBeGreaterThan(span!.start);
  });
});

describe("spanPosition", () => {
  const range = { start: 0, end: 100, days: 100 };

  it("maps the first day to zero", () => {
    expect(spanPosition({ start: 0, end: 10 }, range).left).toBe(0);
  });

  it("maps the last day to the end", () => {
    const pos = spanPosition({ start: 90, end: 100 }, range);
    expect(pos.left).toBe(90);
    expect(pos.width).toBe(10);
  });

  it("never renders a zero-width bar", () => {
    expect(spanPosition({ start: 50, end: 50 }, range).width).toBeGreaterThan(0);
  });

  it("clamps beyond the range", () => {
    const pos = spanPosition({ start: -50, end: 500 }, range);
    expect(pos.left).toBeGreaterThanOrEqual(0);
    expect(pos.width).toBeGreaterThan(0);
    expect(pos.left + pos.width).toBeLessThanOrEqual(100.001);
  });

  it("keeps a bar inside the range when it starts early", () => {
    const pos = spanPosition({ start: -20, end: 30 }, range);
    expect(pos.left + pos.width).toBeLessThanOrEqual(100.001);
  });
});

describe("todayPosition", () => {
  it("places today inside the range", () => {
    const range = timelineRange(os.getState(), projectId, T0);
    const pct = todayPosition(range, T0);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});

describe("timelineMonths", () => {
  it("returns at least one month", () => {
    const months = timelineMonths(timelineRange(os.getState(), projectId, T0));
    expect(months.length).toBeGreaterThan(0);
    expect(months[0]?.label).toContain("2026");
  });

  it("orders months and keeps widths positive", () => {
    const months = timelineMonths(timelineRange(os.getState(), projectId, T0));
    for (let i = 1; i < months.length; i += 1) {
      expect(months[i]!.left).toBeGreaterThanOrEqual(months[i - 1]!.left);
      expect(months[i]!.width).toBeGreaterThan(0);
    }
  });
});