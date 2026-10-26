"use client";

import * as React from "react";

import { Bell, CheckCircle2, FolderPlus } from "lucide-react";

import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

export interface QuickAddProps {
  text: string;
  onChange: (text: string) => void;
  onAdd: (kind: "task" | "project" | "reminder") => void;
}

const CHIPS: { kind: "task" | "project" | "reminder"; label: string; icon: LucideIcon }[] = [
  { kind: "task", label: "Task", icon: CheckCircle2 },
  { kind: "project", label: "Project", icon: FolderPlus },
  { kind: "reminder", label: "Reminder", icon: Bell },
];

export function QuickAdd({ text, onChange, onAdd }: QuickAddProps) {
  return (
    <section
      aria-label="Quick Add"
      data-testid="tasks-quick-add"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Quick Add</h2>
        <a href="/planner" className="text-xs font-medium text-accent-ink hover:underline">
          Add instantly
        </a>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim().length > 0) onAdd("task");
        }}
      >
        <Input
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What do you want to do?"
          aria-label="Quick add task"
        />
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.kind}
              type="button"
              data-testid={`tasks-quick-add-${chip.kind}`}
              onClick={() => onAdd(chip.kind)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-3"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {chip.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}