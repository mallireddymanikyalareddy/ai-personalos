import { describe, expect, it } from "vitest";

import type { CalendarEvent, RecurrenceRule } from "@personalos/core";

import { baseEventId, expandOccurrences, isOccurrence, occurrenceKey } from "./calendar-occurrences";
import { eventsToIcs, parseIcs } from "./calendar-ics";

const HOUR = 3_600_000;
const DAY = 86_400_000;

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    type: "event",
    id: "event-1",
    createdAt: 0,
    updatedAt: 0,
    title: "Standup",
    notes: "",
    startsAt: 0,
    endsAt: HOUR,
    allDay: false,
    location: "",
    projectId: null,
    taskId: null,
    calendarId: null,
    source: "manual",
    attendees: [],
    categoryId: null,
    color: null,
    recurrence: null,
    recurrenceId: null,
    recurrenceOrdinal: 1,
    reminderIds: [],
    mode: "personal",
    sharedWith: [],
    ...overrides,
  };
}

describe("calendar occurrences", () => {
  it("passes non-recurring events through untouched", () => {
    const single = event();
    expect(expandOccurrences([single], 0, DAY)).toEqual([single]);
  });

  it("expands a daily rule across the window", () => {
    const daily: RecurrenceRule = { freq: "daily", interval: 1 };
    const recurring = event({ recurrence: daily, startsAt: 0, endsAt: HOUR });
    const occurrences = expandOccurrences([recurring], 0, 3 * DAY);

    expect(occurrences.map((entry) => entry.startsAt)).toEqual([0, DAY, 2 * DAY, 3 * DAY]);
    expect(occurrences.every((entry) => entry.endsAt - entry.startsAt === HOUR)).toBe(true);
    expect(occurrences[0]!.id).toBe(occurrenceKey("event-1", 1));
    expect(occurrences[2]!.id).toBe(occurrenceKey("event-1", 3));
  });

  it("skips occurrences before the window", () => {
    const daily: RecurrenceRule = { freq: "daily", interval: 1 };
    const recurring = event({ recurrence: daily, startsAt: 0, endsAt: HOUR });
    const occurrences = expandOccurrences([recurring], 5 * DAY, 6 * DAY);

    expect(occurrences.map((entry) => entry.startsAt)).toEqual([5 * DAY, 6 * DAY]);
  });

  it("stops when the rule runs out", () => {
    const daily: RecurrenceRule = { freq: "daily", interval: 1, count: 2 };
    const recurring = event({ recurrence: daily, startsAt: 0, endsAt: HOUR });
    const occurrences = expandOccurrences([recurring], 0, 10 * DAY);

    expect(occurrences).toHaveLength(2);
  });

  it("maps occurrence ids back to the base event", () => {
    const id = occurrenceKey("abc", 4);
    expect(isOccurrence(id)).toBe(true);
    expect(baseEventId(id)).toBe("abc");
    expect(baseEventId("plain")).toBe("plain");
    expect(isOccurrence("plain")).toBe(false);
  });
});

describe("ics export/import", () => {
  it("exports events and parses them back", () => {
    const start = new Date(2026, 4, 4, 9, 0, 0).getTime();
    const source = event({
      id: "ics-1",
      title: "Design review; part 1",
      location: "Room 4",
      notes: "Bring sketches",
      startsAt: start,
      endsAt: start + HOUR,
    });

    const text = eventsToIcs([source]);
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain("SUMMARY:Design review\\; part 1");

    const parsed = parseIcs(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.title).toBe("Design review; part 1");
    expect(parsed[0]!.location).toBe("Room 4");
    expect(parsed[0]!.startsAt).toBe(start);
    expect(parsed[0]!.endsAt).toBe(start + HOUR);
    expect(parsed[0]!.allDay).toBe(false);
  });

  it("imports all-day events from a VALUE=DATE stamp", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260504",
      "DTEND;VALUE=DATE:20260505",
      "SUMMARY:Holiday",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const parsed = parseIcs(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.allDay).toBe(true);
    expect(new Date(parsed[0]!.startsAt).getDate()).toBe(4);
    expect(new Date(parsed[0]!.endsAt).getDate()).toBe(5);
  });

  it("ignores malformed input", () => {
    expect(parseIcs("not a calendar")).toEqual([]);
  });
});
