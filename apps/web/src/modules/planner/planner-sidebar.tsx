"use client";

import * as React from "react";

import { CalendarClock, CalendarPlus, CalendarRange, Clock, GripVertical, Sparkles } from "lucide-react";

import { formatTime, startOfDay, type FreeSlot, type PlanCandidate } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

import { useAppState, useOS } from "@/store/use-os";

import {
  DRAG_TASK,
  formatMinutes,
  parseHHMM,
  planDot,
  placeDroppedTask,
  taskDragPayload,
  taskKindFor,
} from "./planner-utils";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function slotLabel(slot: FreeSlot): string {
  const iso = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${iso.format(new Date(slot.startsAt))} · ${timeFormatter.format(new Date(slot.startsAt))} – ${timeFormatter.format(new Date(slot.endsAt))}`;
}

export interface PlannerSidebarProps {
  candidates: PlanCandidate[];
  freeSlots: FreeSlot[];
  freeLabel: string;
  windowLabel: string;
  onPlanDay: () => void;
  onPlanWeek: () => void;
}

export function PlannerSidebar({
  candidates,
  freeSlots,
  freeLabel,
  windowLabel,
  onPlanDay,
  onPlanWeek,
}: PlannerSidebarProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const hour12 = state.settings.timeFormat === 12;

  const autoPlace = (candidate: PlanCandidate) => {
    const prefs = os.getPlanningPreferences();
    const startMin = parseHHMM(prefs.dayStart) ?? 9 * 60;
    const rawEnd = parseHHMM(prefs.dayEnd) ?? 17 * 60;
    const endMin = rawEnd > startMin ? rawEnd : startMin + 9 * 60;
    const slots = os.suggestTimeSlots(
      startOfDay(Date.now()),
      candidate.estimateMin,
      Math.floor(startMin / 60),
      Math.ceil(endMin / 60),
    );
    const first = slots[0];
    if (!first) {
      toast("No free slot today for this estimate", { tone: "danger" });
      return;
    }
    const result = placeDroppedTask(os, taskDragPayload(candidate), first.startsAt);
    toast(result.message, { tone: result.ok ? "success" : "danger" });
  };

  const shownSlots = freeSlots.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
          AI planner
        </div>
        <p className="mt-1.5 text-sm text-ink-3">
          <span className="font-medium text-ink">{freeLabel}</span> free in {windowLabel} ·{" "}
          {candidates.length} {candidates.length === 1 ? "task" : "tasks"} ready to schedule.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={onPlanDay}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            Plan today
          </Button>
          <Button variant="secondary" size="sm" onClick={onPlanWeek}>
            <CalendarRange className="size-3.5" aria-hidden="true" />
            Plan week
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-ink-3">
          AI proposes a plan and you apply it with one click. It never deletes existing blocks.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <CalendarClock className="size-3.5 text-ink-3" aria-hidden="true" />
            Free time
          </h3>
        </div>
        {shownSlots.length === 0 ? (
          <p className="text-xs text-ink-3">No free windows of 30+ minutes right now.</p>
        ) : (
          <ul className="space-y-1">
            {shownSlots.map((slot) => (
              <li key={`${slot.startsAt}-${slot.endsAt}`} className="flex items-center gap-2 text-sm">
                <Clock className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate tabular-nums text-ink">
                  {hour12
                    ? `${formatTime(slot.startsAt, true)} – ${formatTime(slot.endsAt, true)}`
                    : slotLabel(slot)}
                </span>
                <span className="shrink-0 text-xs text-ink-3">{formatMinutes(slot.durationMin)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <GripVertical className="size-3.5 text-ink-3" aria-hidden="true" />
            Ready to schedule
          </h3>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
            {candidates.length}
          </span>
        </div>
        {candidates.length === 0 ? (
          <p className="text-xs text-ink-3">
            All caught up — no open tasks are waiting to be planned.
          </p>
        ) : (
          <ul className="space-y-1">
            {candidates.map((candidate) => (
              <li key={candidate.task.id}>
                <div
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TASK, JSON.stringify(taskDragPayload(candidate)));
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="group flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 transition-colors hover:border-line-strong"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      planDot(taskKindFor(candidate) === "routine" ? "routine" : "task"),
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{candidate.task.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-3">
                      <span
                        className={cn(
                          candidate.reason === "Overdue" && "font-medium text-danger",
                        )}
                      >
                        {candidate.reason}
                      </span>
                      <span>·</span>
                      <span>{candidate.estimateMin} min</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => autoPlace(candidate)}
                    aria-label={`Auto-place ${candidate.task.title}`}
                    title="Place in next free slot today"
                    className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-accent-ink"
                  >
                    <CalendarPlus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}