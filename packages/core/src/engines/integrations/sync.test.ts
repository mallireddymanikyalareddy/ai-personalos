import { describe, expect, it } from "vitest";

import { createIntegration } from "../../types/integration";
import type { ExternalChangeSet, ExternalItem } from "./adapter";
import {
  buildSyncLog,
  buildSyncPlan,
  conflictBreakdown,
  finishSyncLog,
  mapItemToEvent,
  mapItemToNote,
  pendingConflicts,
  pendingResponseEmail,
  planSummary,
  resolutionKeepsLocal,
  responseTaskInput,
  shouldAutoResolve,
} from "./sync";

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();

function integration() {
  return createIntegration(
    {
      provider: "google_calendar",
      kind: "calendar",
      credentialRef: "vault/ref",
      direction: "inbound",
    },
    NOW,
  );
}

function noteItem(
  externalId: string,
  overrides: { lastModified?: number | null; deleted?: boolean; title?: string } = {},
): ExternalItem {
  return {
    externalId,
    etag: null,
    lastModified: overrides.lastModified ?? null,
    deleted: overrides.deleted ?? false,
    payload: {
      title: overrides.title ?? `File ${externalId}`,
      mimeType: "application/pdf",
      size: 2048,
      webViewLink: `https://drive.google.com/file/d/${externalId}`,
    },
  };
}

function eventItem(
  externalId: string,
  overrides: { startsAt?: number; endsAt?: number; lastModified?: number | null; deleted?: boolean; title?: string } = {},
): ExternalItem {
  return {
    externalId,
    etag: null,
    lastModified: overrides.lastModified ?? null,
    deleted: overrides.deleted ?? false,
    payload: {
      title: overrides.title ?? `Event ${externalId}`,
      startsAt: overrides.startsAt ?? Date.parse("2026-10-16T09:00:00Z"),
      endsAt: overrides.endsAt ?? Date.parse("2026-10-16T10:00:00Z"),
      allDay: false,
      notes: "",
      location: "",
      attendees: ["a@example.com"],
    },
  };
}

describe("sync: mapping external items into app inputs", () => {
  it("maps an event into an integration sourced event input", () => {
    const input = mapItemToEvent(eventItem("e-1", { title: "Dentist" }), "cal-1", NOW);
    expect(input.title).toBe("Dentist");
    expect(input.source).toBe("integration");
    expect(input.calendarId).toBe("cal-1");
    expect(input.allDay).toBe(false);
    expect(input.startsAt).toBe(Date.parse("2026-10-16T09:00:00Z"));
  });

  it("defaults missing times to a half hour slot from now", () => {
    const input = mapItemToEvent(
      { externalId: "x", etag: null, lastModified: null, deleted: false, payload: { title: "Empty" } },
      null,
      NOW,
    );
    expect(input.startsAt).toBe(NOW);
    expect(input.endsAt).toBe(NOW + 30 * 60_000);
    expect(input.location).toBe("");
  });

  it("maps a Drive file into an integration sourced note", () => {
    const note = mapItemToNote(
      {
        externalId: "f-1",
        etag: null,
        lastModified: Date.parse("2026-10-02T09:00:00Z"),
        deleted: false,
        payload: {
          title: "Contract.pdf",
          mimeType: "application/pdf",
          size: 2048,
          webViewLink: "https://drive.google.com/file/d/f1",
        },
      },
      "folder-1",
    );

    expect(note.source).toBe("integration");
    expect(note.tags).toContain("google-drive");
    expect(note.folderId).toBe("folder-1");
    expect(note.body).toContain("2.0 KB");
    expect(note.body).toContain("application/pdf");
  });

  it("treats items with a mime type as documents", () => {
    const mapped = mapItemToEvent(eventItem("e-2"), null, NOW);
    expect(mapped.source).toBe("integration");
  });
});

