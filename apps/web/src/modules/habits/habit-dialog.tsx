"use client";

import * as React from "react";

import type { HabitCadence, HabitPriority } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

import { HABIT_COLOR_OPTIONS, HABIT_ICON_OPTIONS } from "./habits-meta";

export interface HabitDialogValue {
  title: string;
  description: string | null;
  cadence: HabitCadence;
  daysOfWeek: number[];
  daysOfMonth: number[];
  targetPerPeriod: number;
  priority: HabitPriority;
  color: string | null;
  icon: string | null;
}

export interface HabitDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: HabitDialogValue) => void;
  initial?: HabitDialogValue;
}

const CADENCES: { value: HabitCadence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HabitDialog({ open, onClose, onSave, initial }: HabitDialogProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cadence, setCadence] = React.useState<HabitCadence>("daily");
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>([]);
  const [daysOfMonth, setDaysOfMonth] = React.useState<number[]>([]);
  const [targetPerPeriod, setTargetPerPeriod] = React.useState(1);
  const [priority, setPriority] = React.useState<HabitPriority>("medium");
  const [color, setColor] = React.useState<string | null>(null);
  const [icon, setIcon] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setCadence(initial?.cadence ?? "daily");
    setDaysOfWeek(initial?.daysOfWeek ?? []);
    setDaysOfMonth(initial?.daysOfMonth ?? []);
    setTargetPerPeriod(initial?.targetPerPeriod ?? 1);
    setPriority(initial?.priority ?? "medium");
    setColor(initial?.color ?? null);
    setIcon(initial?.icon ?? null);
  }, [open, initial]);

  const canSave = title.trim().length > 0;

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const toggleMonthDay = (day: number) => {
    setDaysOfMonth((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      description: description.trim().length > 0 ? description.trim() : null,
      cadence,
      daysOfWeek: cadence === "weekly" || cadence === "custom" ? daysOfWeek : [],
      daysOfMonth: cadence === "monthly" || cadence === "custom" ? daysOfMonth : [],
      targetPerPeriod,
      priority,
      color,
      icon,
    });
    onClose();
  };

  const needsDaysOfWeek = cadence === "weekly" || cadence === "custom";
  const needsDaysOfMonth = cadence === "monthly" || cadence === "custom";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit habit" : "New habit"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {initial ? "Save changes" : "Create habit"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="habit-title">Title</FieldLabel>
          <Input
            id="habit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meditate, read, exercise…"
            autoFocus
          />
        </div>

        <div>
          <FieldLabel htmlFor="habit-description">Description</FieldLabel>
          <Input
            id="habit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Drink at least 8 glasses of water"
          />
        </div>

        <div>
          <FieldLabel htmlFor="habit-cadence">Cadence</FieldLabel>
          <Select
            id="habit-cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as HabitCadence)}
          >
            {CADENCES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FieldLabel htmlFor="habit-priority">Priority</FieldLabel>
          <Select
            id="habit-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as HabitPriority)}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>

        <div>
          <FieldLabel>Icon</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {HABIT_ICON_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = icon === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setIcon(selected ? null : option.value)}
                  aria-pressed={selected}
                  aria-label={option.label}
                  className={`grid size-9 place-items-center rounded-lg border transition-colors ${
                    selected
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>Color</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            {HABIT_COLOR_OPTIONS.map((option) => {
              const selected = color === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(selected ? null : option.value)}
                  aria-pressed={selected}
                  aria-label={option.label}
                  className={`size-7 rounded-full border-2 transition-colors ${
                    selected ? "border-accent" : "border-transparent"
                  }`}
                  style={{ backgroundColor: option.swatch }}
                />
              );
            })}
          </div>
        </div>

        {needsDaysOfWeek && (
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

        {needsDaysOfMonth && (
          <div>
            <FieldLabel>Days of month</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleMonthDay(day)}
                  aria-pressed={daysOfMonth.includes(day)}
                  className={`size-8 rounded-lg border text-xs font-medium transition-colors ${
                    daysOfMonth.includes(day)
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <FieldLabel htmlFor="habit-target">Target per period</FieldLabel>
          <Input
            id="habit-target"
            type="number"
            min={1}
            value={targetPerPeriod}
            onChange={(e) => setTargetPerPeriod(Math.max(1, Number(e.target.value)))}
            className="w-24"
          />
        </div>
      </div>
    </Modal>
  );
}
