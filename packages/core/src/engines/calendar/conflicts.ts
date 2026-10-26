import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { CalendarEvent } from "../../types/event";
import type { Task } from "../../types/task";
import type { TimeBlock } from "../../types/time-block";
import { MINUTE_MS, startOfDay } from "../date-utils";

export interface Overlap {
  a: CalendarEvent;
  b: CalendarEvent;
  overlapStart: Timestamp;
  overlapEnd: Timestamp;
  overlapMin: number;
}

export interface TaskConflict {
  event: CalendarEvent;
  task: Task;
  reason: string;
}

export interface ImpossibleSchedule {
  event: CalendarEvent;
  reason: string;
}

export interface InsufficientTime {
  date: Timestamp;
  requiredMin: number;
  availableMin: number;
}

export function detectOverlaps(events: CalendarEvent[]): Overlap[] {
  const sorted = [...events].sort((a, b) => a.startsAt - b.startsAt);
  const overlaps: Overlap[] = [];

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (b.startsAt >= a.endsAt) break;
      const overlapStart = Math.max(a.startsAt, b.startsAt);
      const overlapEnd = Math.min(a.endsAt, b.endsAt);
      if (overlapStart < overlapEnd) {
        overlaps.push({
          a,
          b,
          overlapStart,
          overlapEnd,
          overlapMin: (overlapEnd - overlapStart) / MINUTE_MS,
        });
      }
    }
  }

  return overlaps;
}

export function detectTaskConflicts(
  state: AppState,
  event: CalendarEvent,
): TaskConflict[] {
  const conflicts: TaskConflict[] = [];
  const tasks = Object.values(state.tasks).filter(
    (t) => t.dueAt != null && t.dueAt >= event.startsAt && t.dueAt <= event.endsAt,
  );

  for (const task of tasks) {
    if (task.status === "done" || task.status === "cancelled") continue;
    conflicts.push({
      event,
      task,
      reason: `Task "${task.title}" is due during this event`,
    });
  }

  return conflicts;
}

export function detectImpossibleSchedules(
  state: AppState,
  events: CalendarEvent[],
): ImpossibleSchedule[] {
  const impossible: ImpossibleSchedule[] = [];

  for (const event of events) {
    if (event.startsAt >= event.endsAt) {
      impossible.push({ event, reason: "Event ends before it starts" });
    }
    if (event.endsAt - event.startsAt > 24 * 60 * MINUTE_MS) {
      impossible.push({ event, reason: "Event exceeds 24 hours" });
    }
    if (event.allDay && event.startsAt !== event.endsAt) {
      const duration = (event.endsAt - event.startsAt) / MINUTE_MS;
      if (duration < 24 * 60) {
        impossible.push({ event, reason: "All-day event must span at least 24 hours" });
      }
    }
  }

  return impossible;
}

export function detectInsufficientTime(
  state: AppState,
  date: Timestamp,
  requiredMin: number,
  hourStart = 8,
  hourEnd = 18,
): InsufficientTime | null {
  const dayStart = startOfDay(date);
  const from = dayStart + hourStart * 60 * MINUTE_MS;
  const to = dayStart + hourEnd * 60 * MINUTE_MS;

  const busy = Object.values(state.events)
    .filter((e) => e.startsAt < to && e.endsAt > from)
    .reduce((sum, e) => sum + (Math.min(e.endsAt, to) - Math.max(e.startsAt, from)) / MINUTE_MS, 0);

  const availableMin = (to - from) / MINUTE_MS - busy;

  if (availableMin < requiredMin) {
    return { date: dayStart, requiredMin, availableMin };
  }

  return null;
}

export function findOverlappingBlocks(
  state: AppState,
  event: CalendarEvent,
): TimeBlock[] {
  return Object.values(state.timeBlocks).filter(
    (b) => b.startsAt < event.endsAt && b.endsAt > event.startsAt,
  );
}

export function validateEvent(
  state: AppState,
  event: CalendarEvent,
): {
  overlaps: Overlap[];
  taskConflicts: TaskConflict[];
  impossible: ImpossibleSchedule[];
  overlappingBlocks: TimeBlock[];
} {
  const allEvents = Object.values(state.events).filter((e) => e.id !== event.id);
  return {
    overlaps: detectOverlaps([...allEvents, event]),
    taskConflicts: detectTaskConflicts(state, event),
    impossible: detectImpossibleSchedules(state, [event]),
    overlappingBlocks: findOverlappingBlocks(state, event),
  };
}