describe("sync: response follow-up rule", () => {
  it("finds the attendee that has not responded", () => {
    const item: ExternalItem = {
      externalId: "e-1",
      etag: null,
      lastModified: null,
      deleted: false,
      payload: {
        title: "Design review",
        startsAt: NOW + 7_200_000,
        attendeeResponses: [
          { email: "lead@example.com", status: "accepted" },
          { email: "me@example.com", status: "needsAction" },
        ],
      },
    };

    expect(pendingResponseEmail(item)).toBe("me@example.com");
  });

  it("returns null when everyone answered", () => {
    const item: ExternalItem = {
      externalId: "e-1",
      etag: null,
      lastModified: null,
      deleted: false,
      payload: { title: "Design review", attendeeResponses: [{ email: "me@example.com", status: "accepted" }] },
    };
    expect(pendingResponseEmail(item)).toBeNull();
  });

  it("suggests a task titled after the event with the event as the deadline", () => {
    const task = responseTaskInput(eventItem("e-3", { title: "Board sync", startsAt: NOW + 86_400_000 }), NOW);
    expect(task.title).toBe("Respond to Board sync");
    expect(task.dueAt).toBe(NOW + 86_400_000);
    expect(task.priority).toBe(2);
  });
});

describe("sync: plan building", () => {
  it("plans creates for events the app has never seen", () => {
    const plan = buildSyncPlan({
      integration: integration(),
      changes: { items: [eventItem("new-1")], nextSyncToken: null },
      local: [],
      calendarId: "cal-1",
      folderId: null,
      now: NOW,
    });

    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0].entityType).toBe("event");
    expect(plan.creates[0].create).toMatchObject({ title: "Event new-1", source: "integration" });
    expect(planSummary(plan)).toBe("1 new");
  });

  it("plans an update when the remote copy is newer", () => {
    const plan = buildSyncPlan({
      integration: integration(),
      changes: { items: [eventItem("r-1", { lastModified: NOW })], nextSyncToken: null },
      local: [{ entityType: "event", entityId: "local-1", externalId: "r-1", updatedAt: NOW - 1_000, deletedAt: null }],
      calendarId: "cal-1",
      folderId: null,
      now: NOW,
    });

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].entityType).toBe("event");
    expect(plan.updates[0].entityId).toBe("local-1");
    expect(plan.updates[0].patch).toMatchObject({ title: "Event r-1" });
    expect(plan.conflicts).toHaveLength(0);
  });

  it("keeps the entity type when a note changes remotely", () => {
    const plan = buildSyncPlan({
      integration: integration(),
      changes: { items: [noteItem("n-1", { lastModified: NOW, title: "Updated brief" })], nextSyncToken: null },
      local: [{ entityType: "note", entityId: "note-1", externalId: "n-1", updatedAt: NOW - 1_000, deletedAt: null }],
      calendarId: null,
      folderId: "folder-1",
      now: NOW,
    });

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].entityType).toBe("note");
    expect(plan.updates[0].entityId).toBe("note-1");
    expect(plan.updates[0].patch).toMatchObject({ title: "Updated brief" });
  });

  it("plans a conflict when the local copy is newer", () => {
    const plan = buildSyncPlan({
      integration: integration(),
      changes: { items: [eventItem("c-1", { lastModified: NOW - 5_000 })], nextSyncToken: null },
      local: [{ entityType: "event", entityId: "local-1", externalId: "c-1", updatedAt: NOW, deletedAt: null }],
      calendarId: "cal-1",
      folderId: null,
      now: NOW,
    });

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].kind).toBe("event_time");
    expect(plan.conflicts[0].localValue.updatedAt).toBe(NOW);
    expect(plan.conflicts[0].remoteValue.title).toBe("Event c-1");
    expect(plan.updates).toHaveLength(0);
    expect(conflictBreakdown(plan.conflicts).event_time).toBe(1);
  });

  it("ignores items with no newer marker either way", () => {
    const plan = buildSyncPlan({
      integration: integration(),
      changes: { items: [eventItem("s-1", { lastModified: NOW })], nextSyncToken: null },
      local: [{ entityType: "event", entityId: "local-1", externalId: "s-1", updatedAt: NOW, deletedAt: null }],
      calendarId: "cal-1",
      folderId: null,
      now: NOW,
    });
    expect(plan.updates).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("plans a delete for a remote removal and skips already deleted entities", () => {
    const removed = eventItem("d-1", { deleted: true });
    const alreadyGone = eventItem("d-2", { deleted: true });
    const plan = buildSyncPlan({
      integration: integration(),
      changes: { items: [removed, alreadyGone], nextSyncToken: null },
      local: [
        { entityType: "event", entityId: "local-1", externalId: "d-1", updatedAt: NOW, deletedAt: null },
        { entityType: "event", entityId: "local-2", externalId: "d-2", updatedAt: NOW, deletedAt: NOW - 10 },
      ],
      calendarId: "cal-1",
      folderId: null,
      now: NOW,
    });

    expect(plan.deletes).toHaveLength(1);
    expect(plan.deletes[0].entityType).toBe("event");
    expect(plan.deletes[0].entityId).toBe("local-1");
  });

  it("keeps the note entity type when a remote file is removed", () => {
    const plan = buildSyncPlan({
      integration: integration(),
      changes: { items: [noteItem("n-2", { deleted: true })], nextSyncToken: null },
      local: [{ entityType: "note", entityId: "note-2", externalId: "n-2", updatedAt: NOW, deletedAt: null }],
      calendarId: null,
      folderId: "folder-1",
      now: NOW,
    });

    expect(plan.deletes).toHaveLength(1);
    expect(plan.deletes[0].entityType).toBe("note");
    expect(plan.deletes[0].entityId).toBe("note-2");
  });
});

