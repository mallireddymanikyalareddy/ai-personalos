"use client";

import * as React from "react";

import { CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, Sparkles, Sun } from "lucide-react";

import { addDays, endOfDay, startOfDay } from "@personalos/core";
import type { TodayTaskBucket } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { AIAnswer } from "@/components/ai/ai-answer";
import { DropdownMenu } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { useAIGateway } from "@/lib/use-ai-gateway";
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
  const ai = useAIGateway();
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

  const runTodayAI = (id: "rescue" | "focus" | "week") => {
    const meta =
      id === "rescue"
        ? { action: "today_rescue_plan", prompt: "I'm behind. Replan the rest of today with the highest-impact work first.", label: "Rescue my day" }
        : id === "focus"
          ? { action: "today_focus_plan", prompt: "Pick the next 1–3 focus blocks for today and say what to protect.", label: "Pick focus blocks" }
          : { action: "today_weekly_preview", prompt: "Preview the week ahead: key deadlines, meetings and risks.", label: "Week preview" };
    if (!ai.gatewayEnabled) {
      ai.setAnswer(
        id === "rescue"
          ? `Local rescue: ${counts.today ?? 0} due today and ${counts.overdue ?? 0} overdue. Start with the highest-priority overdue item, then one focus block.`
          : id === "focus"
            ? `Local focus: protect 90 minutes for ${rows[0]?.title ?? "your top task"} and batch shallow work after lunch.`
            : `Local preview: ${goals.length} active goals, ${habits.length} habits and ${meetings.length} meetings in the next week.`,
      );
      return;
    }
    void ai.request({ action: meta.action, prompt: meta.prompt, context: os.aiContextSummary(), label: meta.label });
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
          <section
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            aria-label="AI day assistant"
            data-testid="today-ai-panel"
          >
            <header className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
                AI day assistant
              </h2>
            </header>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => runTodayAI("rescue")} data-testid="today-ai-rescue">
                Rescue my day
              </Button>
              <Button size="sm" variant="ghost" onClick={() => runTodayAI("focus")} data-testid="today-ai-focus">
                Pick focus blocks
              </Button>
              <Button size="sm" variant="ghost" onClick={() => runTodayAI("week")} data-testid="today-ai-week">
                Week preview
              </Button>
            </div>
            {ai.answer ? (
              <AIAnswer
                text={ai.answer}
                testId="today-ai-answer"
                className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-[12px]"
              />
            ) : null}
            <p className="mt-1.5 text-[10px] text-ink-3" data-testid="today-ai-credits">
              {ai.creditsNote}
            </p>
          </section>

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
      <CreditConfirmDialog
        open={ai.pending != null}
        label={ai.pending?.label ?? "AI action"}
        estimate={ai.pending?.estimate ?? null}
        busy={ai.busy}
        onClose={ai.dismiss}
        onConfirm={() => void ai.confirm()}
      />
    </div>
  );
}
