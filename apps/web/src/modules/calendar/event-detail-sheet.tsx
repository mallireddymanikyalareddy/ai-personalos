"use client";

import * as React from "react";

import { CalendarOff, MapPin, Trash2 } from "lucide-react";

import {
  addDays,
  detectOverlaps,
  endOfDay,
  formatFullDate,
  startOfDay,
  type CalendarEvent,
  type ID,
  type RecurrenceRule,
  type Timestamp,
} from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { EVENT_COLORS, formatEventTime, isEventColorKey } from "./event-chip";

export interface EventSheet {
  eventId?: ID;
  draft?: { title?: string; startsAt: Timestamp; endsAt: Timestamp; calendarId?: string | null };
}

export interface EventDetailSheetProps {
  sheet: EventSheet | null;
  onClose: () => void;
}

const SWATCH_CLASSES: Record<string, string> = {
  accent: "bg-accent",
  teal: "bg-chart-2",
  amber: "bg-chart-3",
  rose: "bg-chart-4",
  blue: "bg-chart-5",
  green: "bg-chart-6",
  violet: "bg-chart-7",
  slate: "bg-chart-8",
};

function toDateTimeValue(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateValue(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateTimeValue(value: string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function fromDateValue(value: string): number {
  if (!value) return 0;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return new Date(year, month - 1, day).getTime();
}

export function EventDetailSheet({ sheet, onClose }: EventDetailSheetProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const eventId = sheet?.eventId ?? null;
  const draft = sheet?.draft ?? null;

  const event = eventId ? (state.events[eventId] ?? null) : null;

  const [title, setTitle] = React.useState("");
  const [startsAt, setStartsAt] = React.useState(0);
  const [endsAt, setEndsAt] = React.useState(0);
  const [allDay, setAllDay] = React.useState(false);
  const [location, setLocation] = React.useState("");
  const [color, setColor] = React.useState<string | null>("accent");
  const [notes, setNotes] = React.useState("");
  const [calendarId, setCalendarId] = React.useState<string | null>(null);
  const [repeat, setRepeat] = React.useState("none");
  const [reminderOffset, setReminderOffset] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const calendars = os.calendars();

  const reminderOffsets = ["0", "5", "15", "30", "60"];

  const lastKey = React.useRef<string | null>(null);

  const sheetKey = eventId ?? (draft ? `draft:${draft.startsAt}` : "closed");

  React.useEffect(() => {
    if (lastKey.current === sheetKey) return;
    lastKey.current = sheetKey;

    if (event) {
      setTitle(event.title);
      setStartsAt(event.startsAt);
      setEndsAt(event.endsAt);
      setAllDay(event.allDay);
      setLocation(event.location);
      setColor(isEventColorKey(event.color) ? event.color : "accent");
      setNotes(event.notes);
      setCalendarId(event.calendarId);
      setRepeat(event.recurrence?.freq ?? "none");
      const reminderId = event.reminderIds[0];
      const reminder = reminderId ? state.reminders[reminderId] : undefined;
      setReminderOffset(
        reminder ? String(Math.max(0, Math.round((event.startsAt - reminder.fireAt) / 60_000))) : "",
      );
      setConfirmDelete(false);
      return;
    }
    if (draft) {
      setTitle(draft.title ?? "");
      setStartsAt(draft.startsAt);
      setEndsAt(draft.endsAt);
      setAllDay(false);
      setLocation("");
      setColor("accent");
      setNotes("");
      setCalendarId(draft.calendarId ?? null);
      setRepeat("none");
      setReminderOffset("");
      setConfirmDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetKey]);

  const candidate = React.useMemo<CalendarEvent>(() => {
    const base = (event ?? {
      type: "event",
      id: "draft",
      createdAt: startsAt,
      updatedAt: startsAt,
      title,
      notes,
      startsAt,
      endsAt,
      allDay,
      location,
      projectId: null,
      taskId: null,
      calendarId: null,
      source: "manual",
      attendees: [],
      categoryId: null,
      color,
      recurrence: null,
      recurrenceId: null,
      recurrenceOrdinal: 1,
      reminderIds: [],
    }) as CalendarEvent;
    return { ...base, title, startsAt, endsAt, allDay };
  }, [event, title, startsAt, endsAt, allDay, location, notes, color]);

  const conflicts = React.useMemo(() => {
    if (endsAt <= startsAt) return 0;
    const others = Object.values(state.events).filter(
      (other) => other.id !== eventId && other.startsAt < endsAt && other.endsAt > startsAt,
    );
    if (others.length === 0) return 0;
    return detectOverlaps([candidate, ...others]).filter(
      (overlap) => overlap.a.id === candidate.id || overlap.b.id === candidate.id,
    ).length;
  }, [candidate, endsAt, startsAt, eventId, state.events]);

  if (!sheet) {
    return <Modal open={false} onClose={onClose}>{null}</Modal>;
  }

  const creating = eventId == null;

  const setStartDate = (value: string) => {
    const dateStart = fromDateValue(value);
    if (!dateStart) return;
    if (allDay) {
      setStartsAt(dateStart);
      setEndsAt(endOfDay(dateStart));
    } else {
      const dayOffset = startsAt - startOfDay(startsAt);
      setStartsAt(dateStart + dayOffset);
      setEndsAt(dateStart + dayOffset + (endsAt - startsAt));
    }
  };

  const toggleAllDay = (checked: boolean) => {
    setAllDay(checked);
    if (checked) {
      setStartsAt(startOfDay(startsAt));
      setEndsAt(endOfDay(startsAt));
    }
  };

  const commit = () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast("Give the event a title");
      return;
    }
    if (endsAt <= startsAt) {
      toast("End time must be after the start");
      return;
    }
    const payload = {
      title: nextTitle,
      startsAt,
      endsAt,
      allDay,
      location: location.trim(),
      notes,
      color,
      calendarId,
      recurrence: repeat === "none" ? null : ({ freq: repeat, interval: 1 } as RecurrenceRule),
    };
    if (creating) {
      const created = os.addEvent(payload);
      if (reminderOffset !== "") os.addEventReminder(created.id, Number(reminderOffset));
      toast("Event added", { tone: "success" });
    } else if (event) {
      os.updateEvent(event.id, payload);
      os.clearEventReminders(event.id);
      if (reminderOffset !== "") os.addEventReminder(event.id, Number(reminderOffset));
      toast("Event updated", { tone: "success" });
    }
    onClose();
  };

  const remove = () => {
    if (!event) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    os.deleteEvent(event.id);
    toast("Event deleted");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={creating ? "New event" : "Event"}
      description={creating ? undefined : `Created ${formatFullDate(event?.createdAt ?? 0)}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>
            {!creating && (
              <Button variant="ghost" size="sm" onClick={remove}>
                <Trash2 className="size-4" aria-hidden="true" />
                {confirmDelete ? "Click again to delete" : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={commit}>
              {creating ? "Add event" : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {conflicts > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <CalendarOff className="size-4 shrink-0" aria-hidden="true" />
            Overlaps {conflicts} other event{conflicts > 1 ? "s" : ""} on the calendar.
          </div>
        )}

        <div>
          <Input
            data-autofocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Event title"
            aria-label="Event title"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
            }}
            className="h-10 text-[15px] font-medium"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <FieldLabel className="mb-0">All day</FieldLabel>
          <Switch checked={allDay} onCheckedChange={toggleAllDay} label="All day event" />
        </div>

        {allDay ? (
          <div>
            <FieldLabel htmlFor="event-date" className="mb-1.5">
              Date
            </FieldLabel>
            <Input
              id="event-date"
              type="date"
              value={toDateValue(startsAt)}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="event-start" className="mb-1.5">
                Starts
              </FieldLabel>
              <Input
                id="event-start"
                type="datetime-local"
                value={toDateTimeValue(startsAt)}
                onChange={(event) => {
                  const next = fromDateTimeValue(event.target.value);
                  if (next) setStartsAt(next);
                }}
              />
            </div>
            <div>
              <FieldLabel htmlFor="event-end" className="mb-1.5">
                Ends
              </FieldLabel>
              <Input
                id="event-end"
                type="datetime-local"
                value={toDateTimeValue(endsAt)}
                onChange={(event) => {
                  const next = fromDateTimeValue(event.target.value);
                  if (next) setEndsAt(next);
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {[startOfDay(startsAt), addDays(startOfDay(startsAt), 1), addDays(startOfDay(startsAt), 7)].map(
            (day) => (
              <Button
                key={day}
                size="sm"
                variant="secondary"
                onClick={() => setStartDate(toDateValue(day))}
              >
                {day === startOfDay(startsAt)
                  ? "Same day"
                  : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(day))}
              </Button>
            ),
          )}
        </div>

        <div>
          <FieldLabel htmlFor="event-location" className="mb-1.5">
            Location
          </FieldLabel>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Input
              id="event-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Where?"
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="event-calendar" className="mb-1.5">
              Calendar
            </FieldLabel>
            <select
              id="event-calendar"
              value={calendarId ?? ""}
              onChange={(event) => setCalendarId(event.target.value || null)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">No calendar</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="event-repeat" className="mb-1.5">
              Repeat
            </FieldLabel>
            <select
              id="event-repeat"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Every weekday</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="event-reminder" className="mb-1.5">
            Reminder
          </FieldLabel>
          <select
            id="event-reminder"
            value={reminderOffset}
            onChange={(event) => setReminderOffset(event.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">No reminder</option>
            <option value="0">At start time</option>
            {reminderOffsets.map((offset) => (
              <option key={offset} value={offset}>
                {offset} minutes before
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel className="mb-1.5">Color</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_COLORS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setColor(key)}
                aria-label={`Use ${key} color`}
                aria-pressed={color === key}
                className={cn(
                  "size-7 rounded-full transition-transform",
                  SWATCH_CLASSES[key],
                  color === key
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                    : "hover:scale-110",
                )}
              />
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="event-notes" className="mb-1.5">
            Notes
          </FieldLabel>
          <Textarea
            id="event-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Agenda, links, prep…"
            className="min-h-24"
          />
        </div>

        <p className="text-xs text-ink-3">
          {creating ? "Will show" : "Currently"} on the calendar as{" "}
          <span className="font-medium text-ink-2">{formatEventTime(candidate)}</span>
          {conflicts > 0 && <span className="text-danger"> — with conflicts</span>}.
        </p>
      </div>
    </Modal>
  );
}