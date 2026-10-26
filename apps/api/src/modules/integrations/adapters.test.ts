import { describe, expect, it } from "vitest";

import {
  calendarPullUrl,
  cleanString,
  cleanTimestamp,
  driveFileToExternal,
  drivePullUrl,
  googleEventToExternal,
  outlookEventToExternal,
  parseProviderPayload,
  pullWindow,
} from "./adapters";

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();

describe("integration adapters: external item parsing", () => {
  it("parses Google events into canonical external items", () => {
    const item = googleEventToExternal({
      id: "evt-1",
      summary: " Standup ",
      status: "confirmed",
      updated: "2026-10-14T10:00:00.000Z",
      description: "Daily sync",
      location: "Room 4",
      attendees: [{ email: "a@example.com" }, { email: null }],
      start: { dateTime: "2026-10-16T09:00:00.000Z" },
      end: { dateTime: "2026-10-16T09:30:00.000Z" },
    })!;

    expect(item).not.toBeNull();
    expect(item.externalId).toBe("evt-1");
    expect(item.payload.title).toBe("Standup");
    expect(item.payload.startsAt).toBe(Date.parse("2026-10-16T09:00:00.000Z"));
    expect(item.payload.endsAt).toBe(Date.parse("2026-10-16T09:30:00.000Z"));
    expect(item.payload.location).toBe("Room 4");
    expect(item.payload.attendees).toEqual(["a@example.com"]);
    expect(item.lastModified).toBe(Date.parse("2026-10-14T10:00:00.000Z"));
    expect(item.deleted).toBe(false);
  });

  it("flags cancelled Google events as deleted", () => {
    const item = googleEventToExternal({
      id: "evt-2",
      status: "cancelled",
      start: { dateTime: "2026-10-16T09:00:00.000Z" },
    })!;
    expect(item.deleted).toBe(true);
  });

  it("supports all-day Google events", () => {
    const item = googleEventToExternal({
      id: "evt-3",
      start: { date: "2026-10-16" },
      end: { date: "2026-10-17" },
    })!;
    expect(item.payload.allDay).toBe(true);
    expect(item.payload.startsAt).toBe(new Date(2026, 9, 16, 9).getTime());
  });

  it("parses Outlook events including nested addresses and locations", () => {
    const item = outlookEventToExternal({
      id: "out-1",
      subject: "Review",
      lastModifiedDateTime: "2026-10-14T08:00:00Z",
      location: { displayName: "Huddle room" },
      body: { content: "Body text" },
      attendees: [{ emailAddress: { address: "b@example.com" } }],
      start: { dateTime: "2026-10-16T13:00:00Z", timeZone: "UTC" },
      end: { dateTime: "2026-10-16T14:00:00Z", timeZone: "UTC" },
    })!;

    expect(item.payload.title).toBe("Review");
    expect(item.payload.location).toBe("Huddle room");
    expect(item.payload.notes).toBe("Body text");
    expect(item.payload.attendees).toEqual(["b@example.com"]);
    expect(item.payload.startsAt).toBe(Date.parse("2026-10-16T13:00:00Z"));
  });

  it("parses Drive files and marks trashed ones deleted", () => {
    const items = parseProviderPayload("google_drive", {
      files: [
        { id: "f1", name: "Plan.pdf", mimeType: "application/pdf", size: 2048, modifiedTime: "2026-10-01T10:00:00Z" },
        { id: "f2", name: "Old.txt", mimeType: "text/plain", trashed: "true" },
        { id: null, name: "skipped" },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0].payload.title).toBe("Plan.pdf");
    expect(items[0].payload.extension).toBe("pdf");
    expect(items[0].payload.size).toBe(2048);
    expect(items[1].deleted).toBe(true);
  });

  it("routes calendar payload keys per provider", () => {
    const google = parseProviderPayload("google_calendar", {
      items: [{ id: "g1", summary: "G", start: { dateTime: "2026-10-16T09:00:00Z" } }],
    });
    const outlook = parseProviderPayload("outlook_calendar", {
      value: [{ id: "o1", subject: "O", start: { dateTime: "2026-10-16T09:00:00Z" } }],
    });

    expect(google.map((i) => i.externalId)).toEqual(["g1"]);
    expect(outlook.map((i) => i.externalId)).toEqual(["o1"]);
  });
});

describe("integration adapters: request shaping", () => {
  it("builds a Google pull URL inside the configured window", () => {
    const url = calendarPullUrl("google_calendar", { timeMin: "2026-10-01T00:00:00.000Z", timeMax: "2026-10-15T00:00:00.000Z" });
    expect(url).toContain("singleEvents=true");
    expect(url).toContain("timeMin=2026-10-01T00%3A00%3A00.000Z");
    expect(url).toContain("timeMax=2026-10-15T00%3A00%3A00.000Z");
  });

  it("builds an Outlook pull URL with the filter window", () => {
    const url = calendarPullUrl("outlook_calendar", { timeMin: "2026-10-01T00:00:00.000Z", timeMax: "2026-10-15T00:00:00.000Z" });
    expect(url).toContain("graph.microsoft.com");
    expect(url).toContain("startDateTime=2026-10-01T00%3A00%3A00.000Z");
    expect(url).toContain("endDateTime=2026-10-15T00%3A00%3A00.000Z");
  });

  it("requests the Drive file fields it needs", () => {
    const decoded = decodeURIComponent(drivePullUrl());
    expect(decoded).toContain("fields=files(id,name,mimeType,size,modifiedTime,md5Checksum,webViewLink,trashed)");
  });

  it("derives the window from the import range", () => {
    const window = pullWindow(NOW, 30);
    expect(Date.parse(window.timeMin)).toBe(NOW - 30 * 86_400_000);
    expect(Date.parse(window.timeMax)).toBe(NOW + 30 * 86_400_000);
  });

  it("normalises provider payload scalars", () => {
    expect(cleanString("  x  ")).toBe("x");
    expect(cleanString("   ")).toBeNull();
    expect(cleanString(5)).toBeNull();
    expect(cleanTimestamp(12)).toBe(12);
    expect(cleanTimestamp("2026-10-01T00:00:00Z")).toBe(Date.parse("2026-10-01T00:00:00Z"));
    expect(cleanTimestamp("nope")).toBeNull();
  });

  it("reads the Drive file extension from the name", () => {
    const item = driveFileToExternal({
      id: "f1",
      name: "Quarterly Report.PDF",
      mimeType: "application/pdf",
    })!;
    expect(item.payload.extension).toBe("pdf");
  });

  it("handles Drive files with no extension", () => {
    const item = driveFileToExternal({ id: "f2", name: "notes" })!;
    expect(item.payload.extension).toBeNull();
  });
});
