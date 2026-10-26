import { describe, expect, it } from "vitest";
import { parseCapture } from "./capture-parser";

const now = new Date(2026, 9, 8, 14, 0, 0, 0).getTime();

describe("parseCapture", () => {
  it("parses a plain task", () => {
    const result = parseCapture("Buy groceries", { now });
    expect(result.intent).toBe("task");
    expect(result.title).toBe("Buy groceries");
    expect(result.dueAt).toBeNull();
    expect(result.priority).toBe(0);
    expect(result.tags).toEqual([]);
    expect(result.durationMin).toBeNull();
  });

  it("parses tomorrow", () => {
    const result = parseCapture("Pay rent tomorrow", { now });
    expect(result.title).toBe("Pay rent");
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 0, 0, 0, 0).getTime());
    expect(result.hasExplicitTime).toBe(false);
  });

  it("parses today", () => {
    const result = parseCapture("Reply today", { now });
    expect(result.title).toBe("Reply");
    expect(result.dueAt).toBe(new Date(2026, 9, 8, 0, 0, 0, 0).getTime());
  });

  it("parses weekday with time", () => {
    const result = parseCapture("Send report friday at 5pm", { now });
    expect(result.title).toBe("Send report");
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 17, 0, 0, 0).getTime());
    expect(result.hasExplicitTime).toBe(true);
  });

  it("parses bare afternoon time as today when still ahead", () => {
    const result = parseCapture("Call mom at 3pm", { now });
    expect(result.title).toBe("Call mom");
    expect(result.dueAt).toBe(new Date(2026, 9, 8, 15, 0, 0, 0).getTime());
  });

  it("rolls a past time to tomorrow", () => {
    const result = parseCapture("Call mom at 8am", { now });
    expect(result.title).toBe("Call mom");
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 8, 0, 0, 0).getTime());
  });

  it("reads bare 'at 5' as 5 pm", () => {
    const result = parseCapture("Meet at 5", { now });
    expect(result.title).toBe("Meet");
    expect(result.dueAt).toBe(new Date(2026, 9, 8, 17, 0, 0, 0).getTime());
  });

  it("parses 24-hour times", () => {
    const result = parseCapture("Review at 18:30 tomorrow", { now });
    expect(result.title).toBe("Review");
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 18, 30, 0, 0).getTime());
  });

  it("parses bang priorities", () => {
    expect(parseCapture("! file taxes", { now }).priority).toBe(3);
    expect(parseCapture("!! ship release", { now }).priority).toBe(4);
    expect(parseCapture("!! ship release", { now }).title).toBe("ship release");
  });

  it("parses explicit priority tokens", () => {
    expect(parseCapture("p2 write docs", { now }).priority).toBe(2);
    const none = parseCapture("p0 nice to have", { now });
    expect(none.priority).toBe(0);
    expect(none.title).toBe("nice to have");
  });

  it("extracts hashtags", () => {
    const result = parseCapture("Email #work about #Q4 plan", { now });
    expect(result.title).toBe("Email about plan");
    expect(result.tags).toEqual(["work", "q4"]);
  });

  it("keeps numeric hashtags in the title", () => {
    const result = parseCapture("Fix issue #42 today", { now });
    expect(result.title).toBe("Fix issue #42");
    expect(result.tags).toEqual([]);
    expect(result.dueAt).toBe(new Date(2026, 9, 8, 0, 0, 0, 0).getTime());
  });

  it("does not treat C# as a tag", () => {
    const result = parseCapture("Learn C# generics", { now });
    expect(result.title).toBe("Learn C# generics");
    expect(result.tags).toEqual([]);
  });

  it("parses durations", () => {
    const result = parseCapture("Workout for 45m tomorrow", { now });
    expect(result.title).toBe("Workout");
    expect(result.durationMin).toBe(45);
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 0, 0, 0, 0).getTime());
  });

  it("parses relative hours as datetime", () => {
    const result = parseCapture("Standup in 3 hours", { now });
    expect(result.title).toBe("Standup");
    expect(result.dueAt).toBe(now + 3 * 3_600_000);
    expect(result.hasExplicitTime).toBe(true);
  });

  it("parses ISO dates", () => {
    const result = parseCapture("Dentist 2026-11-15", { now });
    expect(result.title).toBe("Dentist");
    expect(result.dueAt).toBe(new Date(2026, 10, 15, 0, 0, 0, 0).getTime());
  });

  it("parses next week", () => {
    const result = parseCapture("Plan next week", { now });
    expect(result.title).toBe("Plan");
    expect(result.dueAt).toBe(new Date(2026, 9, 15, 0, 0, 0, 0).getTime());
  });

  it("handles uppercase input", () => {
    const result = parseCapture("BUY MILK TOMORROW", { now });
    expect(result.title).toBe("BUY MILK");
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 0, 0, 0, 0).getTime());
  });

  it("treats multiline input as a note", () => {
    const result = parseCapture("Book ideas\n1. Deep Work\n2. Zero to One", { now });
    expect(result.intent).toBe("note");
    expect(result.title).toBe("Book ideas");
    expect(result.noteBody).toBe("1. Deep Work\n2. Zero to One");
  });

  it("treats the note: prefix as a note", () => {
    const result = parseCapture("note: remember the migration plan", { now });
    expect(result.intent).toBe("note");
    expect(result.title).toBe("remember the migration plan");
    expect(result.dueAt).toBeNull();
  });

  it("returns an empty result for blank input", () => {
    const result = parseCapture("   ", { now });
    expect(result.title).toBe("");
    expect(result.dueAt).toBeNull();
  });

  it("combines multiple signals", () => {
    const result = parseCapture("Call mom friday at 5pm for 20m #family !!", { now });
    expect(result.title).toBe("Call mom");
    expect(result.dueAt).toBe(new Date(2026, 9, 9, 17, 0, 0, 0).getTime());
    expect(result.durationMin).toBe(20);
    expect(result.tags).toEqual(["family"]);
    expect(result.priority).toBe(4);
  });
});
