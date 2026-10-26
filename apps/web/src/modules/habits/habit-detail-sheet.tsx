"use client";

import * as React from "react";

import { Archive, Flame, Link2, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

import { addDays, startOfDay } from "@/lib/datetime";
import { useAppState, useOS } from "@/store/use-os";

export interface HabitDetailSheetProps {
  habitId: string | null;
  onClose: () => void;
  onEdit: () => void;
}

const WEEKDAY_LETTERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function HabitDetailSheet({ habitId, onClose, onEdit }: HabitDetailSheetProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const habit = habitId ? (state.habits[habitId] ?? null) : null;
  const today = startOfDay(Date.now());
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    setConfirmDelete(false);
  }, [habitId]);

  const last14 = React.useMemo(() => {
    if (!habit) return [];
    const checkins = os.checkInsFor(habit.id);
    const days: { ts: number; checked: boolean }[] = [];
    for (let i = 13; i >= 0; i--) {
      const ts = addDays(today, -i);
      days.push({ ts, checked: checkins.some((c) => startOfDay(c.checkedAt) === ts) });
    }
    return days;
  }, [today, habit, os]);

  if (!habit) return null;

  const checkins = os.checkInsFor(habit.id);
  const stats = os.habitStatsFor(habit.id);
  const streaks = os.habitStreakFor(habit.id);
  const checkedToday = os.habitCheckedOn(habit.id, today);
  const goals = Object.values(state.goals)
    .filter((goal) => goal.status !== "archived")
    .sort((a, b) => a.title.localeCompare(b.title));
  const linkedGoal = habit.goalId ? state.goals[habit.goalId] : null;

  const toggleDay = (dayStart: number) => {
    if (habit.archived) return;
    if (os.habitCheckedOn(habit.id, dayStart)) {
      os.undoHabit(habit.id, dayStart);
    } else {
      os.completeHabit(habit.id, dayStart);
    }
  };

  const toggleToday = () => {
    if (checkedToday) {
      os.undoHabit(habit.id, today);
    } else {
      os.completeHabit(habit.id);
      toast("Checked in", { tone: "success" });
    }
  };

  const toggleArchive = () => {
    const next = !habit.archived;
    os.updateHabit(habit.id, { archived: next });
    toast(next ? "Habit archived" : "Habit restored");
    if (next) onClose();
  };

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    os.deleteHabit(habit.id);
    toast("Habit deleted");
    onClose();
  };

  return (
    <Modal
      open={habitId != null}
      onClose={onClose}
      title={habit.title}
      footer={
        <>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant={checkedToday ? "secondary" : "primary"}
            onClick={toggleToday}
            disabled={habit.archived}
          >
            {checkedToday ? "Undo today" : "Check in today"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame className={streaks && streaks.current > 0 ? "size-4 text-warning" : "size-4 text-ink-3/60"} />
            <span className="text-lg font-semibold tabular-nums">{streaks?.current ?? 0}</span>
            <span className="text-sm text-ink-3">day streak</span>
          </div>
          <Badge tone="neutral">Best {streaks?.best ?? 0}</Badge>
          {habit.archived ? <Badge tone="outline">Archived</Badge> : null}
        </div>

        {stats && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-3">Completion rate</span>
              <span className="font-semibold tabular-nums">{stats.completionRate}%</span>
            </div>
            <ProgressBar value={stats.completionRate} max={100} tone="accent" />
            <p className="mt-1 text-xs text-ink-3">
              {stats.metPeriods} of {stats.duePeriods} periods · {stats.totalCheckIns} total check-ins
            </p>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Last 14 days</span>
            <span className="text-[11px] text-ink-3">
              {habit.archived ? "Restore to backfill" : "Click a day to toggle"}
            </span>
          </div>
          <div className="flex gap-1">
            {last14.map((day) => (
              <button
                key={day.ts}
                type="button"
                onClick={() => toggleDay(day.ts)}
                disabled={habit.archived}
                aria-pressed={day.checked}
                aria-label={`${new Date(day.ts).toLocaleDateString()} ${day.checked ? "checked in" : "not checked in"}`}
                title={new Date(day.ts).toLocaleDateString()}
                className={`flex-1 rounded-md py-1 text-center text-[10px] font-medium transition-colors ${
                  day.checked ? "bg-accent text-white" : "bg-surface-2 text-ink-3 hover:bg-surface-3"
                } ${habit.archived ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {WEEKDAY_LETTERS[(new Date(day.ts).getDay() + 6) % 7]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-3">Linked goal</span>
            <Link2 className="size-3.5 text-ink-3" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Goals",
                  items: [
                    { label: "No goal", selected: habit.goalId == null, onSelect: () => os.updateHabit(habit.id, { goalId: null }) },
                    ...goals.map((goal) => ({
                      label: goal.title,
                      selected: habit.goalId === goal.id,
                      onSelect: () => os.updateHabit(habit.id, { goalId: goal.id }),
                    })),
                  ],
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                >
                  {linkedGoal ? linkedGoal.title : "Link a goal"}
                </button>
              }
            />
            {linkedGoal ? (
              <button
                type="button"
                onClick={() => os.updateHabit(habit.id, { goalId: null })}
                className="text-[11px] font-medium text-ink-3 hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {checkins.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-ink-3">Recent check-ins</div>
            <div className="space-y-1">
              {[...checkins]
                .sort((a, b) => b.checkedAt - a.checkedAt)
                .slice(0, 5)
                .map((checkin) => (
                  <div key={checkin.id} className="flex items-center justify-between text-sm text-ink-2">
                    <span>{new Date(checkin.checkedAt).toLocaleDateString()}</span>
                    <span className="text-ink-3">
                      {new Date(checkin.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={toggleArchive}>
            {habit.archived ? <RotateCcw className="size-3.5" /> : <Archive className="size-3.5" />}
            {habit.archived ? "Restore habit" : "Archive habit"}
          </Button>
          <Button variant="danger" size="sm" onClick={remove}>
            <Trash2 className="size-3.5" />
            {confirmDelete ? "Click again to delete" : "Delete habit"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
