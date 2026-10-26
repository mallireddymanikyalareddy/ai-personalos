"use client";

import * as React from "react";

import {
  Camera,
  MapPin,
  Paperclip,
  Plus,
  Tag as TagIcon,
  Thermometer,
  Trash2,
  Users,
} from "lucide-react";

import { journalDayLabel } from "@personalos/core";
import type { Attachment, JournalEntry, PersonalOS, Timestamp } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { JournalAIPanel } from "./journal-ai-panel";
import { JournalCalendar } from "./journal-calendar";
import { JournalEditor } from "./journal-editor";
import { JournalLinks } from "./journal-links";
import { JournalRecentEntries } from "./journal-recent-entries";
import { JournalReflectionGrid } from "./journal-reflection-grid";
import { JournalScales } from "./journal-scales";
import { JournalSideInsights } from "./journal-side-insights";

export interface JournalWorkspaceProps {
  os: PersonalOS;
  entry: JournalEntry | null;
  entries: JournalEntry[];
  selectedDate: Timestamp;
  saveState: "saved" | "saving" | "error";
  attachments: Attachment[];
  onSelectDate: (date: Timestamp) => void;
  onPatch: (patch: Partial<JournalEntry>) => void;
  onSaveState: (state: "saved" | "saving" | "error") => void;
  onAddFiles: (files: FileList | null) => void;
  onShowAll: () => void;
  onTrash?: () => void;
  weekStart?: 0 | 1;
}

export function JournalWorkspace({
  os,
  entry,
  entries,
  selectedDate,
  saveState,
  attachments,
  onSelectDate,
  onPatch,
  onSaveState,
  onAddFiles,
  onShowAll,
  onTrash = () => undefined,
  weekStart = 1,
}: JournalWorkspaceProps) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const attachmentRef = React.useRef<HTMLInputElement | null>(null);
  const photos = attachments.filter((attachment) => attachment.mimeType.startsWith("image/"));
  const now = Date.now();

  const quickCapture = (text: string) => {
    if (!entry) return;
    const separator = entry.body.trim().length > 0 ? "\n" : "";
    onPatch({ body: `${entry.body}${separator}${text}` });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_20rem] 2xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      <div className="space-y-3" data-testid="journal-left-panel">
        <JournalCalendar
          os={os}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
          weekStart={weekStart}
        />
        <JournalRecentEntries
          os={os}
          entries={entries}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
          onShowAll={onShowAll}
        />
      </div>

      <div className="min-w-0 space-y-3" data-testid="journal-center-panel">
        {entry === null ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center">
            <p className="text-base font-medium text-ink">Nothing written for this day</p>
            <p className="mt-1 text-sm text-ink-3">
              Pick another date, or start writing — every field is optional.
            </p>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2
                  className="text-lg font-semibold tracking-tight text-ink"
                  data-testid="journal-day-heading"
                >
                  {journalDayLabel(entry.entryDate)}
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                  {entry.weather?.label ? (
                    <span className="inline-flex items-center gap-1">
                      <Thermometer className="size-3" aria-hidden="true" />
                      {entry.weather.label}
                    </span>
                  ) : null}
                  {entry.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden="true" />
                      {entry.location}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  aria-live="polite"
                  className={cn(
                    "text-xs",
                    saveState === "error" ? "text-danger" : "text-ink-3",
                  )}
                >
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "error"
                      ? "Could not save"
                      : "Saved just now"}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move entry to trash"
                  onClick={onTrash}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </header>

            <JournalScales entry={entry} onChange={onPatch} />

            <JournalEditor
              key={entry.id}
              entry={entry}
              onChange={onPatch}
              onSaveStateChange={onSaveState}
            />

            <section className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                {photos.map((attachment) => (
                  <figure key={attachment.id} className="relative size-16 overflow-hidden rounded-lg">
                    <img src={attachment.url ?? ""} alt={attachment.name} className="size-full object-cover" />
                  </figure>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid size-16 place-items-center rounded-lg border border-dashed border-line-strong text-ink-3 transition-colors hover:border-accent hover:text-accent-ink"
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <Camera className="size-4" aria-hidden="true" />
                    <span className="text-[10px]">Add photos</span>
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  aria-label="Add photos to this entry"
                  onChange={(event) => {
                    onAddFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <span className="ml-auto text-xs tabular-nums text-ink-3">
                  {entry.wordCount} words
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                <QuickAdd
                  icon={TagIcon}
                  label="Add Tag"
                  ariaLabel="Add a tag to this entry"
                  placeholder="e.g. work"
                  values={entry.tags}
                  onSubmit={(tag) => onPatch({ tags: [...entry.tags, tag] })}
                />
                <QuickAdd
                  icon={Users}
                  label="Add People"
                  ariaLabel="Add a person to this entry"
                  placeholder="e.g. Priya"
                  values={entry.people.map((person) => person.name)}
                  onSubmit={(name) =>
                    onPatch({
                      people: [
                        ...entry.people,
                        { id: `${name}-${Date.now()}`, name },
                      ],
                    })
                  }
                />
                <QuickAdd
                  icon={Plus}
                  label="Add Activity"
                  ariaLabel="Add an activity to this entry"
                  placeholder="e.g. running"
                  values={entry.activities}
                  onSubmit={(activity) => onPatch({ activities: [...entry.activities, activity] })}
                />
                <button
                  type="button"
                  onClick={() => attachmentRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Paperclip className="size-3.5" aria-hidden="true" />
                  Add Attachment
                </button>
                <input
                  ref={attachmentRef}
                  type="file"
                  multiple
                  className="sr-only"
                  aria-label="Add an attachment to this entry"
                  onChange={(event) => {
                    onAddFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </div>
            </section>

            <JournalReflectionGrid entry={entry} onChange={onPatch} />

            <JournalLinks os={os} entry={entry} onChange={onPatch} />
          </>
        )}
      </div>

      <div className="space-y-3" data-testid="journal-right-panel">
        {entry ? <JournalAIPanel os={os} entry={entry} /> : null}
        <JournalSideInsights
          os={os}
          entry={entry}
          now={now}
          onQuickCapture={quickCapture}
        />
      </div>
    </div>
  );
}

function QuickAdd({
  icon: Icon,
  label,
  ariaLabel,
  placeholder,
  values,
  onSubmit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ariaLabel: string;
  placeholder: string;
  values: string[];
  onSubmit: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const submit = () => {
    const value = draft.trim();
    if (!value) return;
    if (values.some((existing) => existing.toLowerCase() === value.toLowerCase())) return;
    onSubmit(value);
    setDraft("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape") {
            setOpen(false);
            setDraft("");
          }
        }}
        onBlur={submit}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-32 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <Button size="icon-sm" variant="secondary" aria-label={`Confirm ${label}`} onMouseDown={submit}>
        <Plus className="size-3.5" aria-hidden="true" />
      </Button>
    </span>
  );
}