describe("sync: conflict resolution", () => {
  it("honours the configured strategy", () => {
    expect(shouldAutoResolve("local_wins", 100, 200)).toBe("local_wins");
    expect(shouldAutoResolve("remote_wins", 100, 200)).toBe("remote_wins");
    expect(shouldAutoResolve("newer_wins", 100, 200)).toBe("remote_wins");
    expect(shouldAutoResolve("newer_wins", 300, 200)).toBe("local_wins");
    expect(shouldAutoResolve("newer_wins", 100, null)).toBe("local_wins");
    expect(shouldAutoResolve("manual", 100, 200)).toBeNull();
  });

  it("keeps the local copy unless the remote wins", () => {
    expect(resolutionKeepsLocal("remote_wins")).toBe(false);
    expect(resolutionKeepsLocal("local_wins")).toBe(true);
    expect(resolutionKeepsLocal("ignore")).toBe(true);
  });

  it("counts pending conflicts from OS state", () => {
    const conflict = { id: "c1", status: "pending" } as never;
    const resolved = { id: "c2", status: "resolved" } as never;
    expect(pendingConflicts({ syncConflicts: { c1: conflict, c2: resolved } })).toHaveLength(1);
  });
});

describe("sync: log building", () => {
  it("builds a log and marks it partial when conflicts remain", () => {
    const log = buildSyncLog({
      integrationId: "int-1",
      direction: "inbound",
      status: "success",
      created: 2,
      updated: 1,
      removed: 0,
      conflicts: 1,
      now: NOW,
    });

    expect(log.itemsCreated).toBe(2);
    expect(log.conflictsFound).toBe(1);
    expect(finishSyncLog(log, NOW + 1_200).status).toBe("partial");
    expect(finishSyncLog(log, NOW + 1_200).durationMs).toBe(1_200);
  });

  it("stays success with no conflicts", () => {
    const log = buildSyncLog({
      integrationId: "int-1",
      direction: "inbound",
      status: "success",
      created: 1,
      updated: 0,
      removed: 0,
      conflicts: 0,
      now: NOW,
    });
    expect(finishSyncLog(log, NOW).status).toBe("success");
  });
});
