"use client";

import * as React from "react";

import { Link2, Repeat, Target } from "lucide-react";

import { journalPreview, moodEmoji } from "@personalos/core";
import type { JournalEntry } from "@personalos/core";
import type { ID } from "@personalos/core";
import type { PersonalOS } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface JournalTimelineProps {
  os: PersonalOS;
  entries: JournalEntry[];
  onSelect: (entryId: ID) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  query: string;
}

export function JournalTimeline({ os, entries, onSelect, hasMore, onLoadMore }: JournalTimelineProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No entries to show"
        description="Entries you write appear here in order, with the mood, tags, and links you gave them."
      />
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const tasks = entry.taskIds.map((id) => os.getState().tasks[id]).filter(Boolean);
        const goals = entry.goalIds.map((id) => os.getState().goals[id]).filter(Boolean);
        const habits = entry.habitIds.map((id) => os.getState().habits[id]).filter(Boolean);
        const emoji = entry.mood ? moodEmoji(entry.mood) : null;

        return (
          <article key={entry.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                className="text-left text-xs text-ink-3 hover:text-ink"
              >
                {new Date(entry.entryDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </button>
              <span className="text-xs text-ink-3">
                {emoji ? <span aria-hidden>{emoji} </span> : null}
                {emoji ? entry.mood![0]!.toUpperCase() + entry.mood!.slice(1) : "No mood"}
              </span>
            </div>

            <h3 className="mt-1 font-medium">
              <button type="button" onClick={() => onSelect(entry.id)} className="hover:underline">
                {entry.title.trim() || "Journal entry"}
              </button>
            </h3>

            <p className="mt-1 text-sm text-ink-2">{journalPreview(entry, 160)}</p>

            {entry.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    #{tag}
                  </Badge>
                ))}
              </div>
            ) : null}

            {entry.people.length > 0 || entry.activities.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.people.map((person) => (
                  <Badge key={person.id} tone="outline">
                    {person.name}
                  </Badge>
                ))}
                {entry.activities.map((activity) => (
                  <Badge key={activity} tone="outline">
                    {activity}
                  </Badge>
                ))}
              </div>
            ) : null}

            {tasks.length + goals.length + habits.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                {tasks.length > 0 ? (
                  <li className="inline-flex items-center gap-1">
                    <Link2 className="size-3" aria-hidden />
                    {tasks.length} task{tasks.length === 1 ? "" : "s"}
                  </li>
                ) : null}
                {goals.length > 0 ? (
                  <li className="inline-flex items-center gap-1">
                    <Target className="size-3" aria-hidden />
                    {goals.map((goal) => goal.title).join(", ")}
                  </li>
                ) : null}
                {habits.length > 0 ? (
                  <li className="inline-flex items-center gap-1">
                    <Repeat className="size-3" aria-hidden />
                    {habits.map((habit) => habit.title).join(", ")}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </article>
        );
      })}

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={onLoadMore}>
            Load older entries
          </Button>
        </div>
      ) : null}
    </div>
  );
}
