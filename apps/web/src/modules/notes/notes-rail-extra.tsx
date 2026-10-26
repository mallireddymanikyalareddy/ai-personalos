"use client";

import * as React from "react";

import { CalendarClock, ChevronRight, Link2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NoteBacklinks({
  rows,
  onOpen,
}: {
  rows: { id: string; title: string; preview: string }[];
  onOpen: (id: string) => void;
}) {
  return (
    <section
      aria-label="Linked from"
      data-testid="notes-backlinks"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center gap-1.5">
        <Link2 className="size-4 text-accent-ink" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Linked from</h2>
      </header>

      {rows.length === 0 ? (
        <p className="text-[12px] text-ink-3">
          No notes link here yet. Write [[note title]] in another note to create a backlink.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOpen(row.id)}
                data-testid="note-backlink"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-ink-2 transition-colors hover:bg-surface-2"
              >
                <Link2 className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{row.title || "Untitled note"}</span>
                <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NoteReminders({
  reminders,
  onAdd,
  onRemove,
  now,
}: {
  reminders: { id: string; fireAt: number }[];
  onAdd: (at: number) => void;
  onRemove: (id: string) => void;
  now: number;
}) {
  const [value, setValue] = React.useState("");
  const dueCount = reminders.filter((reminder) => reminder.fireAt <= now).length;

  const add = () => {
    const at = value ? new Date(value).getTime() : NaN;
    if (!Number.isFinite(at)) return;
    onAdd(at);
    setValue("");
  };

  return (
    <section
      aria-label="Note reminders"
      data-testid="notes-reminders"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarClock className="size-4 text-accent-ink" aria-hidden="true" />
          Reminders
        </h2>
        {dueCount > 0 ? (
          <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">
            {dueCount} due
          </span>
        ) : null}
      </header>

      {reminders.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {reminders.map((reminder) => (
            <li
              key={reminder.id}
              data-testid="note-reminder"
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5 text-[12px] text-ink-2"
            >
              <CalendarClock className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(reminder.fireAt))}
              </span>
              {reminder.fireAt <= now ? (
                <span className="shrink-0 text-[10px] font-semibold text-danger">Due</span>
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(reminder.id)}
                aria-label="Remove reminder"
                className="grid size-5 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-3 hover:text-ink"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-[12px] text-ink-3">Get a nudge to revisit this note.</p>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Reminder time"
          className="h-8 flex-1 text-[12px]"
        />
        <Button variant="secondary" size="sm" onClick={add} disabled={!value}>
          <Plus className="size-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>
    </section>
  );
}
