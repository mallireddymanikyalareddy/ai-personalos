"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import { CalendarDays, CheckSquare, Clock, Users } from "lucide-react";

import type { MeetingParticipantRow, MeetingTopicRow, MeetingsStats } from "@personalos/core";

import { DropdownMenu } from "@/components/ui/dropdown";

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function MeetingInsights({
  stats,
  topics,
  participants,
  period,
  onPeriodChange,
}: {
  stats: MeetingsStats;
  topics: MeetingTopicRow[];
  participants: MeetingParticipantRow[];
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const tiles: { id: string; label: string; value: string; icon: LucideIcon; tone: string }[] = [
    {
      id: "meetings",
      label: "Meetings",
      value: String(stats.meetings),
      icon: CalendarDays,
      tone: "bg-accent-soft text-accent-ink",
    },
    {
      id: "duration",
      label: "Total Duration",
      value: formatDuration(stats.totalDurationMin),
      icon: Clock,
      tone: "bg-info-soft text-info",
    },
    {
      id: "participants",
      label: "Participants",
      value: String(stats.participants),
      icon: Users,
      tone: "bg-success-soft text-success",
    },
    {
      id: "actions",
      label: "Action Items",
      value: String(stats.actionItems),
      icon: CheckSquare,
      tone: "bg-warning-soft text-warning",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3" data-testid="meeting-insights">
      <section
        aria-label="Meeting Insights"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Meeting Insights</h2>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: "Period",
                items: ["Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"].map((option) => ({
                  label: option,
                  selected: period === option,
                  onSelect: () => onPeriodChange(option),
                })),
              },
            ]}
            trigger={
              <button
                type="button"
                className="rounded-lg border border-line px-2 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
                aria-label="Insight period"
              >
                {period}
              </button>
            }
          />
        </header>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.id} data-testid={`meeting-insight-${tile.id}`} className="rounded-xl border border-line p-2.5">
                <span className={`grid size-7 place-items-center rounded-lg ${tile.tone}`} aria-hidden="true">
                  <Icon className="size-3.5" />
                </span>
                <p className="mt-1.5 text-lg font-bold tabular-nums text-ink">{tile.value}</p>
                <p className="text-[11px] text-ink-3">{tile.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Topics Discussed"
        data-testid="meeting-topics"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Topics Discussed</h2>
          <a href="/analytics" className="text-[11px] font-medium text-accent-ink hover:underline">
            View more
          </a>
        </header>
        {topics.length === 0 ? (
          <p className="text-[12px] text-ink-3">No topics yet — import a transcript to see what came up.</p>
        ) : (
          <ul className="space-y-2">
            {topics.map((topic, index) => (
              <li key={topic.label} data-testid="meeting-topic-row" className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-[11px] capitalize text-ink-2">
                  {topic.label}
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(4, topic.pct)}%`,
                      backgroundColor: `var(--chart-${(index % 8) + 1})`,
                    }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-ink-3">
                  {topic.pct}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Participants"
        data-testid="meeting-participants"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Participants</h2>
          <a href="/people" className="text-[11px] font-medium text-accent-ink hover:underline">
            View all
          </a>
        </header>
        {participants.length === 0 ? (
          <p className="text-[12px] text-ink-3">No participants yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {participants.slice(0, 8).map((participant) => (
              <li key={participant.id} className="flex w-16 flex-col items-center gap-1 text-center">
                <span
                  className="grid size-9 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-ink"
                  aria-hidden="true"
                >
                  {initials(participant.name)}
                </span>
                <span className="w-full truncate text-[11px] font-medium text-ink">{participant.name}</span>
                <span className="text-[10px] text-ink-3">
                  {participant.meetings} meeting{participant.meetings === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
