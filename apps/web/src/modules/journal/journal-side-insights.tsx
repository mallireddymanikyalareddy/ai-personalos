"use client";

import * as React from "react";

import { Flame, Images, Sparkles, Tag, Brain, Send } from "lucide-react";

import { JOURNAL_MOODS } from "@personalos/core";
import type { JournalEntry, PersonalOS, Timestamp } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";

type Range = "7" | "30" | "90";

const RANGES: Array<{ value: Range; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export interface JournalSideInsightsProps {
  os: PersonalOS;
  entry: JournalEntry | null;
  now: Timestamp;
  onQuickCapture: (text: string) => void;
}

export function JournalSideInsights({
  os,
  entry,
  now,
  onQuickCapture,
}: JournalSideInsightsProps) {
  const [range, setRange] = React.useState<Range>("30");
  const [draft, setDraft] = React.useState("");

  const insights = os.journalMoodInsights(Number(range) as 7 | 30 | 90, now);
  const streak = os.journalStreak(now);
  const monthly = os.journalMonthlyReview(now);

  const monthStats = React.useMemo(() => {
    const entries = os.journalEntries().filter((candidate) => {
      const date = new Date(candidate.entryDate);
      const nowDate = new Date(now);
      return (
        date.getMonth() === nowDate.getMonth() && date.getFullYear() === nowDate.getFullYear()
      );
    });
    const tags = new Set<string>();
    let photos = 0;
    let memories = 0;
    for (const candidate of entries) {
      for (const tag of candidate.tags) tags.add(tag);
      photos += os
        .journalAttachments(candidate.id)
        .filter((attachment) => attachment.mimeType.startsWith("image/")).length;
      memories += candidate.lifeMemoryIds.length;
    }
    return { entries: entries.length, photos, tags: tags.size, memories };
  }, [os, now]);

  const submitCapture = () => {
    const value = draft.trim();
    if (!value || !entry) return;
    onQuickCapture(value);
    setDraft("");
  };

  return (
    <div className="space-y-3" data-testid="journal-side-insights">
      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            Mood insights
          </h2>
          <div className="w-32">
            <Segmented
              options={RANGES}
              value={range}
              onChange={setRange}
              label="Mood range"
            />
          </div>
        </div>

        {insights.sampleSize === 0 ? (
          <p className="text-sm text-ink-3">
            Record a mood on a few days and your patterns will appear here.
          </p>
        ) : (
          <>
            <div
              className="flex h-20 items-end gap-0.5"
              role="img"
              aria-label={`Mood score over the last ${insights.windowDays} days`}
            >
              {insights.points.map((point) => (
                <span
                  key={point.dateKey}
                  title={`${point.dateKey}: ${point.label}`}
                  className="flex-1 rounded-t-sm bg-accent/70"
                  style={{ height: `${Math.max(6, (point.score / 5) * 100)}%` }}
                />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div
                className="relative grid size-20 shrink-0 place-items-center"
                role="img"
                aria-label={`Average mood ${insights.average} out of 5`}
              >
                <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-surface-3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="stroke-success"
                    strokeDasharray={`${(insights.average / 5) * 97.4} 97.4`}
                  />
                </svg>
                <span className="absolute text-center">
                  <span className="block text-sm font-semibold tabular-nums text-ink">
                    {insights.average.toFixed(1)}/5
                  </span>
                  <span className="block text-[10px] text-ink-3">avg</span>
                </span>
              </div>

              <ul className="min-w-0 flex-1 space-y-0.5">
                {JOURNAL_MOODS.filter((mood) => (insights.distribution[mood.id] ?? 0) > 0).map(
                  (mood) => {
                    const count = insights.distribution[mood.id] ?? 0;
                    const pct = Math.round((count / Math.max(1, insights.sampleSize)) * 100);
                    return (
                      <li key={mood.id} className="flex items-center gap-1.5 text-xs">
                        <span aria-hidden="true">{mood.emoji}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-2">{mood.label}</span>
                        <span className="tabular-nums text-ink-3">{pct}%</span>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-warning" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Journal streak</h2>
          <span className="ml-auto text-xs text-ink-3">Longest {streak.longest}</span>
        </div>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
          {streak.current}
          <span className="ml-1 text-sm font-normal text-ink-3">
            {streak.current === 1 ? "day" : "days"}
          </span>
        </p>
        <p className="text-xs text-ink-3">
          {streak.current === 0
            ? "Write today to start a streak"
            : streak.writtenToday
              ? "Today is logged — keep it going"
              : "You haven't written today yet"}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">This month</h2>
        <div className="grid grid-cols-2 gap-2">
          <Tile icon={Sparkles} label="Entries" value={monthStats.entries} />
          <Tile icon={Images} label="Photos" value={monthStats.photos} />
          <Tile icon={Tag} label="Tags" value={monthStats.tags} />
          <Tile icon={Brain} label="Memories" value={monthStats.memories} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">Quick capture</h2>
        <p className="mb-2 text-xs text-ink-3">
          {entry ? "Jot a line without leaving the page." : "Pick a day to start writing."}
        </p>
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitCapture();
              }
            }}
            disabled={!entry}
            placeholder="What's on your mind?"
            aria-label="Quick capture"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
          <Button
            size="icon-sm"
            variant="primary"
            aria-label="Save quick capture"
            disabled={!entry || draft.trim().length === 0}
            onClick={submitCapture}
          >
            <Send className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <p className="text-xs text-ink-3">
        Patterns come from {monthly.entryCount} entries this month. Observations only — not a clinical assessment.
      </p>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface-2 p-2 text-center")}>
      <Icon className="mx-auto size-3.5 text-ink-3" aria-hidden="true" />
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink-3">{label}</p>
    </div>
  );
}