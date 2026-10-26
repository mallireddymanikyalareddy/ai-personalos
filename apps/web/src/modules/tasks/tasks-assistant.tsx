"use client";

import * as React from "react";

import { ModelLabel } from "@/components/ai/model-label";

import type { LucideIcon } from "lucide-react";

import { ListPlus, Lightbulb, Network, MoreHorizontal, Sparkles, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";

import type { TaskStatTile } from "@personalos/core";

export interface TaskAssistantProps {
  stats: TaskStatTile[];
  question: string;
  answer: string | null;
  onAsk: (question: string) => void;
  onCreateFromText: (text: string) => void;
  onBreakDown: () => void;
  onPrioritize: () => void;
  onSuggest: () => void;
  onOpenAssistant: () => void;
}

const ACTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "create", label: "Create from text", icon: ListPlus },
  { id: "breakdown", label: "Break down task", icon: Network },
  { id: "prioritize", label: "Prioritize my tasks", icon: Star },
  { id: "suggest", label: "Suggest next steps", icon: Lightbulb },
];

export function TaskAssistant({
  stats,
  question,
  answer,
  onAsk,
  onCreateFromText,
  onBreakDown,
  onPrioritize,
  onSuggest,
  onOpenAssistant,
}: TaskAssistantProps) {
  const [createText, setCreateText] = React.useState("");
  const done = stats.find((tile) => tile.id === "completed")?.value ?? 0;
  const overdue = stats.find((tile) => tile.id === "overdue")?.value ?? 0;
  const dueToday = stats.find((tile) => tile.id === "dueToday")?.value ?? 0;

  const run = (id: string) => {
    if (id === "create") {
      if (createText.trim().length === 0) return;
      onCreateFromText(createText.trim());
      setCreateText("");
      return;
    }
    if (id === "breakdown") {
      onBreakDown();
      return;
    }
    if (id === "prioritize") {
      onPrioritize();
      return;
    }
    onSuggest();
  };

  return (
    <section
      aria-label="AI Task Assistant"
      data-testid="tasks-assistant"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI Task Assistant
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
                  { label: "Analyze my progress", onSelect: () => window.location.assign("/analytics") },
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
          onAsk(question);
        }}
      >
        <Input
          value={question}
          onChange={(event) => onAsk(event.target.value)}
          placeholder="Ask me to create, prioritize or break down tasks…"
          aria-label="Ask the task assistant"
        />
        <Button type="submit" variant="primary" size="sm">
          Ask
        </Button>
      </form>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              data-testid={`tasks-assistant-${action.id}`}
              onClick={() => run(action.id)}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
            >
              <Icon className="size-4 shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="min-w-0 truncate text-[12px] font-medium text-ink-2">{action.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={createText}
          onChange={(event) => setCreateText(event.target.value)}
          placeholder="Type a task to capture…"
          aria-label="Task text to create"
        />
      </div>

      {answer ? (
        <p
          data-testid="tasks-assistant-answer"
          className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
        >
          {answer}
        </p>
      ) : null}

      <p className="mt-3 text-[10px] text-ink-3" data-testid="tasks-assistant-stats">
        {done} completed · {dueToday} due today · {overdue} overdue
      </p>
    </section>
  );
}