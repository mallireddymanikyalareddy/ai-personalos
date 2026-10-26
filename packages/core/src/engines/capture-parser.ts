import { PRIORITY, type Priority, type Timestamp } from "../types/common";
import { addDays, HOUR_MS, nextWeekday, startOfDay } from "./date-utils";

export type CaptureIntent = "task" | "note";

export interface CaptureParseResult {
  raw: string;
  intent: CaptureIntent;
  title: string;
  noteBody: string | null;
  dueAt: Timestamp | null;
  hasExplicitTime: boolean;
  priority: Priority;
  tags: string[];
  durationMin: number | null;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  weds: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const DATE_RE =
  /\b(today|tomorrow|tmrw|tmr|next\s+week|in\s+\d+\s+(?:hours?|hrs?|days?|weeks?|months?)|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat|\d{4}-\d{2}-\d{2})\b/gi;

const TIME_PATTERNS: RegExp[] = [
  /\b(\d{1,2}):(\d{2})(?:\s*(am|pm))?\b/i,
  /\b(\d{1,2})\s*(am|pm)\b/i,
  /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
];

const DURATION_RE = /\bfor\s+(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b/gi;

const BANG_RE = /(^|\s)(!{1,3})(?=\s|$)/g;
const PRIORITY_TOKEN_RE = /(^|\s)p([0-4])(?=\s|$)/gi;
const TAG_RE = /(^|\s)#([\p{L}][\p{L}\p{N}_-]*)/gu;

interface DateInfo {
  ts: Timestamp;
  hasTime: boolean;
}

interface TimeParts {
  hour: number;
  minute: number;
}

function resolveDateText(match: string, now: Timestamp): DateInfo {
  const text = match.toLowerCase().replace(/\s+/g, " ").trim();

  if (text === "today") return { ts: startOfDay(now), hasTime: false };
  if (text === "tomorrow" || text === "tmr" || text === "tmrw") {
    return { ts: startOfDay(addDays(now, 1)), hasTime: false };
  }
  if (text === "next week") return { ts: startOfDay(addDays(now, 7)), hasTime: false };

  const relative = text.match(/^in\s+(\d+)\s+(hour|hr|day|week|month)s?$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    if (unit === "hour" || unit === "hr") {
      return { ts: now + amount * HOUR_MS, hasTime: true };
    }
    if (unit === "week") return { ts: startOfDay(addDays(now, amount * 7)), hasTime: false };
    if (unit === "month") {
      const date = new Date(now);
      date.setMonth(date.getMonth() + amount);
      return { ts: startOfDay(date.getTime()), hasTime: false };
    }
    return { ts: startOfDay(addDays(now, amount)), hasTime: false };
  }

  const weekday = WEEKDAYS[text];
  if (weekday !== undefined) return { ts: nextWeekday(now, weekday), hasTime: false };

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return { ts: startOfDay(date.getTime()), hasTime: false };
  }

  return { ts: startOfDay(now), hasTime: false };
}

function normalizeHour(hour: number): number {
  if (hour >= 1 && hour <= 7) return hour + 12;
  return hour;
}

function resolveTimeMatch(patternIndex: number, match: RegExpExecArray): TimeParts | null {
  if (patternIndex === 0) {
    const suffix = match[3]?.toLowerCase();
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    if (!suffix) hour = normalizeHour(hour);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  if (patternIndex === 1) {
    const suffix = match[2].toLowerCase();
    let hour = Number(match[1]);
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    if (hour > 23) return null;
    return { hour, minute: 0 };
  }

  let hour = Number(match[1]);
  if (hour > 23) return null;
  const minute = match[2] != null ? Number(match[2]) : 0;
  if (minute > 59) return null;
  const suffix = match[3]?.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  else if (suffix === "am" && hour === 12) hour = 0;
  else if (!suffix) {
    if (hour === 0) return null;
    hour = normalizeHour(hour);
  }
  return { hour, minute };
}

interface EarliestMatch {
  index: number;
  length: number;
  parts: RegExpExecArray;
  patternIndex: number;
}

function findEarliest(patterns: RegExp[], text: string): EarliestMatch | null {
  let best: EarliestMatch | null = null;
  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
    const pattern = patterns[patternIndex];
    const copy = new RegExp(pattern.source, pattern.flags.replace("g", ""));
    const match = copy.exec(text);
    if (!match) continue;
    if (best === null || match.index < best.index) {
      best = { index: match.index, length: match[0].length, parts: match, patternIndex };
    }
  }
  return best;
}

function removeAt(text: string, index: number, length: number): string {
  return `${text.slice(0, index)} ${text.slice(index + length)}`;
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ");
}

export function cleanTitle(text: string): string {
  let result = collapseSpaces(text);
  result = result.replace(/\s+(at|on|by|from)$/i, "");
  result = result.replace(/^(at|on|by|from)\s+/i, "");
  result = result.replace(/^[\s,.;:!?-]+/, "");
  result = result.replace(/[\s,;:!?-]+$/, "");
  return collapseSpaces(result).trim();
}

export interface WhenExtract {
  working: string;
  dueAt: Timestamp | null;
  hasExplicitTime: boolean;
}

export function extractWhen(text: string, now: Timestamp): WhenExtract {
  let working = text;
  let dateInfo: DateInfo | null = null;
  const dateMatch = findEarliest([DATE_RE], working);
  if (dateMatch) {
    dateInfo = resolveDateText(dateMatch.parts[0], now);
    working = removeAt(working, dateMatch.index, dateMatch.length);
  }

  let hasExplicitTime = false;
  let timeParts: TimeParts | null = null;
  const timeMatch = findEarliest(TIME_PATTERNS, working);
  if (timeMatch) {
    timeParts = resolveTimeMatch(timeMatch.patternIndex, timeMatch.parts);
    if (timeParts) {
      hasExplicitTime = true;
      working = removeAt(working, timeMatch.index, timeMatch.length);
    }
  }

  let dueAt: Timestamp | null = null;
  if (dateInfo) {
    dueAt = dateInfo.ts;
    if (dateInfo.hasTime) {
      hasExplicitTime = true;
    } else if (timeParts) {
      const date = new Date(dateInfo.ts);
      date.setHours(timeParts.hour, timeParts.minute, 0, 0);
      dueAt = date.getTime();
    }
  } else if (timeParts) {
    const date = new Date(startOfDay(now));
    date.setHours(timeParts.hour, timeParts.minute, 0, 0);
    let candidate = date.getTime();
    if (candidate <= now) {
      const tomorrow = new Date(startOfDay(addDays(now, 1)));
      tomorrow.setHours(timeParts.hour, timeParts.minute, 0, 0);
      candidate = tomorrow.getTime();
    }
    dueAt = candidate;
  }

  return { working, dueAt, hasExplicitTime };
}

export interface MetaExtract {
  working: string;
  durationMin: number | null;
  priority: Priority;
  tags: string[];
}

export function extractMeta(text: string): MetaExtract {
  let working = text;
  let durationMin: number | null = null;
  working = working.replace(DURATION_RE, (_match, amount: string, unit: string) => {
    const value = Number.parseFloat(amount.replace(",", "."));
    if (!Number.isNaN(value)) {
      durationMin = unit.toLowerCase().startsWith("h")
        ? Math.round(value * 60)
        : Math.round(value);
    }
    return " ";
  });

  let priority: Priority = PRIORITY.NONE;
  working = working.replace(BANG_RE, (_match, lead: string, bangs: string) => {
    priority = bangs.length >= 2 ? PRIORITY.URGENT : PRIORITY.HIGH;
    return lead;
  });
  working = working.replace(PRIORITY_TOKEN_RE, (_match, lead: string, digit: string) => {
    priority = Number(digit) as Priority;
    return lead;
  });

  const tags: string[] = [];
  working = working.replace(TAG_RE, (_match, lead: string, tag: string) => {
    tags.push(tag.toLowerCase());
    return lead;
  });

  return { working, durationMin, priority, tags };
}

export function parseCapture(input: string, options: { now?: Timestamp } = {}): CaptureParseResult {
  const now = options.now ?? Date.now();
  const raw = input;
  const lines = raw.split(/\r?\n/);

  const trimmedFirstLine = (lines[0] ?? "").trim();
  const explicitNote = /^note\s*:/i.test(trimmedFirstLine);
  const intent: CaptureIntent = explicitNote || lines.length > 1 ? "note" : "task";

  let working = lines[0] ?? "";
  const prefix = working.match(/^note\s*:\s*/i);
  if (prefix) working = working.slice(prefix[0].length);

  const when = extractWhen(working, now);
  const meta = extractMeta(when.working);
  working = meta.working;

  const title = cleanTitle(working);
  const noteBody = intent === "note" ? lines.slice(1).join("\n").trim() : null;

  if (intent === "note") {
    return {
      raw,
      intent,
      title,
      noteBody,
      dueAt: null,
      hasExplicitTime: false,
      priority: PRIORITY.NONE,
      tags: meta.tags,
      durationMin: null,
    };
  }

  return {
    raw,
    intent,
    title,
    noteBody,
    dueAt: when.dueAt,
    hasExplicitTime: when.hasExplicitTime,
    priority: meta.priority,
    tags: meta.tags,
    durationMin: meta.durationMin,
  };
}
