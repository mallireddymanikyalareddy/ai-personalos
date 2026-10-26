import { cleanTitle, extractMeta, extractWhen } from "../capture-parser";
import { MINUTE_MS } from "../date-utils";
import type {
  CaptureMode,
  CaptureType,
} from "../../types/capture";
import { PRIORITY, type Priority, type Timestamp } from "../../types/common";
import type { GoalHorizon } from "../../types/goal";
import type { HabitCadence } from "../../types/habit";

const TASK_PREAMBLE_RE =
  /^(?:i\s+(?:need|have|want|would\s+love|should|must|could|ll)\s+to|please\s+|remind\s+me\s+to\s+|do(?:n't|nt)\s+forget\s+to\s+|remember\s+to\s+)/i;

export interface ResolvedCapture {
  raw: string;
  type: CaptureType;
  mode: CaptureMode;
  confidence: number;
  title: string;
  body: string | null;
  keySignals: string[];
  dueAt: Timestamp | null;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  allDay: boolean;
  hasExplicitTime: boolean;
  priority: Priority;
  tags: string[];
  estimateMin: number | null;
  durationMin: number | null;
  cadence: HabitCadence | null;
  daysOfWeek: number[];
  goalHorizon: GoalHorizon | null;
}

export interface ResolveCaptureOptions {
  now?: Timestamp;
  mode?: CaptureMode;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const MEETING_RE =
  /\b(meeting|meet(?:ing)? with|stand-?up|1:1\b|one[- ]on[- ]one|sync with|interview(?:ing)? with|call with|chat with|coffee with|dinner with|lunch with|brunch with|drinks with|session with)\b/i;

const HABIT_DAILY_RE = /\b(every\s+day|each\s+day|daily|every\s+morning|every\s+evening|every\s+night|every\s+weekday|on\s+weekdays|weekdays|work\s?days?)\b/i;

const HABIT_WEEKLY_RE =
  /\b(every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)|each\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/i;

const HABIT_RHYTHM_RE = /\b(every\s+week|weekly|monthly|twice\s+a\s+week|x\s+times\s+a\s+week)\b/i;

const GOAL_PREFIX_RE = /^\s*(goal\s*:|my\s+goal|aim\s*:)/i;

const GOAL_VERB_RE =
  /\b(?:i|we)?\s*(?:want|would\s+like|aim|hope|plan|wish|strive|yearn)\s+to\s+(?:become|improve|learn|master|achieve|save|reach|reduce|increase|quit|stop|run|land|publish|grow|earn)\b/i;

const GOAL_HORIZON_RE = /\b(?:my\s+goal|goal:|aim|long-?term|5-?year|10-?year)/i;

const EVENT_VENUE_RE =
  /\b(dinner|lunch|breakfast|brunch|appointment|doctor|dentist|haircut|flight|movie|concert|show|match|game|reservation|party|wedding|class|lesson|tour|surgery|check-?up|gym|yoga|massage|therapy|exam|test|check|drinks|date)\b/i;

const NOTE_REFLECTIVE_RE =
  /\b(remember|note\b|idea|ideas for|for\s+later|inspiration|thought|fyi|reminder\s+that|to\s+remember)\b/i;

interface DetectedCadence {
  cadence: HabitCadence;
  daysOfWeek: number[];
}

function detectCadence(lower: string): DetectedCadence | null {
  if (HABIT_DAILY_RE.test(lower)) return { cadence: "daily", daysOfWeek: [] };
  const weekly = lower.match(HABIT_WEEKLY_RE);
  if (weekly) {
    const dayToken = (weekly[1] ?? weekly[2]).split(/\s+/).pop() ?? "";
    const day = WEEKDAY_TO_INDEX[dayToken];
    if (day !== undefined) return { cadence: "weekly", daysOfWeek: [day] };
  }
  if (HABIT_RHYTHM_RE.test(lower)) return { cadence: "weekly", daysOfWeek: [] };
  return null;
}

function horizonFor(now: Timestamp, targetAt: Timestamp | null): GoalHorizon {
  if (!targetAt) return "quarter";
  const distance = targetAt - now;
  const days = distance / (24 * 60 * MINUTE_MS);
  if (days <= 7) return "week";
  if (days <= 40) return "month";
  if (days <= 120) return "quarter";
  if (days <= 370) return "year";
  return "life";
}

function prefixType(text: string): CaptureType | null {
  const match = text.match(/^\s*(task|note|voice|image|document|goal|habit|event|meeting)\s*:/i);
  if (!match) return null;
  return match[1].toLowerCase() as CaptureType;
}

function signalFor(type: CaptureType, prefixed: boolean, forced: boolean): string {
  if (forced) return `Desired type: ${type}`;
  if (prefixed) return `Prefixed as ${type}`;
  switch (type) {
    case "meeting":
      return "People or meeting language detected";
    case "event":
      return "Time-bound plan detected";
    case "habit":
      return "Repeating cadence detected";
    case "goal":
      return "Ambition-style phrasing detected";
    case "note":
      return "Thought-style phrasing detected";
    default:
      return "Actionable phrasing";
  }
}

export function resolveCapture(
  input: string,
  options: ResolveCaptureOptions = {},
): ResolvedCapture {
  const now = options.now ?? Date.now();
  const raw = input.trim();
  const lines = raw.split(/\r?\n/);
  const firstLine = (lines[0] ?? "").trim();
  const lower = firstLine.toLowerCase();
  const forced = options.mode && options.mode !== "ai" ? options.mode : null;
  const prefixedType = prefixType(firstLine);

  let working = firstLine;
  let picked: CaptureType | null = forced ?? prefixedType;

  if (picked && /^(task|note|goal|habit|event|meeting)$/.test(picked)) {
    working = working.replace(new RegExp(`^\\s*${picked}\\s*:\\s*`, "i"), "");
  }
  if (!picked && /^voice\s*:/i.test(firstLine)) picked = "voice";
  if (!picked && /^image\s*:/i.test(firstLine)) picked = "image";
  if (!picked && /^document\s*:/i.test(firstLine)) picked = "document";

  const when = extractWhen(working, now);
  const meta = extractMeta(when.working);

  if (!picked) {
    const candidates: Array<{ type: CaptureType; points: number }> = [];
    if (MEETING_RE.test(lower)) {
      candidates.push({ type: "meeting", points: 3 });
    }
    if (
      EVENT_VENUE_RE.test(lower) &&
      (when.hasExplicitTime || when.dueAt !== null)
    ) {
      candidates.push({ type: "event", points: 2.5 });
    }
    if (detectCadence(lower)) {
      candidates.push({ type: "habit", points: 3 });
    }
    if (GOAL_VERB_RE.test(lower) || GOAL_PREFIX_RE.test(lower) || GOAL_HORIZON_RE.test(lower)) {
      candidates.push({ type: "goal", points: 2 });
    }
    if (lines.length > 1) {
      candidates.push({ type: "note", points: 2 });
    } else if (NOTE_REFLECTIVE_RE.test(lower)) {
      candidates.push({ type: "note", points: 1.5 });
    }
    const best = candidates.sort((a, b) => b.points - a.points)[0];
    picked = best && best.points >= 2 ? best.type : "task";
  }

  const type = picked ?? "task";
  const cadence = detectCadence(lower);
  const durationMin = meta.durationMin;
  const startsAt =
    when.dueAt !== null && (type === "event" || type === "meeting") ? when.dueAt : null;
  const allDay = when.dueAt !== null && !when.hasExplicitTime;
  const body = lines.slice(1).join("\n").trim() || null;
  let title =
    cleanTitle(meta.working) ||
    (type === "voice"
      ? "Voice memo"
      : type === "image"
        ? "Captured image"
        : type === "document"
          ? "Captured document"
          : firstLine);

  if (type === "task") {
    const prefix = title.match(TASK_PREAMBLE_RE);
    if (prefix) {
      const stripped = title.slice(prefix[0].length).trim();
      if (stripped) title = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }

  const keySignals = [signalFor(type, prefixedType !== null, forced !== null)];
  if (when.hasExplicitTime) keySignals.push("Specific time present");
  else if (when.dueAt !== null) keySignals.push("Date recognized");
  if (durationMin !== null) keySignals.push("Duration recognized");

  return {
    raw,
    type,
    mode: forced ?? "ai",
    confidence: forced ? 1 : prefixedType !== null ? 0.99 : 0.9,
    title,
    body,
    keySignals,
    dueAt: type === "task" || type === "goal" || type === "habit" ? when.dueAt : null,
    startsAt,
    endsAt: null,
    allDay,
    hasExplicitTime: when.hasExplicitTime,
    priority: meta.priority,
    tags: meta.tags,
    estimateMin: durationMin,
    durationMin,
    cadence: cadence?.cadence ?? null,
    daysOfWeek: cadence?.daysOfWeek ?? [],
    goalHorizon: type === "goal" ? horizonFor(now, when.dueAt) : null,
  };
}