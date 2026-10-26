"use client";

import { MoonStar } from "lucide-react";

import { AIRecapCard } from "@/components/ai/ai-recap-card";
import { getOS } from "@/store/os";

const PROMPT =
  "Write my evening recap in 3-5 short lines: what I got done today (completed tasks, habits, journal), what's still open, " +
  "and a clear suggestion for tomorrow's single most important focus. Warm, honest, no headings.";

function localRecap(): string {
  const state = getOS().getState();
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const dayEnd = dayStart + 86_400_000;
  const tasks = Object.values(state.tasks);
  const done = tasks.filter((t) => t.status === "done" && (t.completedAt ?? 0) >= dayStart);
  const open = tasks.filter((t) => !["done", "cancelled", "archived"].includes(t.status));
  const dueOpen = open.filter((t) => t.dueAt != null && t.dueAt < dayEnd);
  const wrote = Object.values(state.journalEntries).some((e) => e.updatedAt >= dayStart);
  const focus = [...open].sort(
    (a, b) => b.priority - a.priority || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity),
  )[0];
  const lines = [
    done.length > 0
      ? `You finished ${done.length} task${done.length === 1 ? "" : "s"} today: ${done.slice(0, 3).map((t) => t.title).join(", ")}.`
      : "No tasks were marked done today — that's okay, rest counts too.",
    dueOpen.length > 0
      ? `${dueOpen.length} item${dueOpen.length === 1 ? " is" : "s are"} still open from today or earlier.`
      : "Nothing overdue is waiting for you.",
    wrote ? "You journaled today — nice reflection habit." : "Take a minute to jot down one thing you're grateful for.",
    focus ? `Tomorrow's focus: ${focus.title}.` : "Tomorrow's focus: pick one meaningful task and start there.",
  ];
  return lines.join("\n");
}

export function JournalEveningRecap() {
  return (
    <AIRecapCard
      id="journal-evening-recap"
      title="Evening reflection"
      icon={MoonStar}
      prompt={PROMPT}
      localFallback={localRecap}
      autoRun={new Date().getHours() >= 17}
      idleHint="Sum up your day and get tomorrow's focus. Runs automatically after 5pm."
    />
  );
}
