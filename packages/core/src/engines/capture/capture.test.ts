import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { resolveCapture, type ResolveCaptureOptions } from "./resolver";
import { findDuplicate, findRecentCapture, normalizeTitle } from "./dedupe";
import type { CaptureAttachment } from "../../types/capture";
import type { Note, Task } from "../../types";

const now = new Date(2026, 9, 8, 14, 0, 0, 0).getTime();

function makeOS(): PersonalOS {
  return new PersonalOS({ storage: null });
}

function draft(
  input: string,
  options: { mode?: ResolveCaptureOptions["mode"]; source?: "text" | "voice" | "image" | "camera" | "document"; attachments?: CaptureAttachment[] } = {},
) {
  const resolved = resolveCapture(input, { now, mode: options.mode });
  return {
    ...resolved,
    raw: resolved.raw,
    mode: resolved.mode,
    source: options.source ?? "text",
    attachments: options.attachments ?? [],
  };
}

describe("normalizeTitle", () => {
  it("normalizes case, punctuation and whitespace", () => {
    expect(normalizeTitle("  Call  John!  ")).toBe("call john");
  });
});

describe("findDuplicate", () => {
  it("finds an exact duplicate task", () => {
    const os = makeOS();
    os.addTask({ title: "Buy milk" });
    const state = os.getState();
    expect(findDuplicate(state, "task", "Buy milk").duplicate).toBe(true);
    expect(findDuplicate(state, "task", "buy   milk!").duplicate).toBe(true);
  });

  it("does not flag distinct tasks", () => {
    const os = makeOS();
    os.addTask({ title: "Buy milk" });
    expect(findDuplicate(os.getState(), "task", "Buy oat milk").duplicate).toBe(false);
  });

  it("finds a fuzzy duplicate for longer titles", () => {
    const os = makeOS();
    os.addTask({ title: "Schedule performance review with manager" });
    const lookup = findDuplicate(os.getState(), "task", "Schedule performance review with the manager");
    expect(lookup.duplicate).toBe(true);
  });
});

describe("findRecentCapture", () => {
  it("flags a quick double tap of the same raw text", () => {
    const os = makeOS();
    os.captureDraft(draft("Call John tomorrow at 3 PM"), now);
    const recent = findRecentCapture(os.getState(), "Call John tomorrow at 3 PM", now);
    expect(recent).not.toBeNull();
    expect(findRecentCapture(os.getState(), "Different thing", now)).toBeNull();
  });
});

