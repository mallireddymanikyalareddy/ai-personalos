"use client";

import * as React from "react";

import { CheckCircle2, Circle, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

export interface RoutineDetailSheetProps {
  routineId: string | null;
  onClose: () => void;
  onEdit: () => void;
}

export function RoutineDetailSheet({ routineId, onClose, onEdit }: RoutineDetailSheetProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [confirming, setConfirming] = React.useState(false);
  const routine = routineId ? (state.routines[routineId] ?? null) : null;

  React.useEffect(() => {
    setConfirming(false);
  }, [routineId]);

  if (!routine) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = today.getTime();
  const dueToday = os.routineDueOnDay(routine.id, dayStart);
  const stats = dueToday ? os.routineStatsFor(routine.id, dayStart) : null;
  const items = dueToday
    ? os.materializeRoutine(routine.id, dayStart)
    : routine.steps.map((step) => ({
        step,
        taskId: null,
        habitId: step.habitId,
        title: step.title || "Untitled step",
        durationMin: step.durationMin,
      }));
  let nextDue: number | null = null;
  for (let index = 1; index <= 14 && !dueToday; index += 1) {
    const day = dayStart + index * 86_400_000;
    if (os.routineDueOnDay(routine.id, day)) {
      nextDue = day;
      break;
    }
  }

  const toggleItem = (taskId: string | null) => {
    if (!taskId) return;
    const task = state.tasks[taskId];
    if (!task) return;
    if (task.status === "done") {
      os.updateTask(taskId, { status: "open", completedAt: null });
    } else {
      os.completeTask(taskId);
    }
  };

  return (
    <Modal
      open={routineId != null}
      onClose={onClose}
      title={routine.title}
      description={routine.description || undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="danger"
            data-testid="routine-delete"
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              os.deleteRoutine(routine.id);
              toast("Routine deleted", { tone: "success" });
              onClose();
            }}
          >
            <Trash2 className="size-3.5" />
            {confirming ? "Confirm delete" : "Delete"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{routine.slot}</Badge>
          <Badge tone="accent">{routine.cadence}</Badge>
        </div>

        {!dueToday ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-3">
            This routine is not scheduled today.
            {nextDue != null
              ? ` Next on ${new Date(nextDue).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}.`
              : " Check its cadence to schedule it."}
          </p>
        ) : null}

        {stats && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-3">Today</span>
              <span className="font-semibold tabular-nums">{stats.doneToday} / {stats.total}</span>
            </div>
            <ProgressBar
              value={stats.total > 0 ? Math.round((stats.doneToday / stats.total) * 100) : 0}
              max={100}
              tone={stats.completeToday ? "success" : "accent"}
            />
          </div>
        )}

        <div className="space-y-1.5">
          {items.map((item, i) => {
            const task = item.taskId ? state.tasks[item.taskId] : null;
            const done = task?.status === "done";
            return (
              <button
                key={i}
                type="button"
                onClick={() => (dueToday ? toggleItem(item.taskId) : undefined)}
                disabled={!dueToday}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 disabled:cursor-default disabled:opacity-60"
              >
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : (
                  <Circle className="size-4 shrink-0 text-ink-3" />
                )}
                <span className={`min-w-0 flex-1 truncate ${done ? "text-ink-3 line-through" : "text-ink"}`}>
                  {item.title}
                </span>
                {item.durationMin != null && (
                  <span className="text-xs text-ink-3">{item.durationMin} min</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
