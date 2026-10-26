import { nextOccurrence, type CalendarEvent, type ID, type Timestamp } from "@personalos/core";

const MAX_OCCURRENCES = 400;
const MAX_SKIPS = 5000;

export function occurrenceKey(baseId: ID, ordinal: number): string {
  return `${baseId}::${ordinal}`;
}

export function baseEventId(id: ID): ID {
  const index = id.indexOf("::");
  return index === -1 ? id : id.slice(0, index);
}

export function isOccurrence(id: ID): boolean {
  return id.includes("::");
}

/**
 * Expands recurring events into concrete occurrences inside the visible window.
 * Non-recurring events pass through untouched.
 */
export function expandOccurrences(
  events: CalendarEvent[],
  from: Timestamp,
  to: Timestamp,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.recurrence) {
      out.push(event);
      continue;
    }

    const duration = Math.max(event.endsAt - event.startsAt, 1);
    let cursor = event.startsAt;
    let ordinal = event.recurrenceOrdinal > 0 ? event.recurrenceOrdinal : 1;
    let guard = 0;

    while (cursor + duration <= from && guard < MAX_SKIPS) {
      const next = nextOccurrence(event.recurrence, cursor, event.startsAt);
      if (next == null) break;
      cursor = next;
      ordinal += 1;
      guard += 1;
    }

    while (cursor <= to && guard < MAX_OCCURRENCES) {
      out.push({
        ...event,
        id: occurrenceKey(event.id, ordinal),
        startsAt: cursor,
        endsAt: cursor + duration,
        recurrenceOrdinal: ordinal,
      });
      const next = nextOccurrence(event.recurrence, cursor, event.startsAt);
      if (next == null) break;
      cursor = next;
      ordinal += 1;
      guard += 1;
    }
  }

  return out;
}
