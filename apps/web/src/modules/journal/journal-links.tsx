"use client";

import * as React from "react";

import { Link2, Lightbulb, Plus, X } from "lucide-react";

import type { JournalEntry, PersonalOS } from "@personalos/core";

import { Button } from "@/components/ui/button";

interface JournalLinksProps {
  os: PersonalOS;
  entry: JournalEntry;
  onChange: (patch: Partial<JournalEntry>) => void;
}

export function JournalLinks({ os, entry, onChange }: JournalLinksProps) {
  const state = os.getState();

  const tasks = entry.taskIds.map((id) => state.tasks[id]).filter(Boolean);
  const goals = entry.goalIds.map((id) => state.goals[id]).filter(Boolean);
  const habits = entry.habitIds.map((id) => state.habits[id]).filter(Boolean);
  const events = entry.eventIds.map((id) => state.events[id]).filter(Boolean);
  const memories = entry.lifeMemoryIds.map((id) => state.lifeMemoryItems[id]).filter(Boolean);
  const total = tasks.length + goals.length + habits.length + events.length + memories.length;

  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Linked to this entry"
      data-testid="journal-links"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Link2 className="size-3.5 text-ink-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-ink">Linked to this entry</h3>
        {total > 0 ? <span className="text-xs text-ink-3">{total}</span> : null}
      </div>

      {total === 0 ? (
        <p className="text-xs text-ink-3">
          Nothing linked yet — the assistant can suggest links from what you wrote.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tasks.map((task) => (
            <li
              key={task!.id}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2"
            >
              Task · {task!.title}
            </li>
          ))}
          {goals.map((goal) => (
            <li
              key={goal!.id}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2"
            >
              Goal · {goal!.title}
            </li>
          ))}
          {habits.map((habit) => (
            <li
              key={habit!.id}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2"
            >
              Habit · {habit!.title}
            </li>
          ))}
          {events.map((event) => (
            <li
              key={event!.id}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2"
            >
              Event · {event!.title}
            </li>
          ))}
          {memories.map((memory) => (
            <li
              key={memory!.id}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2"
            >
              Memory · {memory!.title}
            </li>
          ))}
        </ul>
      )}

      <ReminderList entry={entry} onChange={onChange} />
    </section>
  );
}

function ReminderList({
  entry,
  onChange,
}: {
  entry: JournalEntry;
  onChange: (patch: Partial<JournalEntry>) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const reminders = entry.tomorrow.reminders;

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange({ tomorrow: { ...entry.tomorrow, reminders: [...reminders, value] } });
    setDraft("");
  };

  return (
    <div className="mt-3 border-t border-line pt-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Lightbulb className="size-3.5 text-warning" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-ink">Things to remember</h3>
        <span className="text-xs text-ink-3">{reminders.length}</span>
      </div>

      {reminders.length > 0 ? (
        <ul className="mb-1.5 space-y-1">
          {reminders.map((reminder) => (
            <li key={reminder} className="flex items-start gap-1.5 text-sm text-ink-2">
              <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3" />
              <span className="min-w-0 flex-1">{reminder}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    tomorrow: {
                      ...entry.tomorrow,
                      reminders: reminders.filter((value) => value !== reminder),
                    },
                  })
                }
                aria-label={`Remove ${reminder}`}
                className="shrink-0 text-ink-3 hover:text-danger"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Something to remember"
          aria-label="New reminder"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button size="icon-sm" variant="secondary" aria-label="Add reminder" onClick={add}>
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}