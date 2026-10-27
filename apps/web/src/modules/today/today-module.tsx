"use client";

import * as React from "react";

import { CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, Sun } from "lucide-react";

import { addDays, endOfDay, startOfDay } from "@personalos/core";
import type { TodayTaskBucket } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { useAppState, useOS } from "@/store/use-os";

import { TaskDetailSheet } from "@/modules/tasks/task-detail-sheet";

import { TodayMeetingsPanel, TodaySchedulePanel, TodayTasksPanel } from "./today-agenda";
import {
  TodayDeadlinesPanel,
  TodayFocusLogPanel,
  TodayMomentsPanel,
  TodayNotesPanel,
  TodayProjectsPanel,
  TodayRewardsPanel,
  TodayRoutinesPanel,
} from "./today-extra";
import { TodayHero } from "./today-hero";
import { TodayBriefing } from "./today-briefing";
import { FinishSetupBanner } from "./finish-setup-banner";
import { UpgradeCard } from "@/modules/plans/upgrade-card";
import {
  TodayActivityPanel,
  TodayGoalsPanel,
  TodayHabitsPanel,
  TodayJournalPanel,
} from "./today-progress";
import {
  TodayAiPanel,
  TodayFocusTimer,
  TodayInsightsPanel,
  TodayQuickCapture,
} from "./today-productivity";
import { seedSampleDay } from "./sample-today";
import { formatLongDate, useTodayNow } from "./use-today-now";

export function TodayModule() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();
  const now = useTodayNow(30_000);

  const [offset, setOffset] = React.useState(0);
  const [bucket, setBucket] = React.useState<TodayTaskBucket>("today");
  const [detailTaskId, setDetailTaskId] = React.useState<string | null>(null);

  const selectedDay = startOfDay(addDays(now, offset));
  const dataNow = offset === 0 ? now : selectedDay;
  const dayNow = offset === 0 ? now : endOfDay(selectedDay);

  const welcome = os.todayWelcome(offset === 0 ? now : selectedDay + 9 * 3_600_000);
  const stats = os.todayStats(dataNow);
  const schedule = os.todaySchedule(dataNow);
  const rows = os.todayTasks(bucket, dataNow);
  const counts = os.todayTaskCounts(dataNow);
  const habits = os.todayHabits(dataNow);
  const goals = os.todayGoals(dataNow);
  const journal = os.todayJournal(selectedDay);
  const activity = os.todayActivity(dayNow);
  const insights = os.todayInsights(dayNow);
  const meetings = os.todayMeetings(dataNow);
  const steps = os.todaySteps(dataNow);
  const projects = os.todayProjects(dataNow);
  const deadlines = os.todayDeadlines(dataNow);
  const notes = os.todayNotes(dataNow);
  const focusLog = os.todayFocusLog(dayNow);
  const moments = os.todayMoments(selectedDay);
  const reward = os.todayReward();

  const navigate = (href: string) => {
    if (typeof window !== "undefined") window.location.assign(href);
  };

  const loadDefaults = () => {
    const created = seedSampleDay(os, dataNow);
    toast(
      created > 0
        ? `Sample day loaded - ${created} item${created === 1 ? "" : "s"} added`
        : "Sample day is already loaded",
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Sun}
        title="Today"
        subtitle={
          <span data-testid="today-date-label" className="tabular-nums">
            {formatLongDate(selectedDay)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
              <button
                type="button"
                aria-label="Previous day"
                disabled={offset <= -365}
                onClick={() => setOffset((current) => current - 1)}
                className="grid size-7 place-items-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-36 text-center text-xs font-semibold tabular-nums text-ink">
                {offset === 0 ? "Today" : formatLongDate(selectedDay)}
              </span>
              <button
                type="button"
                aria-label="Next day"
                disabled={offset >= 31}
                onClick={() => setOffset((current) => (current < 31 ? current + 1 : current))}
                className="grid size-7 place-items-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            {offset !== 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
                Back to today
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => navigate("/planner")}>
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Plan day
            </Button>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Today",
                  items: [
                    { label: "Load default data", onSelect: loadDefaults },
                    { label: "Open Insights", onSelect: () => navigate("/insights") },
                  ],
                },
                {
                  label: "Go to",
                  items: [
                    { label: "Planner", onSelect: () => navigate("/planner") },
                    { label: "Calendar", onSelect: () => navigate("/calendar") },
                    { label: "Focus", onSelect: () => navigate("/focus") },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Today options">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              }
            />
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <FinishSetupBanner />
          <UpgradeCard />
          <TodayHero welcome={welcome} stats={stats} day={selectedDay} onAddMemory={() => navigate("/memory")} />
          <TodayBriefing />

          <div className="grid gap-4 lg:grid-cols-2">
            <TodaySchedulePanel entries={schedule} />
            <TodayTasksPanel
              rows={rows}
              bucket={bucket}
              counts={counts}
              day={selectedDay}
              completedToday={stats.tasksDone}
              totalToday={stats.tasksTotal}
              onBucket={setBucket}
              onOpenTask={setDetailTaskId}
            />
          </div>

          <TodayMeetingsPanel rows={meetings} />

          <div className="grid gap-4 lg:grid-cols-3">
            <TodayHabitsPanel rows={habits} />
            <TodayGoalsPanel rows={goals} />
            <TodayJournalPanel
              preview={journal}
              onWrite={() => {
                navigate("/journal");
              }}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <TodayRoutinesPanel rows={steps} />
            <TodayProjectsPanel rows={projects} />
            <TodayDeadlinesPanel rows={deadlines} />
            <TodayFocusLogPanel rows={focusLog} />
            <TodayNotesPanel rows={notes} />
            <TodayMomentsPanel rows={moments} />
            <TodayRewardsPanel row={reward} />
          </div>

          <TodayActivityPanel rows={activity} />
        </div>

        <aside className="space-y-4" aria-label="Productivity">
          <TodayAiPanel />
          <TodayFocusTimer />
          <TodayQuickCapture day={selectedDay} />
          <TodayInsightsPanel insights={insights} stats={stats} />
        </aside>
      </div>

      <TaskDetailSheet taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
    </div>
  );
}
