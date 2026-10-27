"use client";

import { Sunrise } from "lucide-react";

import { AIRecapCard } from "@/components/ai/ai-recap-card";
import { getOS } from "@/store/os";

const PROMPT =
  "Write my morning briefing for today in 3-5 short lines: the most important tasks (mention anything overdue or due today), " +
  "habits to keep up, and one goal to move forward. End with one encouraging, practical suggestion. No headings.";

const localPlan = () => getOS().aiRun("plan my day", { now: Date.now() }).message;

export function TodayBriefing() {
  return (
    <AIRecapCard
      id="today-briefing"
      title="Morning briefing"
      icon={Sunrise}
      prompt={PROMPT}
      localFallback={localPlan}
      action="daily_plan"
      autoRun
      idleHint=""
    />
  );
}
