"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

import type { HabitCadence, RoutineSlot, RoutineStep } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export interface RoutineDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    title: string;
    description: string;
    slot: RoutineSlot;
    cadence: HabitCadence;
    daysOfWeek: number[];
    steps: Array<RoutineStep>;
  }) => void;
  initial?: {
    title: string;
    description: string;
    slot: RoutineSlot;
    cadence: HabitCadence;
    daysOfWeek: number[];
    steps: Array<RoutineStep>;
  };
}

const SLOTS: { value: RoutineSlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
  { value: "work", label: "Work" },
  { value: "custom", label: "Custom" },
];

const CADENCES: { value: HabitCadence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RoutineDialog({ open, onClose, onSave, initial }: RoutineDialogProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [slot, setSlot] = React.useState<RoutineSlot>("morning");
  const [cadence, setCadence] = React.useState<HabitCadence>("daily");
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>([]);
  const [steps, setSteps] = React.useState<Array<RoutineStep>>([]);

  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setSlot(initial?.slot ?? "morning");
    setCadence(initial?.cadence ?? "daily");
    setDaysOfWeek(initial?.daysOfWeek ?? []);
    setSteps(initial?.steps ?? []);
  }, [open, initial]);

  const canSave = title.trim().length > 0;

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { title: "", taskId: null, habitId: null, durationMin: null }]);
  };

  const updateStep = (index: number, patch: Partial<RoutineStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit routine" : "New routine"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => {
            onSave({
              title: title.trim(),
              description: description.trim(),
              slot,
              cadence,
              daysOfWeek: cadence === "weekly" || cadence === "custom" ? daysOfWeek : [],
              steps: steps.filter((s) => s.title.trim()),
            });
            onClose();
          }} disabled={!canSave}>
            {initial ? "Save changes" : "Create routine"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="routine-title">Title</FieldLabel>
          <Input
            id="routine-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Morning routine, Shutdown ritual…"
            autoFocus
          />
        </div>

        <div>
          <FieldLabel htmlFor="routine-desc">Description</FieldLabel>
          <Textarea
            id="routine-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happens in this routine?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="routine-slot">Slot</FieldLabel>
            <select
              id="routine-slot"
              value={slot}
              onChange={(e) => setSlot(e.target.value as RoutineSlot)}
              className="w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink h-9 focus:border-accent focus:outline-none"
            >
              {SLOTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="routine-cadence">Cadence</FieldLabel>
            <select
              id="routine-cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as HabitCadence)}
              className="w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink h-9 focus:border-accent focus:outline-none"
            >
              {CADENCES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {cadence === "monthly" ? (
          <p className="text-[11px] text-ink-3">Monthly routines run on the 1st of each month.</p>
        ) : null}

        {(cadence === "weekly" || cadence === "custom") && (
          <div>
            <FieldLabel>Days of week</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  aria-pressed={daysOfWeek.includes(i)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    daysOfWeek.includes(i)
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <FieldLabel>Steps</FieldLabel>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={step.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  placeholder={`Step ${i + 1}`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={step.durationMin ?? ""}
                  onChange={(e) => updateStep(i, { durationMin: e.target.value ? Number(e.target.value) : null })}
                  placeholder="min"
                  className="w-16"
                  aria-label="Duration in minutes"
                />
                <Button variant="ghost" size="icon-sm" onClick={() => removeStep(i)} aria-label={`Remove step ${i + 1}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addStep}>
              <Plus className="size-3.5" />
              Add step
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
