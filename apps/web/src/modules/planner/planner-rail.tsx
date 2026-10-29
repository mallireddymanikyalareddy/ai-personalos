"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  CalendarClock,
  Clock,
  Crosshair,
  Hourglass,
  MoreHorizontal,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AIAnswer } from "@/components/ai/ai-answer";
import { DropdownMenu } from "@/components/ui/dropdown";

export interface FocusSlice {
  key: string;
  label: string;
  minutes: number;
  color: string;
}

export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function PlannerAssistant({
  providerLabel,
  onPlanDay,
  onTimeBlock,
  onOptimize,
  onFindFocus,
  onGenerate,
  onBuffers,
  onToggleExpanded,
  expanded,
  answer,
  creditsNote,
}: {
  providerLabel: string;
  onPlanDay: () => void;
  onTimeBlock: () => void;
  onOptimize: () => void;
  onFindFocus: () => void;
  onGenerate: () => void;
  onBuffers: () => void;
  onToggleExpanded: () => void;
  expanded: boolean;
  answer: string | null;
  creditsNote?: string;
}) {
  const tools: { id: string; label: string; icon: LucideIcon; onClick: () => void }[] = [
    { id: "plan", label: "Plan my day", icon: CalendarClock, onClick: onPlanDay },
    { id: "block", label: "Time block tasks", icon: Clock, onClick: onTimeBlock },
    { id: "optimize", label: "Optimize my schedule", icon: Wand2, onClick: onOptimize },
    { id: "focus", label: "Find focus time", icon: Crosshair, onClick: onFindFocus },
    { id: "buffers", label: "Suggest buffers", icon: Hourglass, onClick: onBuffers },
  ];

  return (
    <section
      aria-label="AI Planning Assistant"
      data-testid="planner-assistant"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI Planning Assistant
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className="max-w-24 truncate rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3"
            title={`Active AI model: ${providerLabel}`}
          >
            {providerLabel}
          </span>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: "Planning",
                items: [
                  { label: expanded ? "Hide options" : "Show options", onSelect: onToggleExpanded },
                  { label: "Plan my day", onSelect: onPlanDay },
                  { label: "Optimize schedule", onSelect: onOptimize },
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                aria-label="Assistant options"
                className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </header>

      <p className="rounded-xl bg-surface-2/70 p-2.5 text-[12px] leading-snug text-ink-3">
        Create a realistic plan for today based on my tasks, meetings and goals…
      </p>

      {expanded ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                data-testid={`planner-tool-${tool.id}`}
                onClick={tool.onClick}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
              >
                <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                <span className="min-w-0 truncate text-[11px] font-medium text-ink-2">{tool.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        data-testid="planner-generate-plan"
        onClick={onGenerate}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-accent-strong"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        Generate Plan
      </button>

      {answer ? (
        <AIAnswer
          text={answer}
          testId="planner-assistant-answer"
          className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-[12px]"
        />
      ) : null}
      {creditsNote ? (
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="planner-assistant-credits">
          {creditsNote}
        </p>
      ) : null}
    </section>
  );
}

export function FocusTimeCard({
  slices,
  totalMinutes,
  period,
  onPeriodChange,
}: {
  slices: FocusSlice[];
  totalMinutes: number;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const total = Math.max(1, slices.reduce((sum, slice) => sum + slice.minutes, 0));
  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-label="Focus and Time"
      data-testid="planner-focus"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Clock className="size-4 text-accent-ink" aria-hidden="true" />
          Focus &amp; Time
        </h2>
        <DropdownMenu
          align="end"
          sections={[
            {
              label: "Period",
              items: ["This Week", "This Month", "Today"].map((option) => ({
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
              aria-label="Focus period"
            >
              {period}
            </button>
          }
        />
      </header>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0" data-testid="planner-focus-donut">
          <svg width={112} height={112} viewBox="0 0 112 112" role="img" aria-label={`${formatHours(totalMinutes)} focused`}>
            <circle cx={56} cy={56} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={12} />
            {slices.map((slice) => {
              const length = (slice.minutes / total) * circumference;
              const element = (
                <circle
                  key={slice.key}
                  cx={56}
                  cy={56}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 56 56)"
                  data-testid={`planner-focus-slice-${slice.key}`}
                />
              );
              offset += length;
              return element;
            })}
          </svg>
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <span>
              <span className="block text-lg font-bold tabular-nums text-ink">{formatHours(totalMinutes)}</span>
              <span className="block text-[10px] text-ink-3">Focused Time</span>
            </span>
          </span>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2 text-[12px]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink-2">{slice.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-ink">{formatHours(slice.minutes)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export interface PriorityRow {
  id: string;
  title: string;
  description: string;
  priority: number;
  priorityLabel: string;
}

export function TodaysPriorities({ rows }: { rows: PriorityRow[] }) {
  const tone = (priority: number) => (priority >= 3 ? "danger" : priority === 2 ? "warning" : "neutral");

  return (
    <section
      aria-label="Today's Priorities"
      data-testid="planner-priorities"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Target className="size-4 text-accent-ink" aria-hidden="true" />
          Today&apos;s Priorities
        </h2>
        <a href="/tasks" className="text-xs font-medium text-accent-ink hover:underline">
          Manage
        </a>
      </header>

      {rows.length === 0 ? (
        <p className="text-[12px] text-ink-3">Nothing prioritised yet. Add tasks or let AI plan your day.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.id} data-testid="planner-priority-row" className="flex items-start gap-2">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-surface-2 text-[11px] font-semibold tabular-nums text-ink-3">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{row.title}</span>
                  <Badge tone={tone(row.priority)}>{row.priorityLabel}</Badge>
                </span>
                <span className="block truncate text-[11px] text-ink-3">{row.description}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}