import type { ID, Timestamp } from "../../types/common";
import type { CalendarEvent } from "../../types/event";
import type { CalendarProvider } from "../../types/planning";

export interface ExternalEvent {
  externalId: string;
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  allDay: boolean;
  location: string;
  description: string;
  attendees: string[];
  recurrence: string | null;
  color: string | null;
}

export interface CalendarProviderConfig {
  provider: CalendarProvider;
  calendarId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Timestamp;
}

export interface CalendarProviderAdapter {
  listEvents(from: Timestamp, to: Timestamp): Promise<ExternalEvent[]>;
  createEvent(event: ExternalEvent): Promise<string>;
  updateEvent(externalId: string, event: ExternalEvent): Promise<void>;
  deleteEvent(externalId: string): Promise<void>;
  getFreeBusy(from: Timestamp, to: Timestamp): Promise<{ startsAt: Timestamp; endsAt: Timestamp }[]>;
}

export interface CalendarProviderRegistry {
  register(config: CalendarProviderConfig, adapter: CalendarProviderAdapter): void;
  get(provider: CalendarProvider, calendarId: string): CalendarProviderAdapter | null;
  list(): CalendarProviderConfig[];
}

export function createCalendarProviderRegistry(): CalendarProviderRegistry {
  const adapters = new Map<string, CalendarProviderAdapter>();
  const configs: CalendarProviderConfig[] = [];

  return {
    register(config, adapter) {
      const key = `${config.provider}:${config.calendarId}`;
      adapters.set(key, adapter);
      configs.push(config);
    },
    get(provider, calendarId) {
      return adapters.get(`${provider}:${calendarId}`) ?? null;
    },
    list() {
      return [...configs];
    },
  };
}

export function toCanonicalEvent(
  external: ExternalEvent,
  calendarId: ID,
): CalendarEvent {
  return {
    type: "event",
    id: `ext_${external.externalId}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: external.title,
    notes: external.description,
    startsAt: external.startsAt,
    endsAt: external.endsAt,
    allDay: external.allDay,
    location: external.location,
    projectId: null,
    taskId: null,
    calendarId,
    source: "manual",
    attendees: external.attendees.map((email, i) => ({
      id: `att_${i}`,
      name: email,
      email,
      status: "needs_action" as const,
      isOrganizer: false,
    })),
    categoryId: null,
    color: external.color,
    recurrence: null,
    recurrenceId: null,
    recurrenceOrdinal: 1,
    reminderIds: [],
    mode: "personal",
    sharedWith: [],
  };
}

export function toExternalEvent(event: CalendarEvent): ExternalEvent {
  return {
    externalId: event.id.replace(/^ext_/, ""),
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    location: event.location,
    description: event.notes,
    attendees: event.attendees.map((a) => a.email),
    recurrence: event.recurrence ? JSON.stringify(event.recurrence) : null,
    color: event.color,
  };
}
