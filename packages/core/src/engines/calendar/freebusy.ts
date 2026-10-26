import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { CalendarEvent } from "../../types/event";
import type { TimeBlock } from "../../types/time-block";
import { MINUTE_MS, addDays, endOfDay, startOfDay } from "../date-utils";

export interface FreeSlot {
  startsAt: Timestamp;
  endsAt: Timestamp;
  durationMin: number;
}

export interface BusyPeriod {
  startsAt: Timestamp;
  endsAt: Timestamp;
  event: CalendarEvent | null;
  block: TimeBlock | null;
}

function collectBusyPeriods(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): BusyPeriod[] {
  const periods: BusyPeriod[] = [];

  for (const event of Object.values(state.events)) {
    if (event.startsAt < to && event.endsAt > from) {
      periods.push({
        startsAt: Math.max(event.startsAt, from),
        endsAt: Math.min(event.endsAt, to),
        event,
        block: null,
      });
    }
  }

  for (const block of Object.values(state.timeBlocks)) {
    if (block.startsAt < to && block.endsAt > from) {
      periods.push({
        startsAt: Math.max(block.startsAt, from),
        endsAt: Math.min(block.endsAt, to),
        event: null,
        block,
      });
    }
  }

  return periods.sort((a, b) => a.startsAt - b.startsAt);
}

export function findFreeSlots(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  minDurationMin = 30,
): FreeSlot[] {
  const busy = collectBusyPeriods(state, from, to);
  const slots: FreeSlot[] = [];
  let cursor = from;

  for (const period of busy) {
    if (period.startsAt > cursor) {
      const durationMin = (period.startsAt - cursor) / MINUTE_MS;
      if (durationMin >= minDurationMin) {
        slots.push({ startsAt: cursor, endsAt: period.startsAt, durationMin });
      }
    }
    cursor = Math.max(cursor, period.endsAt);
  }

  if (cursor < to) {
    const durationMin = (to - cursor) / MINUTE_MS;
    if (durationMin >= minDurationMin) {
      slots.push({ startsAt: cursor, endsAt: to, durationMin });
    }
  }

  return slots;
}

export function findFreeSlotsForDay(
  state: AppState,
  date: Timestamp,
  hourStart = 8,
  hourEnd = 18,
  minDurationMin = 30,
): FreeSlot[] {
  const dayStart = startOfDay(date);
  const from = dayStart + hourStart * 60 * MINUTE_MS;
  const to = dayStart + hourEnd * 60 * MINUTE_MS;
  return findFreeSlots(state, from, to, minDurationMin);
}

export function findFreeSlotsForWeek(
  state: AppState,
  date: Timestamp,
  hourStart = 8,
  hourEnd = 18,
  minDurationMin = 30,
): FreeSlot[] {
  const dayStart = startOfDay(date);
  const slots: FreeSlot[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(dayStart, i);
    slots.push(...findFreeSlotsForDay(state, day, hourStart, hourEnd, minDurationMin));
  }
  return slots;
}

export function totalFreeMinutes(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  minDurationMin = 30,
): number {
  return findFreeSlots(state, from, to, minDurationMin).reduce(
    (sum, slot) => sum + slot.durationMin,
    0,
  );
}

export function totalBusyMinutes(state: AppState, from: Timestamp, to: Timestamp): number {
  const busy = collectBusyPeriods(state, from, to);
  let total = 0;
  for (const period of busy) {
    total += period.endsAt - period.startsAt;
  }
  return total / MINUTE_MS;
}

export function isTimeAvailable(
  state: AppState,
  startsAt: Timestamp,
  endsAt: Timestamp,
): boolean {
  const busy = collectBusyPeriods(state, startsAt, endsAt);
  return busy.every(
    (period) => period.endsAt <= startsAt || period.startsAt >= endsAt,
  );
}

export function suggestTimeSlots(
  state: AppState,
  date: Timestamp,
  durationMin: number,
  hourStart = 8,
  hourEnd = 18,
): FreeSlot[] {
  return findFreeSlotsForDay(state, date, hourStart, hourEnd, durationMin);
}
