"use client";

import * as React from "react";

import { Image as ImageIcon } from "lucide-react";

import { journalDayLabel, journalEntryTitle, moodEmoji } from "@personalos/core";
import type { Attachment, JournalEntry, PersonalOS, Timestamp } from "@personalos/core";

import { cn } from "@/lib/cn";

function startOfDay(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function shortDay(at: Timestamp): string {
  return new Date(at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export interface JournalRecentEntriesProps {
  os: PersonalOS;
  entries: JournalEntry[];
  selectedDate: Timestamp;
  onSelect: (date: Timestamp) => void;
  onShowAll?: () => void;
}

function firstImage(os: PersonalOS, entryId: string): Attachment | null {
  return (
    os
      .journalAttachments(entryId)
      .find((attachment) => attachment.mimeType.startsWith("image/") && attachment.url) ?? null
  );
}

export function JournalRecentEntries({
  os,
  entries,
  selectedDate,
  onSelect,
  onShowAll,
}: JournalRecentEntriesProps) {
  const selectedKey = startOfDay(selectedDate);
  const recent = entries.slice(0, 6);

  if (recent.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Recent entries</h2>
        <p className="mt-2 text-sm text-ink-3">
          Nothing written yet. Pick a day in the calendar to start your first entry.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-3" data-testid="journal-recent">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h2 className="text-sm font-semibold text-ink">Recent entries</h2>
        {onShowAll ? (
          <button
            type="button"
            onClick={onShowAll}
            className="text-xs font-medium text-accent-ink hover:underline"
          >
            See all
          </button>
        ) : null}
      </div>

      <ul className="space-y-1">
        {recent.map((entry) => {
          const active = startOfDay(entry.entryDate) === selectedKey;
          const thumb = firstImage(os, entry.id);
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry.entryDate)}
                aria-current={active ? "date" : undefined}
                data-testid={`journal-recent-${entry.id}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                  active ? "bg-accent-soft" : "hover:bg-surface-2",
                )}
              >
                {thumb ? (
                  <img
                    src={thumb.url ?? ""}
                    alt=""
                    loading="lazy"
                    className="size-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3"
                  >
                    <ImageIcon className="size-4" />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm",
                      active ? "font-semibold text-accent-ink" : "font-medium text-ink",
                    )}
                  >
                    {journalEntryTitle(entry)}
                  </span>
                  <span className="block truncate text-xs text-ink-3">{shortDay(entry.entryDate)}</span>
                </span>

                <span aria-hidden="true" className="shrink-0 text-base leading-none">
                  {entry.mood ? moodEmoji(entry.mood) : <span className="text-ink-3">—</span>}
                </span>
                <span className="sr-only">
                  {entry.mood ? `Mood ${moodEmoji(entry.mood)}` : "No mood recorded"}.{" "}
                  {journalDayLabel(entry.entryDate)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}