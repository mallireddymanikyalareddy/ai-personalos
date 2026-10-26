import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { CalendarEvent } from "../../types/event";
import type { TimeBlock } from "../../types/time-block";
import { addDays, endOfDay, isSameDay, startOfDay, startOfWeek } from "../date-utils";

export interface CalendarDay {
  date: Timestamp;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  timeBlocks: TimeBlock[];
}

export interface CalendarWeek {
  start: Timestamp;
  end: Timestamp;
  days: CalendarDay[];
}

export interface CalendarMonth {
  start: Timestamp;
  end: Timestamp;
  weeks: CalendarWeek[];
}

export interface AgendaItem {
  event: CalendarEvent;
  day: Timestamp;
}

export interface CalendarYear {
  year: number;
  months: CalendarMonth[];
}

export function selectEventsInRange(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): CalendarEvent[] {
  return Object.values(state.events)
    .filter((e) => e.startsAt < to && e.endsAt > from)
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function selectTimeBlocksInRange(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): TimeBlock[] {
  return Object.values(state.timeBlocks)
    .filter((b) => b.startsAt < to && b.endsAt > from)
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function buildDayView(state: AppState, date: Timestamp, now: Timestamp): CalendarDay {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return {
    date: dayStart,
    isCurrentMonth: true,
    isToday: isSameDay(date, now),
    events: selectEventsInRange(state, dayStart, dayEnd),
    timeBlocks: selectTimeBlocksInRange(state, dayStart, dayEnd),
  };
}

export function buildWeekView(state: AppState, date: Timestamp, now: Timestamp): CalendarWeek {
  const weekStart = startOfWeek(startOfDay(date));
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    days.push(buildDayView(state, day, now));
  }
  return { start: weekStart, end: addDays(weekStart, 7), days };
}

export function buildMonthView(state: AppState, date: Timestamp, now: Timestamp): CalendarMonth {
  const first = new Date(startOfDay(date));
  first.setDate(1);
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1);
  last.setDate(0);

  const monthStart = startOfWeek(first.getTime());
  const monthEnd = endOfDay(last.getTime());

  const weeks: CalendarWeek[] = [];
  let cursor = monthStart;
  while (cursor <= monthEnd) {
    weeks.push(buildWeekView(state, cursor, now));
    cursor = addDays(cursor, 7);
  }

  return { start: first.getTime(), end: last.getTime(), weeks };
}

export function buildAgendaView(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): AgendaItem[] {
  const events = selectEventsInRange(state, from, to);
  return events.map((event) => ({
    event,
    day: startOfDay(event.startsAt),
  }));
}

export function buildYearView(state: AppState, year: number, now: Timestamp): CalendarYear {
  const months: CalendarMonth[] = [];
  for (let m = 0; m < 12; m++) {
    months.push(buildMonthView(state, new Date(year, m, 1).getTime(), now));
  }
  return { year, months };
}

export function selectEventsByCalendar(state: AppState, calendarId: ID): CalendarEvent[] {
  return Object.values(state.events)
    .filter((e) => e.calendarId === calendarId)
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function selectEventsByCategory(state: AppState, categoryId: ID): CalendarEvent[] {
  return Object.values(state.events)
    .filter((e) => e.categoryId === categoryId)
    .sort((a, b) => a.startsAt - b.startsAt);
}
