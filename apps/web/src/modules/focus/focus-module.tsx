"use client";

import * as React from "react";

import { CalendarRange, Flame, Timer, TrendingUp } from "lucide-react";

import { formatMinutes, formatFullDate } from "@personalos/core";
import type { FocusAmbient } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

import { FocusWorkspace } from "./focus-workspace";
import { useFocusNow } from "./use-focus-now";
import { FOCUS_DAY_RANGES } from "@personalos/core";
import { useAppState, useOS } from "@/store/use-os";
import { Button } from "@/components/ui/button";



const AMBIENT_LABEL: Record<FocusAmbient, string> = {
  none: "Silence",
  white: "White noise",
  brown: "Brown noise",
  rain: "Rain",
  waves: "Waves",
};

function ambientLabel(ambient: string): string {
  return AMBIENT_LABEL[(ambient as FocusAmbient) in AMBIENT_LABEL ? (ambient as FocusAmbient) : "none"];
}

export function FocusModule() {
  const os = useOS();
  const state = useAppState();
  const [presetId, setPresetId] = React.useState("pomodoro");
  const now = useFocusNow(30_000);

  React.useEffect(() => {
    const stale = Object.values(os.getState().focusSessions).filter(
      (session) =>
        (session.status === "running" || session.status === "paused") &&
        Date.now() - session.startedAt > 12 * 3_600_000,
    );
    for (const session of stale) os.abortFocusSession(session.id);
  }, [os]);

  const window_ = FOCUS_DAY_RANGES.week(now);

  const stats = os.focusStats(window_.from, window_.to);
  const deepWork = os.focusDeepWorkBlocks(window_.from, window_.to, 45);
  const bestHours = os.focusBestHours(window_.from, window_.to);

  const history = React.useMemo(
    () =>
      Object.values(state.focusSessions)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 20),
    [state.focusSessions],
  );

  const maxDayMinutes = Math.max(1, ...stats.byDay.map((day) => day.minutes));

  return (
    <>
      <PageHeader
        icon={Timer}
        title="Focus Mode"
        subtitle="Eliminate distractions, do meaningful work, and achieve your goals."
      />

      <FocusWorkspace presetId={presetId} onPresetIdChange={setPresetId} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Focused" value={formatMinutes(stats.totalFocusMin)} icon={<Timer className="size-4" />} />
        <Metric
          label="Focus ratio"
          value={`${Math.round(stats.focusRatio * 100)}%`}
          icon={<TrendingUp className="size-4" />}
        />
        <Metric label="Sessions" value={String(stats.sessionCount)} icon={<CalendarRange className="size-4" />} />
        <Metric label="Avg session" value={formatMinutes(stats.averageSessionMin)} icon={<Flame className="size-4" />} />
      </div>

      {stats.sessionCount > 0 && (
        <>
          <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Focus by day</h2>
            <div className="mt-3 flex items-end gap-1.5">
              {stats.byDay.map((day) => (
                <div key={day.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-24 w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-accent transition-all"
                      style={{ height: `${Math.max(3, (day.minutes / maxDayMinutes) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-ink-3">{day.label}</span>
                  <span className="text-[10px] tabular-nums text-ink-3">{day.minutes}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {stats.byTask.length > 0 && (
              <section className="rounded-2xl border border-line bg-surface p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Top tasks</h2>
                <ul className="mt-3 space-y-1.5">
                  {stats.byTask.slice(0, 6).map((entry) => (
                    <li key={entry.taskId ?? "none"} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink-2">{entry.title}</span>
                      <span className="shrink-0 tabular-nums text-ink-3">{formatMinutes(entry.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {stats.byGoal.length > 0 && (
              <section className="rounded-2xl border border-line bg-surface p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Goals served</h2>
                <ul className="mt-3 space-y-1.5">
                  {stats.byGoal.slice(0, 6).map((entry) => (
                    <li key={entry.goalId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink-2">{entry.title}</span>
                      <span className="shrink-0 tabular-nums text-ink-3">{formatMinutes(entry.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Deep work blocks</h2>
              {deepWork.length === 0 ? (
                <p className="mt-3 text-sm text-ink-3">No 45-minute block stayed uninterrupted yet.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {deepWork.slice(0, 5).map((block) => (
                    <li key={block.sessionId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink-2">
                        {block.taskTitle ?? "Unlinked"} · {formatFullDate(block.startedAt)}
                      </span>
                      <Badge tone="success">{formatMinutes(block.durationMin)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">When you focus best</h2>
              {bestHours.length === 0 ? (
                <p className="mt-3 text-sm text-ink-3">Not enough data yet.</p>
              ) : (
                <p className="mt-3 text-sm text-ink-2">
                  Your strongest {bestHours.length === 1 ? "hour" : "hours"}:{" "}
                  <span className="font-medium text-ink">
                    {bestHours.map((hour) => `${String(hour).padStart(2, "0")}:00`).join(", ")}
                  </span>
                </p>
              )}
              {stats.byAmbient.length > 1 && (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {stats.byAmbient.map((entry) => (
                    <li key={entry.ambient} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink-2">{ambientLabel(entry.ambient)}</span>
                      <span className="shrink-0 tabular-nums text-ink-3">
                        {formatMinutes(entry.minutes)} · {Math.round(entry.focusRatio * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {stats.estimateAccuracy.length > 0 && (
            <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Estimate vs actual</h2>
              <ul className="mt-3 space-y-1.5">
                {stats.estimateAccuracy.map((entry) => (
                  <li key={entry.taskId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{entry.title}</span>
                    <span className="shrink-0 text-ink-3">
                      {entry.estimateMin} min planned → {entry.actualMin} actual
                    </span>
                    <Badge tone={entry.deltaMin > 10 ? "warning" : "success"}>
                      {entry.deltaMin > 0 ? "+" : ""}
                      {entry.deltaMin}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Session history</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No sessions yet"
            description="Start a focus session above — from a task or on its own — and it will be recorded here."
          />
        ) : (
          <ul className="space-y-2">
            {history.map((session) => {
              const task = session.taskId ? os.getTask(session.taskId) : null;
              const minutes = Math.round(
                Math.max(0, (session.endsAt ?? Date.now()) - session.startedAt - (session.pausedMs ?? 0)) / 60000,
              );
              return (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{task?.title ?? "Unlinked focus"}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {formatFullDate(session.startedAt)} · {session.mode} ·{" "}
                      {ambientLabel(session.ambient ?? "none")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {session.rating != null && session.rating > 0 ? (
                      <span className="text-xs text-warning" aria-label={`Rated ${session.rating} out of 5`}>
                        {"★".repeat(session.rating)}
                      </span>
                    ) : null}
                    {session.distractionCount > 0 && (
                      <span className="text-xs text-ink-3">{session.distractionCount} distracted</span>
                    )}
                    <span className="tabular-nums text-sm text-ink-2">{formatMinutes(minutes)}</span>
                    <Badge
                      tone={
                        session.status === "completed" ? "success" : session.status === "aborted" ? "neutral" : "accent"
                      }
                    >
                      {session.status}
                    </Badge>
                    {session.status === "running" || session.status === "paused" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          os.abortFocusSession(session.id);
                        }}
                      >
                        End session
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        Architecture is ready for distraction tracking (every distraction and its duration is recorded per session),
        ambient sound (generated locally in the browser, never uploaded), and deep work analytics (uninterrupted
        45-minute blocks, hour-of-day patterns, and estimate accuracy from real focus time).
      </p>
    </>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}
