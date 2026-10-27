"use client";

import * as React from "react";

import { Paperclip, Plus, Trash2, X } from "lucide-react";

import type { GoalCategory, GoalHorizon, GoalMetric, ID } from "@personalos/core";
import { GOAL_CATEGORIES, GOAL_CATEGORY_LABELS } from "@personalos/core";

import { LifeAreaSelect } from "@/components/life-area/life-area";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const MAX_COVER_BYTES = 1_500_000;

export interface GoalDialogInput {
  title: string;
  description: string;
  horizon: GoalHorizon;
  targetAt: number | null;
  metrics: Array<GoalMetric>;
  category: GoalCategory;
  coverUrl: string | null;
  lifeAreaId?: ID | null;
}

export interface GoalDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: GoalDialogInput) => void;
  initial?: GoalDialogInput;
}

const HORIZONS: { value: GoalHorizon; label: string }[] = [
  { value: "life", label: "Life" },
  { value: "year", label: "Year" },
  { value: "quarter", label: "Quarter" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
];

function toDateValue(ts: number | null): string {
  if (ts == null) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateValue(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

export function GoalDialog({ open, onClose, onSave, initial }: GoalDialogProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [horizon, setHorizon] = React.useState<GoalHorizon>("quarter");
  const [targetAt, setTargetAt] = React.useState<number | null>(null);
  const [metrics, setMetrics] = React.useState<Array<GoalMetric>>([]);
  const [category, setCategory] = React.useState<GoalCategory>("other");
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [coverError, setCoverError] = React.useState<string | null>(null);
  const [lifeAreaId, setLifeAreaId] = React.useState<ID | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLifeAreaId(initial?.lifeAreaId ?? null);
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setHorizon(initial?.horizon ?? "quarter");
    setTargetAt(initial?.targetAt ?? null);
    setMetrics(initial?.metrics ?? []);
    setCategory(initial?.category ?? "other");
    setCoverUrl(initial?.coverUrl ?? null);
    setCoverError(null);
  }, [open, initial]);

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ title: title.trim(), description: description.trim(), horizon, targetAt, metrics, category, coverUrl, lifeAreaId });
    onClose();
  };

  const onCover = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_COVER_BYTES) {
      setCoverError("That image is over 1.5 MB — pick a smaller one.");
      return;
    }
    setCoverError(null);
    const reader = new FileReader();
    reader.onload = () => setCoverUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const updateMetric = (index: number, patch: Partial<GoalMetric>) => {
    setMetrics((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit goal" : "New goal"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {initial ? "Save changes" : "Create goal"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="goal-title">Title</FieldLabel>
          <Input
            id="goal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Get fit, write a book, launch a product…"
            autoFocus
          />
        </div>

        <div>
          <FieldLabel htmlFor="goal-desc">Description</FieldLabel>
          <Textarea
            id="goal-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does done look like?"
          />
        </div>

        <div>
          <FieldLabel htmlFor="goal-life-area">Life area</FieldLabel>
          <LifeAreaSelect id="goal-life-area" testId="goal-life-area-select" value={lifeAreaId} onChange={setLifeAreaId} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="goal-category">Category</FieldLabel>
            <select
              id="goal-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as GoalCategory)}
              className="w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink h-9 focus:border-accent focus:outline-none"
            >
              {GOAL_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {GOAL_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="goal-horizon">Horizon</FieldLabel>
            <select
              id="goal-horizon"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as GoalHorizon)}
              className="w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink h-9 focus:border-accent focus:outline-none"
            >
              {HORIZONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="goal-target">Target date</FieldLabel>
          <Input
            id="goal-target"
            type="date"
            value={toDateValue(targetAt)}
            onChange={(e) => setTargetAt(fromDateValue(e.target.value))}
          />
        </div>

        <div>
          <FieldLabel htmlFor="goal-cover">Cover image</FieldLabel>
          <div className="flex items-center gap-3">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="h-16 w-20 rounded-xl border border-line object-cover" />
            ) : null}
            <label
              htmlFor="goal-cover"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent-ink"
            >
              <Paperclip className="size-3.5" />
              {coverUrl ? "Replace" : "Attach photo"}
            </label>
            {coverUrl ? (
              <Button variant="ghost" size="sm" onClick={() => setCoverUrl(null)} aria-label="Remove cover">
                <X className="size-3.5" />
                Remove
              </Button>
            ) : null}
            <input
              id="goal-cover"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onCover(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {coverError ? <p className="mt-1 text-xs text-danger">{coverError}</p> : null}
        </div>

        <div>
          <FieldLabel>Metrics</FieldLabel>
          <div className="space-y-2">
            {metrics.map((metric, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={metric.label}
                  onChange={(e) => updateMetric(i, { label: e.target.value })}
                  placeholder="Label"
                  className="flex-1"
                  aria-label={`Metric ${i + 1} label`}
                />
                <Input
                  type="number"
                  value={metric.current}
                  onChange={(e) => updateMetric(i, { current: Number(e.target.value) })}
                  className="w-20"
                  aria-label={`Metric ${i + 1} current`}
                />
                <Input
                  type="number"
                  value={metric.target}
                  onChange={(e) => updateMetric(i, { target: Number(e.target.value) })}
                  className="w-20"
                  aria-label={`Metric ${i + 1} target`}
                />
                <Input
                  value={metric.unit}
                  onChange={(e) => updateMetric(i, { unit: e.target.value })}
                  placeholder="Unit"
                  className="w-16"
                  aria-label={`Metric ${i + 1} unit`}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMetrics((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove metric ${metric.label || i + 1}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setMetrics((prev) => [...prev, { label: "", current: 0, target: 100, unit: "" }])
              }
            >
              <Plus className="size-3.5" />
              Add metric
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
