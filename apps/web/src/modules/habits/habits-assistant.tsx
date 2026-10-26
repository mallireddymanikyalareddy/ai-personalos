"use client";

import * as React from "react";

import { ModelLabel } from "@/components/ai/model-label";

import type { LucideIcon } from "lucide-react";

import { BarChart3, CalendarPlus, Heart, Lightbulb, MoreHorizontal, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";

import type { HabitStatsSummary } from "@personalos/core";

export interface HabitAssistantProps {
  stats: HabitStatsSummary;
  question: string;
  answer: string | null;
  onAsk: (question: string) => void;
  onCreate: () => void;
  onMotivate: () => void;
  suggestionTitles: string[];
  onAddSuggestion: (title: string) => void;
  onOpenAssistant: () => void;
}

const ACTIONS: { id: string; label: string; icon: LucideIcon; href?: string; onSelect?: () => void }[] = [
  { id: "suggest", label: "Suggest new habits", icon: Lightbulb },
  { id: "progress", label: "Analyze my progress", icon: BarChart3, href: "/insights" },
  { id: "plan", label: "Create a habit plan", icon: CalendarPlus },
  { id: "motivate", label: "Give me motivation", icon: Heart },
];

export function HabitAssistant({
  stats,
  question,
  answer,
  onAsk,
  onCreate,
  onMotivate,
  suggestionTitles,
  onAddSuggestion,
  onOpenAssistant,
}: HabitAssistantProps) {
  const [draft, setDraft] = React.useState("");

  const actions = React.useMemo(
    () =>
      ACTIONS.map((action) => {
        if (action.id === "suggest") return { ...action, onSelect: () => onAsk("Suggest new habits") };
        if (action.id === "plan") return { ...action, onSelect: onCreate };
        if (action.id === "motivate") return { ...action, onSelect: onMotivate };
        return action;
      }),
    [onAsk, onCreate, onMotivate],
  );

  return (
    <section
      aria-label="AI Habit Assistant"
      data-testid="habits-assistant"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI Habit Assistant
        </h2>
        <div className="flex items-center gap-1.5">
          <Badge tone="outline"><ModelLabel /></Badge>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: "Assistant",
                items: [
                  { label: "Open AI Assistant", onSelect: onOpenAssistant },
                  { label: "Analyze my progress", onSelect: () => window.location.assign("/insights") },
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
                aria-label="Assistant options"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </header>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim().length === 0) return;
          onAsk(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="How can I help with your habits today?"
          aria-label="Ask the habit assistant"
        />
        <Button type="submit" variant="primary" size="sm">
          Ask
        </Button>
      </form>

      <div className="mt-3 space-y-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <Icon className="size-4 shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-ink-2">
                {action.label}
              </span>
            </>
          );
          const className =
            "flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong hover:bg-surface-3";

          if (action.href) {
            return (
              <a
                key={action.id}
                href={action.href}
                data-testid={`habits-assistant-${action.id}`}
                className={className}
              >
                {content}
              </a>
            );
          }

          return (
            <button
              key={action.id}
              type="button"
              data-testid={`habits-assistant-${action.id}`}
              onClick={() => action.onSelect?.()}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>

      {suggestionTitles.length > 0 && question.trim().toLowerCase().includes("suggest") ? (
        <ul className="mt-3 space-y-1.5" data-testid="habits-assistant-suggestions">
          {suggestionTitles.map((title) => (
            <li key={title}>
              <button
                type="button"
                onClick={() => onAddSuggestion(title)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-left text-[12px] text-ink-2 hover:border-accent hover:text-accent-ink"
              >
                <span className="truncate">Add “{title}”</span>
                <span className="shrink-0 text-[11px] font-semibold">Add</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {answer ? (
        <p
          data-testid="habits-assistant-answer"
          className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
        >
          {answer}
        </p>
      ) : null}

      <p className="mt-3 text-[10px] text-ink-3" data-testid="habits-assistant-stats">
        {stats.totalActive} active habits · {stats.totalCheckIns} total check-ins
      </p>
    </section>
  );
}