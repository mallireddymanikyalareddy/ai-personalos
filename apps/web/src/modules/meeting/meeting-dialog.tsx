"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

import type { Meeting, MeetingStatus } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

export interface MeetingDialogAttendee {
  name: string;
  email: string;
}

export type MeetingRepeat = "none" | "daily" | "weekly" | "monthly";

export interface MeetingDialogValue {
  title: string;
  startsAt: number;
  endsAt: number;
  location: string;
  notes: string;
  status: MeetingStatus;
  attendees: MeetingDialogAttendee[];
  projectId: string | null;
  tags: string[];
  reminderAt: number | null;
  recurrence: MeetingRepeat;
  occurrences: number;
}

const STATUSES: { value: MeetingStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const REPEATS: { value: MeetingRepeat; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function dateValue(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeValue(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function combine(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!year || !month || !day) return 0;
  return new Date(year, month - 1, day, hour ?? 0, minute ?? 0).getTime();
}

export function MeetingDialog({
  open,
  onClose,
  onSave,
  initial,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (value: MeetingDialogValue) => void;
  initial?: Meeting | null;
  projects: { id: string; name: string }[];
}) {
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [duration, setDuration] = React.useState(30);
  const [location, setLocation] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState<MeetingStatus>("scheduled");
  const [attendees, setAttendees] = React.useState<MeetingDialogAttendee[]>([]);
  const [attendeeName, setAttendeeName] = React.useState("");
  const [attendeeEmail, setAttendeeEmail] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [reminder, setReminder] = React.useState("");
  const [recurrence, setRecurrence] = React.useState<MeetingRepeat>("none");
  const [occurrences, setOccurrences] = React.useState(6);

  React.useEffect(() => {
    if (!open) return;
    const startsAt = initial?.startsAt ?? Date.now() + 3_600_000;
    const endsAt = initial?.endsAt ?? startsAt + 30 * 60_000;
    setTitle(initial?.title ?? "");
    setDate(dateValue(startsAt));
    setTime(timeValue(startsAt));
    setDuration(Math.max(1, Math.round((endsAt - startsAt) / 60_000)));
    setLocation(initial?.location ?? "");
    setNotes(initial?.notes ?? "");
    setStatus(initial?.status ?? "scheduled");
    setAttendees(
      (initial?.attendees ?? []).map((attendee) => ({ name: attendee.name, email: attendee.email })),
    );
    setAttendeeName("");
    setAttendeeEmail("");
    setProjectId(initial?.projectId ?? "");
    setTags((initial?.tags ?? []).join(", "));
    setReminder("");
    setRecurrence("none");
    setOccurrences(6);
  }, [open, initial]);

  const canSave = title.trim().length > 0 && date.length > 0 && time.length > 0;

  const addAttendee = () => {
    const name = attendeeName.trim();
    const email = attendeeEmail.trim();
    if (name.length === 0 && email.length === 0) return;
    setAttendees((current) => [...current, { name: name || email, email }]);
    setAttendeeName("");
    setAttendeeEmail("");
  };

  const save = () => {
    if (!canSave) return;
    const startsAt = combine(date, time);
    onSave({
      title: title.trim(),
      startsAt,
      endsAt: startsAt + Math.max(1, duration) * 60_000,
      location: location.trim(),
      notes,
      status,
      attendees,
      projectId: projectId.length > 0 ? projectId : null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter((tag, index, list) => tag.length > 0 && list.indexOf(tag) === index),
      reminderAt: reminder ? new Date(reminder).getTime() : null,
      recurrence,
      occurrences,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit meeting" : "Schedule a meeting"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {initial ? "Save changes" : "Schedule meeting"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="meeting-title">Title</FieldLabel>
          <Input
            id="meeting-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly sync"
            data-autofocus
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="meeting-date">Date</FieldLabel>
            <Input id="meeting-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="meeting-time">Start</FieldLabel>
            <Input id="meeting-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="meeting-duration">Minutes</FieldLabel>
            <Input
              id="meeting-duration"
              type="number"
              min={1}
              max={480}
              value={duration}
              onChange={(event) => setDuration(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="meeting-location">Location</FieldLabel>
            <Input
              id="meeting-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Meet link or room"
            />
          </div>
          <div>
            <FieldLabel htmlFor="meeting-status">Status</FieldLabel>
            <Select id="meeting-status" value={status} onChange={(event) => setStatus(event.target.value as MeetingStatus)}>
              {STATUSES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="meeting-project">Project</FieldLabel>
            <Select id="meeting-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="meeting-tags">Tags</FieldLabel>
            <Input
              id="meeting-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="product, weekly"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Attendees</FieldLabel>
          {attendees.length > 0 ? (
            <ul className="mb-2 space-y-1">
              {attendees.map((attendee, index) => (
                <li
                  key={`${attendee.email}-${index}`}
                  className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5 text-[12px] text-ink-2"
                >
                  <span className="min-w-0 flex-1 truncate">{attendee.name}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-3">{attendee.email}</span>
                  <button
                    type="button"
                    onClick={() => setAttendees((current) => current.filter((_, position) => position !== index))}
                    aria-label={`Remove ${attendee.name}`}
                    className="grid size-5 place-items-center rounded text-ink-3 hover:bg-surface-3 hover:text-danger"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={attendeeName}
              onChange={(event) => setAttendeeName(event.target.value)}
              placeholder="Name"
              aria-label="Attendee name"
              className="min-w-0 flex-1"
            />
            <Input
              value={attendeeEmail}
              onChange={(event) => setAttendeeEmail(event.target.value)}
              placeholder="Email"
              aria-label="Attendee email"
              className="min-w-0 flex-1"
            />
            <Button variant="secondary" size="sm" onClick={addAttendee}>
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="meeting-reminder">Reminder</FieldLabel>
            <Input
              id="meeting-reminder"
              type="datetime-local"
              value={reminder}
              onChange={(event) => setReminder(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="meeting-repeat">Repeat</FieldLabel>
            <Select
              id="meeting-repeat"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value as MeetingRepeat)}
              disabled={initial != null}
            >
              {REPEATS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="meeting-occurrences">Occurrences</FieldLabel>
            <Input
              id="meeting-occurrences"
              type="number"
              min={1}
              max={52}
              value={occurrences}
              onChange={(event) => setOccurrences(Math.max(1, Number(event.target.value) || 1))}
              disabled={recurrence === "none" || initial != null}
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="meeting-notes">Agenda / notes</FieldLabel>
          <Textarea
            id="meeting-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Agenda, links, preparation…"
            className="min-h-24"
          />
        </div>
      </div>
    </Modal>
  );
}
