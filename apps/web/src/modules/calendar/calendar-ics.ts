import type { CalendarEvent, Timestamp } from "@personalos/core";

export interface ParsedEvent {
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  allDay: boolean;
  location: string;
  notes: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toUtcStamp(ts: Timestamp): string {
  const date = new Date(ts);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = rest.slice(74);
  }
  chunks.push(rest);
  return chunks.join("\r\n ");
}

export function eventsToIcs(events: CalendarEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PersonalOS//Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@lifeos`);
    lines.push(`DTSTAMP:${toUtcStamp(event.updatedAt)}`);
    lines.push(`DTSTART:${toUtcStamp(event.startsAt)}`);
    lines.push(`DTEND:${toUtcStamp(event.endsAt)}`);
    lines.push(foldLine(`SUMMARY:${escapeText(event.title)}`));
    if (event.location) lines.push(foldLine(`LOCATION:${escapeText(event.location)}`));
    if (event.notes) lines.push(foldLine(`DESCRIPTION:${escapeText(event.notes)}`));
    if (event.allDay) lines.push("X-LIFEOS-ALLDAY:TRUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function parseStamp(value: string): Timestamp | null {
  const cleaned = value.trim().replace(/^VALUE=DATE[^:]*:/i, "").replace(/^[^:]*:/, "");
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(cleaned);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(cleaned);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zulu] = match;
  const parts = [Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)] as const;
  return zulu ? Date.UTC(...parts) : new Date(...parts).getTime();
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function readField(block: string, name: string): string {
  const lines = block.split(/\r?\n/);
  const collected: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (capturing) {
      if (/^[ \t]/.test(line)) {
        collected.push(line.slice(1));
        continue;
      }
      break;
    }
    if (line.toUpperCase().startsWith(`${name}:`) || line.toUpperCase().startsWith(`${name};`)) {
      capturing = true;
      collected.push(line);
    }
  }
  return collected.join("");
}

export function parseIcs(text: string): ParsedEvent[] {
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const events: ParsedEvent[] = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.split(/END:VEVENT/i)[0] ?? "";
    const startField = readField(block, "DTSTART");
    if (!startField) continue;
    const startsAt = parseStamp(startField);
    if (startsAt == null) continue;

    const endField = readField(block, "DTEND");
    const endsAt = endField ? parseStamp(endField) : null;

    const summaryField = readField(block, "SUMMARY");
    const title = unescapeText(summaryField.replace(/^SUMMARY[^:]*:/i, "")).trim() || "Imported event";

    const locationField = readField(block, "LOCATION");
    const location = unescapeText(locationField.replace(/^LOCATION[^:]*:/i, "")).trim();

    const descriptionField = readField(block, "DESCRIPTION");
    const notes = unescapeText(descriptionField.replace(/^DESCRIPTION[^:]*:/i, "")).trim();

    const allDay = /VALUE=DATE(?![-T])/i.test(startField) || /X-LIFEOS-ALLDAY:TRUE/i.test(block);
    const resolvedEnd = endsAt ?? startsAt + (allDay ? 86_400_000 : 3_600_000);

    events.push({
      title,
      startsAt,
      endsAt: Math.max(resolvedEnd, startsAt + 60_000),
      allDay,
      location,
      notes,
    });
  }

  return events;
}
