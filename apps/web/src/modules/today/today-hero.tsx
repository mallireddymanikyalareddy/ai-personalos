"use client";

import * as React from "react";

import { ArrowUpRight, Clock, Flame, ListChecks, Smile } from "lucide-react";

import type { TodayStats, TodayWelcome } from "@personalos/core";

import { useToast } from "@/components/ui/toast";
import { DropdownMenu } from "@/components/ui/dropdown";
import { useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { formatDuration } from "./use-today-now";

const MOOD_EMOJI: Record<string, string> = {
  happy: "\u{1F60A}",
  excited: "\u{1F929}",
  calm: "\u{1F60C}",
  neutral: "\u{1F610}",
  tired: "\u{1F634}",
  stressed: "\u{1F624}",
  sad: "\u{1F622}",
  frustrated: "\u{1F621}",
};

export function TodayHero({
  welcome,
  stats,
  day,
  onAddMemory,
}: {
  welcome: TodayWelcome;
  stats: TodayStats;
  day: number;
  onAddMemory: () => void;
}) {
  return (
    <section
      aria-label="Welcome"
      data-testid="today-hero"
      className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-info-soft via-surface to-accent-soft p-5 shadow-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60rem 20rem at 110% -20%, var(--accent-soft), transparent 60%), radial-gradient(40rem 18rem at -10% 120%, var(--info-soft), transparent 60%)",
        }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-2">{welcome.greeting},</p>
          <h2 className="text-3xl font-semibold tracking-tight text-ink">
            {welcome.displayName} <span aria-hidden="true">{"\u{1F44B}"}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-2">{welcome.message}</p>
        </div>
        <blockquote className="max-w-xs text-sm italic leading-relaxed text-ink-2">
          &ldquo;{welcome.quote}&rdquo;
        </blockquote>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          icon={Clock}
          label="Focus Time"
          value={formatDuration(stats.focusMin)}
          delta={stats.focusDeltaPct}
        />
        <StatTile
          icon={ListChecks}
          label="Tasks Completed"
          value={`${stats.tasksDone} / ${stats.tasksTotal}`}
          delta={stats.taskDeltaPct}
        />
        <StatTile
          icon={Flame}
          label="Habit Streak"
          value={stats.habitStreak > 0 ? `${stats.habitStreak} days` : "—"}
        />
        <MoodTile stats={stats} day={day} />
      </div>

      <div className="relative mt-3 flex justify-end">
        <button
          type="button"
          onClick={onAddMemory}
          className="text-xs font-medium text-accent-ink underline-offset-2 hover:underline"
        >
          Add a memory
        </button>
      </div>
    </section>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/90 p-2.5 shadow-card">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-accent" aria-hidden="true" />
        <span className="truncate text-[11px] text-ink-3">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-ink">{value}</span>
        {delta != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
              delta >= 0 ? "text-success" : "text-danger",
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="size-3" aria-hidden="true" />
            ) : null}
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MoodTile({ stats, day }: { stats: TodayStats; day: number }) {
  const os = useOS();
  const { toast } = useToast();

  const setMood = (id: string) => {
    const entry = os.journalEntryFor(day);
    if (!entry) {
      toast("Write a journal entry for this day first to track your mood");
      return;
    }
    os.updateJournalEntry(entry.id, { mood: id });
    toast("Mood updated");
  };

  return (
    <div className="relative rounded-xl border border-line bg-surface/90 p-2.5 shadow-card">
      <div className="flex items-center gap-1.5">
        <Smile className="size-3.5 text-accent" aria-hidden="true" />
        <span className="truncate text-[11px] text-ink-3">Mood</span>
      </div>
      <DropdownMenu
        align="end"
        sections={[
          {
            label: "How are you feeling?",
            items: stats.moodOptions.map((option) => ({
              label: option.label,
              icon: <span aria-hidden="true">{MOOD_EMOJI[option.id] ?? "\u{1F610}"}</span>,
              selected: stats.moodId === option.id,
              onSelect: () => setMood(option.id),
            })),
          },
        ]}
        trigger={
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-1.5 text-left"
            aria-label={`Mood: ${stats.moodLabel ?? "not set"}. Change mood`}
          >
            <span className="text-lg" aria-hidden="true">
              {stats.moodId ? (MOOD_EMOJI[stats.moodId] ?? "\u{1F610}") : "\u{1F914}"}
            </span>
            <span className="text-sm font-semibold text-ink">{stats.moodLabel ?? "Set"}</span>
          </button>
        }
      />
    </div>
  );
}