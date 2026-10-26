"use client";

import * as React from "react";

import { JOURNAL_MOODS, moodLabel, type JournalEntry } from "@personalos/core";

import { cn } from "@/lib/cn";

export interface JournalScalesProps {
  entry: JournalEntry;
  onChange: (patch: Partial<JournalEntry>) => void;
}

const SCALE = Array.from({ length: 10 }, (_, index) => index + 1);

export function JournalScales({ entry, onChange }: JournalScalesProps) {
  const moodLabelText = entry.mood ? moodLabel(entry.mood) : "Not recorded";

  return (
    <section
      className="grid gap-2 sm:grid-cols-3"
      aria-label="Mood, energy and productivity"
      data-testid="journal-scales"
    >
      <div className="rounded-xl border border-line bg-surface p-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <span aria-hidden="true">
            {entry.mood ? JOURNAL_MOODS.find((m) => m.id === entry.mood)?.emoji ?? "—" : "—"}
          </span>
          Mood
        </label>
        <select
          value={entry.mood ?? ""}
          aria-label="Mood"
          onChange={(event) => onChange({ mood: event.target.value || null })}
          className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">Not recorded</option>
          {JOURNAL_MOODS.map((mood) => (
            <option key={mood.id} value={mood.id}>
              {mood.emoji} {mood.label}
            </option>
          ))}
        </select>
        <p className="mt-1 truncate text-xs text-ink-3">{moodLabelText}</p>
      </div>

      <ScaleBar
        label="Energy"
        value={entry.energy}
        onChange={(energy) => onChange({ energy })}
        tone="bg-success"
      />
      <ScaleBar
        label="Productivity"
        value={entry.productivity}
        onChange={(productivity) => onChange({ productivity })}
        tone="bg-info"
      />
    </section>
  );
}

function ScaleBar({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        <span className="text-xs tabular-nums text-ink-3">
          {value == null ? "—" : `${value}/10`}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-0.5"
      >
        {SCALE.map((step) => {
          const filled = value != null && step <= value;
          const current = value === step;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={current}
              aria-label={`${label} ${step} of 10`}
              data-testid={`${label.toLowerCase()}-${step}`}
              onClick={() => onChange(current ? null : step)}
              className={cn(
                "h-5 flex-1 rounded-sm transition-colors",
                filled ? tone : "bg-surface-3",
                current && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}