describe("PersonalOS.captureDraft", () => {
  it("creates a task and preserves the raw input in the capture log", () => {
    const os = makeOS();
    const out = os.captureDraft(draft("Pay rent tomorrow"), now);
    expect(out.status).toBe("created");
    expect(out.entityType).toBe("task");
    const task = out.entity as Task;
    expect(task.status).toBe("open");
    expect(task.dueAt).toBe(new Date(2026, 9, 9, 0, 0, 0, 0).getTime());
    expect(task.source).toBe("capture");
    const log = out.log!;
    expect(log.raw).toBe("Pay rent tomorrow");
    expect(log.entityType).toBe("task");
    expect(log.entityId).toBe(task.id);
    expect(log.status).toBe("created");
    expect(log.mode).toBe("ai");
    expect(Object.keys(os.getState().captures)).toHaveLength(1);
  });

  it("routes an image capture to a note with an attachment", () => {
    const os = makeOS();
    const attachment: CaptureAttachment = {
      id: "att_img",
      name: "photo.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      kind: "image",
      url: "blob:photo",
    };
    const out = os.captureDraft(
      draft("Receipt from grocery run", { mode: "image", source: "camera", attachments: [attachment] }),
      now,
    );
    expect(out.status).toBe("created");
    expect(out.entityType).toBe("note");
    const note = out.entity as Note;
    expect(note.type).toBe("note");
    const stored = Object.values(os.getState().attachments)[0];
    expect(stored.ownerType).toBe("note");
    expect(stored.ownerId).toBe(note.id);
    expect(stored.mimeType).toBe("image/png");
    expect(out.log!.attachments[0].name).toBe("photo.png");
  });

  it("routes a voice capture to a recording", () => {
    const os = makeOS();
    const out = os.captureDraft(draft("Voice memo", { mode: "voice", source: "voice" }), now);
    expect(out.status).toBe("created");
    expect(out.entityType).toBe("recording");
    expect(out.entity!.type).toBe("recording");
  });

  it("routes a document capture to a document entity with attachment", () => {
    const os = makeOS();
    const attachment: CaptureAttachment = {
      id: "att_doc",
      name: "contract.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8192,
      kind: "document",
      url: null,
    };
    const out = os.captureDraft(
      draft("Signed contract", { mode: "document", source: "document", attachments: [attachment] }),
      now,
    );
    expect(out.entityType).toBe("document");
    const doc = out.entity as { attachmentId: string; status: string };
    expect(doc.attachmentId).not.toBeNull();
    expect(doc.status).toBe("ready");
  });

  it("routes a goal capture with a horizon derived from the due date", () => {
    const os = makeOS();
    const out = os.captureDraft(draft("I want to run a 10k in 2 months", { mode: "goal" }), now);
    expect(out.entityType).toBe("goal");
    const goal = out.entity as { horizon: string };
    expect(goal.horizon).toBe("quarter");
  });

  it("routes a habit capture with cadence", () => {
    const os = makeOS();
    const out = os.captureDraft(draft("Read every night before bed", { mode: "habit" }), now);
    expect(out.entityType).toBe("habit");
    const habit = out.entity as { cadence: string };
    expect(habit.cadence).toBe("daily");
  });

  it("routes an event capture using the resolved start time", () => {
    const os = makeOS();
    const out = os.captureDraft(draft("Dinner with parents friday at 7pm", { mode: "event" }), now);
    expect(out.entityType).toBe("event");
    const event = out.entity as { startsAt: number; endsAt: number };
    expect(event.startsAt).toBe(new Date(2026, 9, 9, 19, 0, 0, 0).getTime());
    expect(event.endsAt).toBe(new Date(2026, 9, 9, 20, 0, 0, 0).getTime());
  });

  it("routes a meeting capture", () => {
    const os = makeOS();
    const out = os.captureDraft(draft("1:1 with Alex tomorrow at 9am", { mode: "meeting" }), now);
    expect(out.entityType).toBe("meeting");
  });

  it("does not create a duplicate record for the same title", () => {
    const os = makeOS();
    os.addTask({ title: "Buy milk" });
    const first = os.captureDraft(draft("Buy milk", { mode: "task" }), now);
    expect(first.status).toBe("duplicate");
    expect(Object.keys(os.getState().tasks)).toHaveLength(1);
    expect(
      (first.log ?? { duplicateOfType: null }).duplicateOfType,
    ).toBe("task");
  });

  it("does not create duplicate records on a quick double capture", () => {
    const os = makeOS();
    const first = os.captureDraft(draft("Call John tomorrow at 3 PM"), now);
    const second = os.captureDraft(draft("Call John tomorrow at 3 PM"), now);
    expect(first.status).toBe("created");
    expect(second.status).toBe("duplicate");
    expect(Object.keys(os.getState().tasks)).toHaveLength(1);
    expect(Object.keys(os.getState().captures)).toHaveLength(1);
  });

  it("applies the active workspace mode to captured entities", () => {
    const os = makeOS();
    const task = os.captureDraft({ ...draft("Prepare the work brief", { mode: "task" }), workspaceMode: "work" }, now);
    const note = os.captureDraft({ ...draft("Work note", { mode: "note" }), workspaceMode: "work" }, now);
    const event = os.captureDraft({ ...draft("Work sync tomorrow at 9am", { mode: "event" }), workspaceMode: "work" }, now);

    expect((task.entity as Task).mode).toBe("work");
    expect((note.entity as Note).mode).toBe("work");
    expect((event.entity as { mode: string }).mode).toBe("work");
  });

  it("returns empty for blank captures without inserting anything", () => {
    const os = makeOS();
    const out = os.captureDraft(draft("   ", { mode: "task" }), now);
    expect(out.status).toBe("empty");
    expect(out.log).toBeNull();
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
    expect(Object.keys(os.getState().captures)).toHaveLength(0);
    expect(Object.keys(os.getState().notes)).toHaveLength(0);
    expect(Object.keys(os.getState().events)).toHaveLength(0);
  });
});
