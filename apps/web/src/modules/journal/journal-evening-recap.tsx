"use client";

import { MoonStar } from "lucide-react";

import { AIRecapCard } from "@/components/ai/ai-recap-card";
import { getOS } from "@/store/os";

const PROMPT =
  "Write my evening recap in 3-5 short lines: what I got done today (completed tasks, habits, journal), what's still open, " +
  "and a clear suggestion for tomorrow's single most important focus. Warm, honest, no headings.";

const localReview = () => getOS().aiRun("review my day", { now: Date.now() }).message;

export function JournalEveningRecap() {
  return (
    <AIRecapCard
      id="journal-evening-recap"
      title="Evening reflection"
      icon={MoonStar}
      prompt={PROMPT}
      localFallback={localReview}
      autoRun={new Date().getHours() >= 17}
      idleHint="Sum up your day and get tomorrow's focus. Runs automatically after 5pm."
    />
  );
}
