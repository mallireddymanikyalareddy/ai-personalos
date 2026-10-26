"use client";

import * as React from "react";

import { CalendarClock } from "lucide-react";

import { formatTime, startOfDay, type Timestamp } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

import {
  DAY_MS,
  MINUTE_MS,
  placeDroppedTask,
  type TaskDragData,
} from "./planner-utils";

const DAY_LABEL = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateInput(time: Timestamp): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(time: Timestamp): string {
  const date = new Date(time);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInputs(date: string, time: string): Timestamp | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!day || !clock) return null;
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (hour > 23 || minute > 59) return null;
  return new Date(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    hour,
    minute,
    0,
    0,
  ).getTime();
}

function nextQuarterHour(now: Timestamp): Timestamp {
  return Math.ceil((now + 15 * MINUTE_MS) / (15 * MINUTE_MS)) * 15 * MINUTE_MS;
}

export interface ScheduleTaskDialogProps {
  taskId: string | null;
  onClose: () => void;
}

export function ScheduleTaskDialog({ taskId, onClose }: ScheduleTaskDialogProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const task = taskId ? (state.tasks[taskId] ?? null) : null;
  const hour12 = state.settings.timeFormat === 12;
  const [now, setNow] = React.useState(() => Date.now());

  const defaultDuration = Math.max(
    15,
    task?.estimateMin ?? state.settings.planning.defaultEstimateMin,
  );
  const initialStart = nextQuarterHour(now);

  const [date, setDate] = React.useState(() => toDateInput(initialStart));
  const [time, setTime] = React.useState(() => toTimeInput(initialStart));
  const [duration, setDuration] = React.useState(defaultDuration);

  React.useEffect(() => {
    if (!taskId) return;
    const target = os.getTask(taskId);
    if (!target) return;
    const start = nextQuarterHour(Date.now());
    setDate(toDateInput(start));
    setTime(toTimeInput(start));
    setDuration(Math.max(15, target.estimateMin ?? state.settings.planning.defaultEstimateMin));
    setNow(Date.now());
  }, [os, state.settings.planning.defaultEstimateMin, taskId]);

  const suggestions = React.useMemo(() => {
    if (!task) return [];
    return os
      .findPlanningWindows(now, startOfDay(now) + 7 * DAY_MS, 15)
      .filter((slot) => slot.startsAt > now && slot.durationMin >= duration)
      .slice(0, 4);
  }, [duration, now, os, task]);

  const schedule = () => {
    if (!task) return;
    const startsAt = fromInputs(date, time);
    if (startsAt == null) {
      toast("Pick a valid date and time", { tone: "danger" });
      return;
    }
    if (startsAt <= Date.now()) {
      toast("Pick a time in the future", { tone: "danger" });
      return;
    }
    const payload: TaskDragData = {
      taskId: task.id,
      title: task.title,
      estimateMin: Math.max(15, duration),
      kind: task.routineId != null ? "routine" : "focus",
    };
    const result = placeDroppedTask(os, payload, startsAt);
    toast(result.message, { tone: result.ok ? "success" : "danger" });
    if (result.ok) onClose();
  };

  return (
    <Modal
      open={task != null}
      onClose={onClose}
      title="Schedule task"
      description={task ? task.title : undefined}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={schedule} data-testid="schedule-task-submit">
            <CalendarClock className="size-4" aria-hidden="true" />
            Schedule
          </Button>
        </div>
      }
    >
      {task == null ? null : (
        <div className="space-y-5">
          {task.scheduledAt != null ? (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-3">
              Currently scheduled for{" "}
              <span className="font-medium text-ink">
                {DAY_LABEL.format(new Date(task.scheduledAt))} at{" "}
                {formatTime(task.scheduledAt, hour12)}
              </span>
              . Scheduling again adds a second block.
            </p>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Next free slots
            </p>
            {suggestions.length === 0 ? (
              <p className="text-[12px] text-ink-3">
                No free {duration}-minute windows in the next week. Pick a time manually.
              </p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2" data-testid="schedule-suggestions">
                {suggestions.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    data-testid="schedule-suggestion"
                    onClick={() => {
                      setDate(toDateInput(slot.startsAt));
                      setTime(toTimeInput(slot.startsAt));
                    }}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 py-1.5 text-left text-[12px] transition-colors hover:border-line-strong hover:bg-surface-3"
                  >
                    <span className="truncate text-ink">{DAY_LABEL.format(new Date(slot.startsAt))}</span>
                    <span className="shrink-0 tabular-nums text-ink-3">
                      {formatTime(slot.startsAt, hour12)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="schedule-date">
              <Input
                id="schedule-date"
                type="date"
                value={date}
                min={toDateInput(startOfDay(now))}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label="Start time" htmlFor="schedule-time">
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Duration (minutes)" htmlFor="schedule-duration">
            <Input
              id="schedule-duration"
              type="number"
              min={15}
              step={15}
              max={480}
              value={duration}
              onChange={(event) =>
                setDuration(Math.max(15, Number(event.target.value) || 15))
              }
            />
          </Field>

          <p className="text-[11px] text-ink-3">
            Creates a focus block and marks the task as scheduled. Overlapping time is
            rejected — use the next free slots above.
          </p>
        </div>
      )}
    </Modal>
  );
}
