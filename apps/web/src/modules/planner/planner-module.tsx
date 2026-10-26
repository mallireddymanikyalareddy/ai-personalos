"use client";

import * as React from "react";

import { CalendarDays, ChevronLeft, ChevronRight, Plus, Settings2, Sparkles } from "lucide-react";

import {
  addDays,
  aiProvider,
  startOfDay,
  type CalendarEvent,
  type PlanProposal,
  type Timestamp,
} from "@personalos/core";

import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useFocusNow } from "@/modules/focus/use-focus-now";
import { useAppState, useOS } from "@/store/use-os";

import { EventDetailSheet, type EventSheet } from "@/modules/calendar/event-detail-sheet";
import { TaskDetailSheet } from "@/modules/tasks/task-detail-sheet";
import { BlockMenuDialog } from "./block-menu-dialog";
import { DayGrid } from "./day-grid";
import { MonthGrid } from "./planner-month";
import { PlanPanel, type PlanFilter, type PlanSort, type PlanTab } from "./planner-plan-panel";
import { FocusTimeCard, PlannerAssistant, TodaysPriorities } from "./planner-rail";
import { GoalProgressList, HabitTracker, WeeklyPlan } from "./planner-bottom";
import { PlanTemplatesDialog } from "./plan-templates-dialog";
import { PrefsDialog } from "./prefs-dialog";
import { ProposalDialog } from "./proposal-dialog";
import { ScheduleTaskDialog } from "./schedule-task-dialog";
import { TimelineView } from "./timeline-view";
import { WeekGrid } from "./week-grid";
import { DAY_MS, formatMinutes, placeDroppedTask, resizeTimeBlock, taskDragPayload } from "./planner-utils";

type View = "day" | "week" | "month" | "timeline";

const VIEWS: { value: View; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "timeline", label: "Timeline" },
];

function viewFromPreference(value: string): View {
  if (value === "week") return "week";
  if (value === "month" || value === "quarter") return "month";
  return "day";
}

const weekShort = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const dayTitle = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const planDayShort = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

