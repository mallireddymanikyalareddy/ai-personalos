"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Briefcase, FileText, ListChecks, Repeat, Target } from "lucide-react";

import { CommandMenu, type CommandItem } from "@/components/ui/command-menu";
import type { AppState } from "@personalos/core";
import { useCommands } from "@/modules/command/command-context";
import { useAppState } from "@/store/use-os";

const MAX_PER_GROUP = 6;

function snippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 80)}…` : clean;
}

function buildSearchItems(state: AppState, push: (href: string) => void): CommandItem[] {
  const tasks: CommandItem[] = Object.values(state.tasks)
    .slice(0, MAX_PER_GROUP)
    .map((task) => ({
      id: `task:${task.id}`,
      label: task.title || "Untitled task",
      group: "Tasks",
      keywords: `${task.title} ${task.notes ?? ""} ${task.tags.join(" ")}`.toLowerCase(),
      description: snippet(
        [task.notes, ...task.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" · "),
      ),
      icon: <ListChecks className="size-4" aria-hidden="true" />,
      onSelect: () => push("/tasks"),
    }));

  const notes: CommandItem[] = Object.values(state.notes)
    .slice(0, MAX_PER_GROUP)
    .map((note) => ({
      id: `note:${note.id}`,
      label: note.title || "Untitled note",
      group: "Notes",
      keywords: `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase(),
      description: snippet(note.body || "Empty note"),
      icon: <FileText className="size-4" aria-hidden="true" />,
      onSelect: () => push("/notes"),
    }));

  const goals: CommandItem[] = Object.values(state.goals)
    .slice(0, MAX_PER_GROUP)
    .map((goal) => ({
      id: `goal:${goal.id}`,
      label: goal.title,
      group: "Goals",
      keywords: goal.title.toLowerCase(),
      description: snippet(goal.description),
      icon: <Target className="size-4" aria-hidden="true" />,
      onSelect: () => push("/goals"),
    }));

  const habits: CommandItem[] = Object.values(state.habits)
    .slice(0, MAX_PER_GROUP)
    .map((habit) => ({
      id: `habit:${habit.id}`,
      label: habit.title,
      group: "Habits",
      keywords: habit.title.toLowerCase(),
      description: habit.cadence,
      icon: <Repeat className="size-4" aria-hidden="true" />,
      onSelect: () => push("/habits"),
    }));

  const projects: CommandItem[] = Object.values(state.projects)
    .slice(0, MAX_PER_GROUP)
    .map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      group: "Work",
      keywords: project.name.toLowerCase(),
      icon: <Briefcase className="size-4" aria-hidden="true" />,
      onSelect: () => push("/work"),
    }));

  return [...tasks, ...notes, ...goals, ...habits, ...projects];
}

export function GlobalSearch() {
  const router = useRouter();
  const state = useAppState();
  const { searchOpen, closeSearch } = useCommands();

  const items = React.useMemo(
    () => buildSearchItems(state, (href) => router.push(href)),
    [router, state],
  );

  return (
    <CommandMenu
      open={searchOpen}
      onClose={closeSearch}
      items={items}
      placeholder="Search tasks, notes, goals, habits, projects…"
      emptyText="Nothing matches. Try another word, or capture it with ⌘K."
      a11yLabel="Global search"
    />
  );
}