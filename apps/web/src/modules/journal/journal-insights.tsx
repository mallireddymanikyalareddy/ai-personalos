"use client";

import * as React from "react";

import { AlertTriangle } from "lucide-react";

import { formatFocusMinutes } from "@personalos/core";
import type { PersonalOS } from "@personalos/core";
import type { Timestamp } from "@personalos/core";

import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";

type Range = "7" | "30" | "90" | "365";

const RANGES: Array<{ value: Range; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

interface JournalInsightsProps {
  os: PersonalOS;
  now: Timestamp;
}

export function JournalInsights({ os, now }: JournalInsightsProps) {
  const [range, setRange] = React.useState<Range>("30");
  const insights = os.journalMoodInsights(Number(range) as 7 | 30 | 90 | 365, now);
  const streak = os.journalStreak(now);
  const weekly = os.journalWeeklyReview(now);
  const monthly = os.journalMonthlyReview(now);

  if (insights.sampleSize === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No mood data yet"
        description="Record a mood in a couple of entries and this page will show your observed patterns."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Insights</h2>
        <Segmented options={RANGES} value={range} onChange={setRange} label="Insight range" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Average mood" value={`${insights.average} / 5`} detail={`${insights.sampleSize} entries`} />
        <Stat label="Positive days" value={`${insights.positiveDays}`} detail="Mood 4 or 5" />
        <Stat label="Stressed days" value={`${insights.stressedDays}`} detail="Recorded stressed" />
        <Stat
          label="Journal streak"
          value={streak.current === 1 ? "1 day" : `${streak.current} days`}
          detail={`Longest ${streak.longest}`}
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="text-sm font-medium">Mood trend</h3>
        <p className="mt-1 text-xs text-ink-3">
          {insights.trend === "up"
            ? "Observed pattern: the trend across this window is upward."
            : insights.trend === "down"
              ? "Observed pattern: the trend across this window is downward."
              : "Observed pattern: mood is steady across this window."}
        </p>
        <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label="Mood score by entry">
          {insights.points.map((point) => (
            <div
              key={point.dateKey}
              title={`${point.dateKey}: ${point.label}`}
              className="flex-1 rounded-t-md bg-accent/70"
              style={{ height: `${(point.score / 5) * 100}%` }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {insights.points.length} entries in this window · {formatFocusMinutes(weekly.focusMinutes)} of focus
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="text-sm font-medium">This week</h3>
        <p className="text-xs text-ink-3">AI-generated observations from your entries.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Row label="Overall mood" value={weekly.overallMood} />
          <Row
            label="Best day"
            value={weekly.bestDay ? `${weekly.bestDay.label} (${weekly.bestDay.dateKey})` : "Not recorded"}
          />
          <Row label="Most common activity" value={weekly.mostCommonActivity ?? "None recorded"} />
          <Row label="Top achievement" value={weekly.topAchievement ?? "None recorded"} />
          <Row label="Common challenge" value={weekly.commonChallenge ?? "None recorded"} />
          <Row
            label="Habit consistency"
            value={weekly.habitConsistency == null ? "Not measured" : `${weekly.habitConsistency}%`}
          />
        </dl>
        <ul className="mt-3 space-y-1.5">
          {weekly.reflections.map((reflection) => (
            <li key={reflection} className={cn("rounded-lg bg-surface-2 p-3 text-sm text-ink-2")}>
              {reflection}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="text-sm font-medium">This month</h3>
        <p className="text-xs text-ink-3">AI-generated observations from your entries.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Row
            label="Mood trend"
            value={monthly.moodTrend === "up" ? "Improving" : monthly.moodTrend === "down" ? "Declining" : "Steady"}
          />
          <Row
            label="Productivity trend"
            value={monthly.productivityTrend === "up" ? "Improving" : monthly.productivityTrend === "down" ? "Declining" : "Steady"}
          />
          <Row label="Entries" value={`${monthly.entryCount}`} />
          <Row label="Frequent topics" value={monthly.frequentTopics.join(", ") || "None recorded"} />
        </dl>
        {monthly.majorAchievements.length > 0 ? (
          <>
            <h4 className="mt-4 text-xs font-medium text-ink-3">Major achievements</h4>
            <ul className="mt-1 space-y-1 text-sm">
              {monthly.majorAchievements.slice(0, 5).map((achievement) => (
                <li key={achievement}>• {achievement}</li>
              ))}
            </ul>
          </>
        ) : null}
        {monthly.majorChallenges.length > 0 ? (
          <>
            <h4 className="mt-4 text-xs font-medium text-ink-3">Major challenges</h4>
            <ul className="mt-1 space-y-1 text-sm">
              {monthly.majorChallenges.slice(0, 5).map((challenge) => (
                <li key={challenge}>• {challenge}</li>
              ))}
            </ul>
          </>
        ) : null}
        {monthly.goalProgress.length > 0 ? (
          <>
            <h4 className="mt-4 text-xs font-medium text-ink-3">Goal progress</h4>
            <ul className="mt-1 space-y-1 text-sm">
              {monthly.goalProgress.map((goal) => (
                <li key={goal.goalId}>
                  • {goal.title} — {goal.linkedEntries} linked entr{goal.linkedEntries === 1 ? "y" : "ies"}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {monthly.patterns.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {monthly.patterns.map((pattern) => (
              <li key={pattern} className="rounded-lg bg-surface-2 p-3 text-sm text-ink-2">
                {pattern}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="text-xs text-ink-3">
        These are observed patterns in your own writing, not medical or psychological conclusions.
      </p>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-ink-3">{detail}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-sm capitalize">{value}</dd>
    </div>
  );
}
