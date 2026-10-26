import { describe, expect, it } from "vitest";
import { resolveCapture } from "./resolver";

const now = new Date(2026, 9, 8, 14, 0, 0, 0).getTime();

describe("resolveCapture", () => {
  it("resolves the reference example to a task", () => {
    const result = resolveCapture("I need to call John tomorrow at 3 PM", { now });
    expect(result.type).toBe("task");
    expect(result.title).toBe("Call John");
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 15, 0, 0, 0).getTime());
    expect(result.hasExplicitTime).toBe(true);
    expect(result.mode).toBe("ai");
    expect(result.raw).toBe("I need to call John tomorrow at 3 PM");
  });

  it("falls back to task for plain action phrases", () => {
    const result = resolveCapture("Buy groceries", { now });
    expect(result.type).toBe("task");
    expect(result.title).toBe("Buy groceries");
    expect(result.dueAt).toBeNull();
    expect(result.priority).toBe(0);
    expect(result.tags).toEqual([]);
  });

  it("uses the note: prefix to route to a note", () => {
    const result = resolveCapture("note: pick up the dry cleaning", { now });
    expect(result.type).toBe("note");
    expect(result.title).toBe("pick up the dry cleaning");
  });

  it("routes multiline input to a note", () => {
    const result = resolveCapture("Trip planning\n- flights\n- hotels", { now });
    expect(result.type).toBe("note");
    expect(result.body).toBe("- flights\n- hotels");
  });

  it("detects a meeting from people language", () => {
    const result = resolveCapture("Standup with the design team tomorrow at 9am", { now });
    expect(result.type).toBe("meeting");
    expect(result.startsAt).toBe(new Date(2026, 9, 9, 9, 0, 0, 0).getTime());
    expect(result.keySignals[0]).toMatch(/meeting/i);
  });

  it("detects an event from an appointment", () => {
    const result = resolveCapture("Doctor appointment on saturday at 10:30am", { now });
    expect(result.type).toBe("event");
    expect(result.startsAt).toBe(new Date(2026, 9, 10, 10, 30, 0, 0).getTime());
    expect(result.allDay).toBe(false);
  });

  it("detects a habit from cadence", () => {
    const result = resolveCapture("Meditate every morning at 7am", { now });
    expect(result.type).toBe("habit");
    expect(result.cadence).toBe("daily");
  });

  it("detects a goal from ambition phrasing", () => {
    const result = resolveCapture("I want to learn to play guitar in 3 months", { now });
    expect(result.type).toBe("goal");
    expect(result.goalHorizon).toBe("quarter");
    expect(result.dueAt).not.toBeNull();
  });

  it("honors forced modes", () => {
    const result = resolveCapture("Buy milk", { now, mode: "event" });
    expect(result.type).toBe("event");
    expect(result.mode).toBe("event");
    expect(result.confidence).toBe(1);
  });

  it("capitalizes stripped task preambles", () => {
    const result = resolveCapture("remind me to call the bank", { now });
    expect(result.type).toBe("task");
    expect(result.title).toBe("Call the bank");
  });

  it("extracts tags, priority and duration", () => {
    const result = resolveCapture("Submit report friday at 5pm for 1h #work p3", { now });
    expect(result.priority).toBe(3);
    expect(result.tags).toEqual(["work"]);
    expect(result.durationMin).toBe(60);
  });
});