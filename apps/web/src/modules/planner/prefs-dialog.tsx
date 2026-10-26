"use client";

import * as React from "react";

import type { PlanningPreferences } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { parseHHMM } from "./planner-utils";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export interface PrefsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PrefsDialog({ open, onClose }: PrefsDialogProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [draft, setDraft] = React.useState<PlanningPreferences>(() => state.settings.planning);

  React.useEffect(() => {
    if (open) setDraft(state.settings.planning);
  }, [open, state.settings.planning]);

  const toggleDay = (weekday: number) => {
    setDraft((current) => {
      const has = current.workDays.includes(weekday);
      const workDays = has
        ? current.workDays.filter((day) => day !== weekday)
        : [...current.workDays, weekday].sort((a, b) => a - b);
      return { ...current, workDays };
    });
  };

  const save = () => {
    if (parseHHMM(draft.dayStart) == null || parseHHMM(draft.dayEnd) == null) {
      toast("Use HH:MM times for the working window", { tone: "danger" });
      return;
    }
    os.updatePlanningPreferences({ ...draft });
    toast("Planning preferences saved", { tone: "success" });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Planning preferences"
      description="Shape the window the planner uses to fit your work into."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Auto-planning</p>
            <p className="text-xs text-ink-3">Whether AI suggestions consider this window.</p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
            label="Auto-planning enabled"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Day starts" htmlFor="planner-day-start">
            <Input
              id="planner-day-start"
              type="time"
              value={draft.dayStart}
              onChange={(event) => setDraft((current) => ({ ...current, dayStart: event.target.value }))}
            />
          </Field>
          <Field label="Day ends" htmlFor="planner-day-end">
            <Input
              id="planner-day-end"
              type="time"
              value={draft.dayEnd}
              onChange={(event) => setDraft((current) => ({ ...current, dayEnd: event.target.value }))}
            />
          </Field>
        </div>

        <Field label="Working days">
          <div className="flex gap-1.5" role="group" aria-label="Working days">
            {DAY_LABELS.map((label, index) => {
              const active = draft.workDays.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleDay(index)}
                  className={cn(
                    "grid size-8 place-items-center rounded-lg text-xs font-medium transition-colors",
                    active
                      ? "bg-accent text-white"
                      : "bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink-2",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Buffer between tasks (min)" htmlFor="planner-buffer">
            <Input
              id="planner-buffer"
              type="number"
              min={0}
              max={120}
              value={draft.bufferMin}
              onChange={(event) =>
                setDraft((current) => ({ ...current, bufferMin: Number(event.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="Default task estimate (min)" htmlFor="planner-estimate">
            <Input
              id="planner-estimate"
              type="number"
              min={15}
              max={480}
              value={draft.defaultEstimateMin}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  defaultEstimateMin: Number(event.target.value) || 0,
                }))
              }
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}