export function PlannerModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const preferredView = viewFromPreference(state.settings.defaultPlanningView);
  const [view, setView] = React.useState<View>(() => preferredView);
  const manualView = React.useRef(false);
  const selectView = (next: View) => {
    manualView.current = true;
    setView(next);
  };
  React.useEffect(() => {
    if (!manualView.current) setView(preferredView);
  }, [preferredView]);
  const [anchor, setAnchor] = React.useState(() => startOfDay(Date.now()));
  const [tab, setTab] = React.useState<PlanTab>("tasks");
  const [filter, setFilter] = React.useState<PlanFilter>("all");
  const [sort, setSort] = React.useState<PlanSort>("time");
  const [period, setPeriod] = React.useState("This Week");
  const [proposal, setProposal] = React.useState<PlanProposal | null>(null);
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [blockId, setBlockId] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<EventSheet | null>(null);
  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [scheduleTaskId, setScheduleTaskId] = React.useState<string | null>(null);
  const [assistantExpanded, setAssistantExpanded] = React.useState(false);

  const now = useFocusNow(30_000);
  const prefs = state.settings.planning;
  const providerLabel = aiProvider(state.settings.aiProvider).label;
  const hour12 = state.settings.timeFormat === 12;

  const week = os.getWeekView(anchor, now);
  const month = os.getMonthView(anchor, now);
  const day = week.days.find((entry) => entry.date === startOfDay(anchor)) ?? week.days[0]!;

  const candidates = os.getPlanningCandidates(startOfDay(now), startOfDay(now) + 7 * DAY_MS, now);
  const freeSlots = os.findPlanningWindows(week.start, week.end, 30);
  const conflicts = os.getPlanConflicts(week.start, week.end);

  const weekLabel = `${weekShort.format(new Date(week.start))} – ${weekShort.format(new Date(week.end - 1))}`;

  const tasks = React.useMemo(() => {
    const all = Object.values(state.tasks).filter(
      (task) => task.status !== "archived" && task.status !== "cancelled",
    );
    const anchorStart = startOfDay(anchor);
    const dayEnd = anchorStart + DAY_MS;
    const forDay = all.filter(
      (task) =>
        (task.dueAt != null && task.dueAt >= anchorStart && task.dueAt < dayEnd) ||
        (task.scheduledAt != null && task.scheduledAt >= anchorStart && task.scheduledAt < dayEnd) ||
        (task.dueAt == null && task.status !== "done"),
    );
    return forDay
      .map((task) => {
        const project = task.projectId ? state.projects[task.projectId] : null;
        return {
          id: task.id,
          title: task.title,
          done: task.status === "done",
          tags: task.tags,
          dueAt: task.dueAt,
          scheduledAt: task.scheduledAt,
          priority: task.priority,
          projectName: project?.name ?? null,
          projectColor: project?.color ?? null,
        };
      })
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  }, [state.tasks, state.projects, anchor]);

  const goals = React.useMemo(
    () => os.goalsDashboard({}, now).goals.slice(0, 6).map((goal) => ({ id: goal.id, title: goal.title, progress: goal.progress })),
    [os, now],
  );

  const habitRows = React.useMemo(() => os.todayHabits(now), [os, now]);

  const notes = React.useMemo(
    () =>
      Object.values(state.notes)
        .filter((note) => note.status === "active")
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 6)
        .map((note) => ({ id: note.id, title: note.title, updatedAt: note.updatedAt })),
    [state.notes],
  );

  const focusSlices = React.useMemo(() => {
    const anchorMonth = new Date(anchor).getMonth();
    const days =
      period === "Today"
        ? week.days.filter((entry) => entry.isToday)
        : period === "This Month"
          ? os
              .getMonthView(anchor, now)
              .weeks.flatMap((entry) => entry.days)
              .filter((entry) => new Date(entry.date).getMonth() === anchorMonth)
          : week.days;
    let focus = 0;
    let meetings = 0;
    let personal = 0;
    for (const entry of days) {
      for (const block of entry.timeBlocks) {
        const minutes = Math.round((block.endsAt - block.startsAt) / 60_000);
        if (block.kind === "focus" || block.kind === "routine") focus += minutes;
        else if (block.kind === "meeting") meetings += minutes;
        else if (block.kind === "personal") personal += minutes;
      }
      for (const event of entry.events) {
        meetings += Math.round((event.endsAt - event.startsAt) / 60_000);
      }
    }
    return [
      { key: "deep", label: "Deep Work", minutes: focus, color: "var(--chart-5)" },
      { key: "meetings", label: "Meetings", minutes: meetings, color: "var(--chart-7)" },
      { key: "personal", label: "Personal", minutes: personal, color: "var(--chart-6)" },
    ];
  }, [period, week, anchor, now, os]);

  const focusTotal = focusSlices.reduce((sum, slice) => sum + slice.minutes, 0);

  const priorities = React.useMemo(
    () =>
      candidates.slice(0, 3).map((candidate) => ({
        id: candidate.task.id,
        title: candidate.task.title,
        description: candidate.reason,
        priority: candidate.priority,
        priorityLabel: candidate.priority >= 3 ? "High" : candidate.priority === 2 ? "Medium" : "Low",
      })),
    [candidates],
  );

  const weekDays = week.days.map((entry) => ({
    date: entry.date,
    label: weekdayShort.format(new Date(entry.date)),
    dayNumber: new Date(entry.date).getDate(),
    count: entry.events.length + entry.timeBlocks.length,
    isToday: entry.isToday,
  }));

  const habitTiles = habitRows.slice(0, 5).map((row) => ({
    id: row.id,
    title: row.title,
    done: row.done ? 1 : 0,
    target: 1,
    checked: row.done,
  }));

  const shiftMonth = (time: Timestamp, months: number): Timestamp => {
    const date = new Date(time);
    const dayOfMonth = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(dayOfMonth, lastDay));
    return startOfDay(date.getTime());
  };

  const jump = (direction: number) => {
    if (view === "month") {
      setAnchor((current) => shiftMonth(current, direction));
      return;
    }
    setAnchor((current) => addDays(current, (view === "week" ? 7 : 1) * direction));
  };

  const goToday = () => setAnchor(startOfDay(now));

  const planDay = () => {
    if (startOfDay(anchor) + DAY_MS <= now) {
      toast("That day has already passed", { tone: "danger" });
      return;
    }
    setProposal(os.generatePlan(startOfDay(anchor), startOfDay(anchor) + DAY_MS, now));
  };

  const planWeek = () => {
    if (week.end <= now) {
      toast("That week has already passed", { tone: "danger" });
      return;
    }
    setProposal(os.generatePlan(week.start, week.end, now));
  };

  const optimize = () => {
    if (week.end <= now) {
      toast("That week has already passed", { tone: "danger" });
      return;
    }
    const proposal = os.recalculatePlan(week.start, week.end, now);
    if (proposal.slots.length === 0) {
      toast(
        conflicts.length > 0
          ? "No AI-planned blocks can be moved automatically"
          : "Your schedule is already clear",
        { tone: conflicts.length > 0 ? "danger" : "success" },
      );
      return;
    }
    setProposal(proposal);
  };

  const timeBlockCandidates = () => {
    const pool = candidates.slice(0, 3);
    if (pool.length === 0) {
      toast("No tasks are ready to schedule in this window", { tone: "danger" });
      return;
    }
    const horizon = startOfDay(now) + 7 * DAY_MS;
    let scheduled = 0;
    for (const candidate of pool) {
      const slot = os
        .findPlanningWindows(now, horizon, 15)
        .find((entry) => entry.startsAt > now && entry.durationMin >= candidate.estimateMin);
      if (!slot) continue;
      const result = placeDroppedTask(os, taskDragPayload(candidate), slot.startsAt);
      if (result.ok) scheduled += 1;
    }
    if (scheduled === 0) {
      toast("No free time left for those tasks", { tone: "danger" });
      return;
    }
    toast(`Scheduled ${scheduled} ${scheduled === 1 ? "task" : "tasks"} into focus blocks`, {
      tone: "success",
    });
  };

  const findFocusTime = () => {
    const slot = freeSlots.find((entry) => entry.startsAt > now);
    if (!slot) {
      toast("No free time left this week", { tone: "danger" });
      return;
    }
    os.addTimeBlock({
      title: "Focus time",
      startsAt: slot.startsAt,
      endsAt: slot.startsAt + Math.min(90, slot.durationMin) * 60_000,
      kind: "focus",
      source: "manual",
    });
    toast(`Focus block added at ${new Date(slot.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  };

  const resizeBlock = (blockId: string, startsAt: Timestamp, endsAt: Timestamp) => {
    const result = resizeTimeBlock(os, blockId, startsAt, endsAt);
    toast(result.message, { tone: result.ok ? "success" : "danger" });
  };

  const requestPlace = (startsAt: Timestamp) => {
    const first = candidates[0];
    if (!first) {
      toast("No tasks are ready to be scheduled in this window", { tone: "danger" });
      return;
    }
    const result = placeDroppedTask(os, taskDragPayload(first), startsAt);
    toast(result.message, { tone: result.ok ? "success" : "danger" });
  };

  const toggleTask = (id: string) => {
    const task = os.getTask(id);
    if (!task) return;
    if (task.status === "done") os.reopenTask(id);
    else os.completeTask(id);
  };

  const toggleHabit = (id: string) => {
    if (os.habitCheckedOn(id, startOfDay(now))) os.undoHabit(id);
    else os.completeHabit(id);
  };

  const addTask = (title: string) => {
    const today = startOfDay(now);
    const targetDay = startOfDay(anchor) < today ? today : startOfDay(anchor);
    const endOfWorkday = targetDay + 17 * 3_600_000;
    os.addTask({ title, dueAt: endOfWorkday > now ? endOfWorkday : now + 3_600_000 });
    toast("Task added to the plan");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        testId="planner-header"
        icon={CalendarDays}
        title="Planner"
        subtitle="Plan your day, week or month. Turn your goals into actionable plans with AI."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-line p-0.5" role="group" aria-label="Planner view">
              {VIEWS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`planner-view-${option.value}`}
                  onClick={() => selectView(option.value)}
                  aria-pressed={view === option.value}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                    view === option.value ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Planner",
                  items: [
                    { label: "Preferences", onSelect: () => setPrefsOpen(true) },
                    { label: "Plan templates…", onSelect: () => setTemplatesOpen(true) },
                    { label: "Plan today", onSelect: planDay },
                    { label: "Plan this week", onSelect: planWeek },
                    { label: "Fix conflicts", onSelect: optimize },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Planner options">
                  <span aria-hidden="true">&#8942;</span>
                </Button>
              }
            />
            <Button variant="primary" onClick={planDay} data-testid="planner-create-plan">
              <Sparkles className="size-4" aria-hidden="true" />
              Create Plan
            </Button>
          </>
        }
      />

      {conflicts.length > 0 ? (
        <Alert
          tone="warning"
          title={`${conflicts.length} scheduling ${conflicts.length === 1 ? "conflict" : "conflicts"} this week`}
          action={
            <Button variant="secondary" size="sm" onClick={optimize}>
              <Sparkles className="size-3.5" aria-hidden="true" />
              Let AI fix it
            </Button>
          }
        >
          {conflicts.slice(0, 2).map((conflict) => `${conflict.title}: ${conflict.reason}`).join(" · ")}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-2" aria-label="Timeline for the selected day">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink" data-testid="planner-day-title">
              {dayTitle.format(new Date(day.date))}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => jump(-1)}
                aria-label="Previous period"
                className="grid size-7 place-items-center rounded-lg border border-line text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-2 hover:bg-surface-2"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => jump(1)}
                aria-label="Next period"
                className="grid size-7 place-items-center rounded-lg border border-line text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  os.addTimeBlock({
                    title: "New block",
                    startsAt: day.date + 9 * 3_600_000,
                    endsAt: day.date + 10 * 3_600_000,
                    kind: "focus",
                    source: "manual",
                  });
                  toast("Time block added");
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[12px] font-medium text-ink-2 hover:bg-surface-2"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add
              </button>
            </div>
          </div>

          {view === "day" ? (
            <DayGrid
              day={day}
              prefs={prefs}
              now={now}
              hour12={hour12}
              onOpenEvent={(event: CalendarEvent) => setSheet({ eventId: event.id })}
              onOpenBlock={setBlockId}
              onRequestPlace={requestPlace}
              onResizeBlock={resizeBlock}
            />
          ) : null}

          {view === "week" ? (
            <WeekGrid
              week={week}
              prefs={prefs}
              now={now}
              hour12={hour12}
              onOpenEvent={(event: CalendarEvent) => setSheet({ eventId: event.id })}
              onOpenBlock={setBlockId}
              onRequestPlace={requestPlace}
              onResizeBlock={resizeBlock}
              onSelectDay={(date) => {
                setAnchor(startOfDay(date));
                selectView("day");
              }}
            />
          ) : null}

          {view === "month" ? (
            <MonthGrid
              month={month}
              anchor={anchor}
              onSelectDay={(date) => {
                setAnchor(startOfDay(date));
                selectView("day");
              }}
            />
          ) : null}

          {view === "timeline" ? (
            <TimelineView
              day={day}
              prefs={prefs}
              now={now}
              hour12={hour12}
              onOpenEvent={(event: CalendarEvent) => setSheet({ eventId: event.id })}
              onOpenBlock={setBlockId}
            />
          ) : null}
        </section>

        <div className="min-w-0 xl:min-h-[620px]">
          <PlanPanel
            dayLabel={startOfDay(anchor) === startOfDay(now) ? "Today" : planDayShort.format(new Date(anchor))}
            tasks={tasks}
            goals={goals}
            habits={habitRows.map((row) => ({
              id: row.id,
              title: row.title,
              done: row.done,
              dueToday: true,
              streak: row.streak,
            }))}
            notes={notes}
            tab={tab}
            filter={filter}
            sort={sort}
            onTabChange={setTab}
            onFilterChange={setFilter}
            onSortChange={setSort}
            onToggleTask={toggleTask}
            onToggleHabit={toggleHabit}
            onAddTask={addTask}
            onGenerate={planDay}
            onOpenTask={setTaskId}
            onScheduleTask={setScheduleTaskId}
          />
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Planning tools">
          <PlannerAssistant
            providerLabel={providerLabel}
            expanded={assistantExpanded}
            onToggleExpanded={() => setAssistantExpanded((value) => !value)}
            onPlanDay={planDay}
            onTimeBlock={timeBlockCandidates}
            onOptimize={optimize}
            onFindFocus={findFocusTime}
            onGenerate={planWeek}
          />
          <FocusTimeCard
            slices={focusSlices}
            totalMinutes={focusTotal}
            period={period}
            onPeriodChange={setPeriod}
          />
          <TodaysPriorities rows={priorities} />
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WeeklyPlan
          days={weekDays}
          weekLabel={weekLabel}
          selected={startOfDay(anchor)}
          onSelect={(date) => {
            setAnchor(startOfDay(date));
            selectView("day");
          }}
          onShift={(direction) => setAnchor((current) => addDays(startOfDay(current), 7 * direction))}
          onViewFullWeek={() => selectView("week")}
        />
        <GoalProgressList rows={goals.slice(0, 3)} />
        <HabitTracker tiles={habitTiles} onToggle={toggleHabit} />
      </div>

      <ProposalDialog
        proposal={proposal}
        onClose={() => setProposal(null)}
        rangeLabel={view === "week" ? weekLabel : dayTitle.format(new Date(day.date))}
        onScheduleTask={(id) => {
          setProposal(null);
          setScheduleTaskId(id);
        }}
      />
      <PrefsDialog open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <PlanTemplatesDialog
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        anchor={anchor}
        weekStart={week.start}
        weekEnd={week.end}
      />
      <BlockMenuDialog blockId={blockId} onClose={() => setBlockId(null)} />
      <EventDetailSheet sheet={sheet} onClose={() => setSheet(null)} />
      <TaskDetailSheet taskId={taskId} onClose={() => setTaskId(null)} />
      <ScheduleTaskDialog taskId={scheduleTaskId} onClose={() => setScheduleTaskId(null)} />

      <p className="text-center text-[11px] text-ink-3">
        {formatMinutes(focusTotal)} planned · {freeSlots.length} free windows ·{" "}
        {prefs.enabled ? "AI planning is on" : "AI planning is off"}
        <button
          type="button"
          onClick={() => setPrefsOpen(true)}
          className="ml-2 inline-flex items-center gap-1 text-accent-ink hover:underline"
        >
          <Settings2 className="size-3" aria-hidden="true" />
          Preferences
        </button>
      </p>
    </div>
  );
}