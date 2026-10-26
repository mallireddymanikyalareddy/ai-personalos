"use client";

import * as React from "react";

import {
  Building2,
  Coffee,
  Flame,
  Headphones,
  Leaf,
  Library,
  ShieldOff,
  Sparkles,
} from "lucide-react";

import {
  FOCUS_DAY_RANGES,
  FOCUS_ENVIRONMENTS,
  FOCUS_PRESETS,
  focusBreakdownToday,
  focusEnvironment,
  focusPlanForDay,
  focusStreak,
  focusStreakWeek,
  focusTasksForDay,
  formatMinutes,
  type FocusEnvironmentId,
  type FocusPlanSlot,
  type FocusSession,
  type FocusSlice,
  type FocusStreak,
  type FocusStreakDay,
  type FocusTaskRow,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";

import { FocusTimer } from "./focus-timer";
import { useFocusNow } from "./use-focus-now";
import { useAppState, useOS } from "@/store/use-os";

const ENVIRONMENT_ICON = {
  nature: Leaf,
  library: Library,
  office: Building2,
  cafe: Coffee,
} as const;

const HERO_PRESETS = ["pomodoro", "deep_work", "quick_focus", "custom"];

const SLICE_COLOR: Record<FocusSlice["kind"], string> = {
  deep: "var(--success)",
  task: "var(--info)",
  study: "var(--warning)",
  planning: "var(--chart-5)",
  other: "var(--ink-3)",
};

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export interface FocusWorkspaceProps {
  presetId: string;
  onPresetIdChange: (id: string) => void;
  onFinished?: (session: FocusSession) => void;
}

export function FocusWorkspace({
  presetId,
  onPresetIdChange,
  onFinished,
}: FocusWorkspaceProps) {
  const os = useOS();
  const state = useAppState();
  const now = useFocusNow();

  const [environmentId, setEnvironmentId] = React.useState<FocusEnvironmentId>("nature");
  const [range, setRange] = React.useState<"7" | "30">("7");
  const environment = focusEnvironment(environmentId);

  const plan = React.useMemo(() => focusPlanForDay(state, now), [state, now]);
  const tasks = React.useMemo(() => focusTasksForDay(state, now), [state, now]);
  const streak = React.useMemo(() => focusStreak(state, now), [state, now]);
  const week = React.useMemo(() => focusStreakWeek(state, now), [state, now]);
  const breakdown = React.useMemo(() => focusBreakdownToday(state, now), [state, now]);

  const window_ = range === "7" ? FOCUS_DAY_RANGES.week(now) : FOCUS_DAY_RANGES.month(now);
  const stats = React.useMemo(
    () => os.focusStats(window_.from, window_.to, now),
    [os, window_.from, window_.to, now],
  );
  const maxDay = Math.max(1, ...stats.byDay.map((day) => day.minutes));
  const totalToday = breakdown.reduce((total, slice) => total + slice.minutes, 0);
  const currentTask = tasks.find((task) => !task.done) ?? null;

  const presets = FOCUS_PRESETS.filter((preset) => HERO_PRESETS.includes(preset.id));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-3">
        <div
          className="overflow-hidden rounded-2xl border border-line"
          style={{ backgroundImage: environment.gradient }}
          data-testid="focus-hero"
        >
          <div className="flex items-start justify-between gap-2 p-3">
            <Badge tone="outline" className="border-white/40 bg-white/10 text-white">
              {environment.label}
            </Badge>
          </div>
          <div className="px-3 pb-3">
            <FocusTimer
              presetId={presetId}
              onPresetIdChange={onPresetIdChange}
              ambient={environment.ambient}
              hidePresetPicker
              onFinished={onFinished}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          </div>
        </div>

        <section aria-label="Focus presets" data-testid="focus-presets">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={presetId === preset.id}
                onClick={() => onPresetIdChange(preset.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  presetId === preset.id
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="block text-sm font-semibold text-ink">{preset.label}</span>
                <span className="mt-0.5 block text-xs text-ink-3">
                  {preset.config.workMin} min focus · {preset.config.breakMin} min break
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <FocusPlanCard plan={plan} now={now} />
          <div className="space-y-3">
            <DistractionCard />
            <FocusStatsCard
              byDay={stats.byDay}
              max={maxDay}
              range={range}
              onRange={setRange}
              totalMin={stats.totalFocusMin}
            />
          </div>
        </div>
      </div>

      <aside className="space-y-3" aria-label="Focus details">
        <TodayFocusCard totalMin={totalToday} breakdown={breakdown} />
        <StreakCard streak={streak} week={week} />
        <CurrentTaskCard task={currentTask} />
        <TaskListCard tasks={tasks} />
        <EnvironmentCard
          selected={environmentId}
          onSelect={(id) => setEnvironmentId(id)}
        />
      </aside>
    </div>
  );
}

function FocusPlanCard({ plan, now }: { plan: FocusPlanSlot[]; now: number }) {
  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Today's focus plan"
      data-testid="focus-plan"
    >
      <h2 className="mb-2 text-sm font-semibold text-ink">Today&rsquo;s focus plan</h2>
      {plan.length === 0 ? (
        <p className="text-xs text-ink-3">
          Nothing scheduled yet. Add time blocks from the Planner and they will line up here.
        </p>
      ) : (
        <ol className="space-y-1">
          {plan.map((slot) => (
            <li key={slot.id} className="flex items-start gap-2 text-sm">
              <span className="w-24 shrink-0 text-[11px] tabular-nums text-ink-3">
                {clock(slot.start)} &ndash; {clock(slot.end)}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  slot.done ? "bg-success" : slot.start <= now ? "bg-accent" : "bg-ink-3",
                )}
              />
              <span className={cn("min-w-0 flex-1", slot.done && "text-ink-3 line-through")}>
                {slot.title}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{slot.minutes}m</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DistractionCard() {
  const os = useOS();
  const state = useAppState();
  const session = os.activeFocusSession();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const todaySessions = Object.values(state.focusSessions).filter(
    (entry) => entry.startedAt >= startOfToday,
  );
  const todayCount = todaySessions.length;
  const todayDistractions = todaySessions.reduce(
    (total, entry) => total + (entry.distractions?.length ?? 0),
    0,
  );

  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Distraction blocker"
      data-testid="focus-distraction"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <ShieldOff className="size-3.5 text-ink-3" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Distraction blocker</h2>
        {session ? <Badge tone="accent">Session on</Badge> : null}
      </div>
      <ul className="space-y-1 text-xs text-ink-2">
        <li className="flex items-start gap-1.5">
          <Headphones className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden="true" />
          Log a distraction in one tap &mdash; reason and duration are recorded on the session.
        </li>
        <li className="flex items-start gap-1.5">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          Focus Mode quiets ambient noise and keeps the timer in view while a session runs.
        </li>
      </ul>
      <p className="mt-2 rounded-lg bg-surface-2 p-2 text-[11px] text-ink-3">
        Blocking other sites (social media, news) needs a browser extension or an OS-level tool
        &mdash; a web page cannot do it on its own.
      </p>
      <p className="mt-1 text-[11px] text-ink-3">
        {`${todayCount} session${todayCount === 1 ? "" : "s"} started today${
          todayDistractions > 0
            ? ` · ${todayDistractions} distraction${todayDistractions === 1 ? "" : "s"} logged`
            : "."
        }`}
      </p>
    </section>
  );
}

function FocusStatsCard({
  byDay,
  max,
  range,
  onRange,
  totalMin,
}: {
  byDay: Array<{ day: number; label: string; minutes: number }>;
  max: number;
  range: "7" | "30";
  onRange: (value: "7" | "30") => void;
  totalMin: number;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3" aria-label="Focus stats">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Focus stats</h2>
        <div className="w-28">
          <Segmented
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
            ]}
            value={range}
            onChange={onRange}
            label="Stats range"
          />
        </div>
      </div>

      {totalMin === 0 ? (
        <p className="text-xs text-ink-3">No focus time recorded in this window yet.</p>
      ) : (
        <>
          <div className="flex h-20 items-end gap-1">
            {byDay.map((day) => (
              <div
                key={day.day}
                title={`${day.label}: ${formatMinutes(day.minutes)}`}
                className="flex-1 rounded-t-sm bg-accent/70"
                style={{ height: `${Math.max(4, (day.minutes / max) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-3">{formatMinutes(totalMin)} total</p>
        </>
      )}
    </section>
  );
}

function TodayFocusCard({
  totalMin,
  breakdown,
}: {
  totalMin: number;
  breakdown: FocusSlice[];
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3" data-testid="today-focus">
      <h2 className="mb-2 text-sm font-semibold text-ink">Today&rsquo;s focus</h2>

      {totalMin === 0 ? (
        <p className="text-xs text-ink-3">No focus time logged today yet.</p>
      ) : (
        <div className="flex items-center gap-3">
          <div
            className="relative grid size-20 shrink-0 place-items-center"
            role="img"
            aria-label={`${formatMinutes(totalMin)} of focus today`}
          >
            <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-surface-3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3.5"
                className="stroke-success"
              />
            </svg>
            <span className="absolute text-center text-[10px] font-semibold tabular-nums text-ink">
              {formatMinutes(totalMin)}
            </span>
          </div>
          <ul className="min-w-0 flex-1 space-y-1">
            {breakdown.map((slice) => (
              <li key={slice.kind} className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: SLICE_COLOR[slice.kind] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-2">{slice.label}</span>
                <span className="tabular-nums text-ink-3">{formatMinutes(slice.minutes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StreakCard({
  streak,
  week,
}: {
  streak: FocusStreak;
  week: FocusStreakDay[];
}) {
  const maxWeek = Math.max(1, ...week.map((day) => day.minutes));
  return (
    <section className="rounded-xl border border-line bg-surface p-3" data-testid="focus-streak">
      <div className="mb-2 flex items-center gap-1.5">
        <Flame className="size-4 text-warning" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Focus streak</h2>
        <span className="ml-auto text-[11px] text-ink-3">Longest {streak.longest}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-ink">
        {streak.current}
        <span className="ml-1 text-sm font-normal text-ink-3">
          {streak.current === 1 ? "day" : "days"}
        </span>
      </p>
      <p className="mb-2 text-[11px] text-ink-3">
        {streak.current === 0
          ? "Start a session today to begin"
          : streak.activeToday
            ? "Today is logged"
            : "You have not focused today yet"}
      </p>
      <div className="flex items-end gap-1">
        {week.map((day, index) => (
          <span
            key={`${day.label}-${index}`}
            title={`${day.label}: ${formatMinutes(day.minutes)}`}
            className={cn("w-4 rounded-sm", day.active ? "bg-accent" : "bg-surface-3")}
            style={{ height: `${Math.max(6, (day.minutes / maxWeek) * 28)}px` }}
          />
        ))}
      </div>
    </section>
  );
}

function CurrentTaskCard({ task }: { task: FocusTaskRow | null }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3" data-testid="current-focus-task">
      <h2 className="mb-2 text-sm font-semibold text-ink">Current focus task</h2>
      {task === null ? (
        <p className="text-xs text-ink-3">
          Nothing scheduled today &mdash; add a task or time a block to give a session a target.
        </p>
      ) : (
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{task.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {task.projectName ? <Badge tone="neutral">{task.projectName}</Badge> : null}
              {task.priority >= 3 ? <Badge tone="danger">High priority</Badge> : null}
              {task.plannedMin > 0 ? (
                <span className="text-[11px] text-ink-3">{formatMinutes(task.plannedMin)} planned</span>
              ) : null}
            </span>
          </span>
        </div>
      )}
    </section>
  );
}

function TaskListCard({ tasks }: { tasks: FocusTaskRow[] }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3" aria-label="Today's focus tasks">
      <h2 className="mb-2 text-sm font-semibold text-ink">Today&rsquo;s focus tasks</h2>
      {tasks.length === 0 ? (
        <p className="text-xs text-ink-3">No tasks scheduled or focused today.</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={task.done}
                readOnly
                aria-label={`Completed: ${task.title}`}
                className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]"
              />
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  task.done ? "text-ink-3 line-through" : "text-ink-2",
                )}
              >
                {task.title}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
                {formatMinutes(task.focusedMin || task.plannedMin)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EnvironmentCard({
  selected,
  onSelect,
}: {
  selected: FocusEnvironmentId;
  onSelect: (id: FocusEnvironmentId) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3" data-testid="focus-environment">
      <h2 className="mb-2 text-sm font-semibold text-ink">Focus environment</h2>
      <div className="grid grid-cols-2 gap-2">
        {FOCUS_ENVIRONMENTS.map((entry) => {
          const Icon = ENVIRONMENT_ICON[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={selected === entry.id}
              onClick={() => onSelect(entry.id)}
              className={cn(
                "overflow-hidden rounded-lg border text-left transition-colors",
                selected === entry.id ? "border-accent ring-1 ring-accent/40" : "border-line",
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-10 items-center justify-center"
                style={{ backgroundImage: entry.gradient }}
              >
                <Icon className="size-4 text-white" />
              </span>
              <span className="block bg-surface px-2 py-1 text-[11px] font-medium text-ink">
                {entry.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        {focusEnvironment(selected).blurb}. Ambient sound plays during a session.
      </p>
    </section>
  );
}