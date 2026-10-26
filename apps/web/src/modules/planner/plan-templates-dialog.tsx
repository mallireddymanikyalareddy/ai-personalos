"use client";

import * as React from "react";

import { CalendarRange, Play, Save, Trash2 } from "lucide-react";

import { planTemplatePayload, startOfDay, type Timestamp } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

import { DAY_MS } from "./planner-utils";

export interface PlanTemplatesDialogProps {
  open: boolean;
  onClose: () => void;
  anchor: Timestamp;
  weekStart: Timestamp;
  weekEnd: Timestamp;
}

export function PlanTemplatesDialog({
  open,
  onClose,
  anchor,
  weekStart,
  weekEnd,
}: PlanTemplatesDialogProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [scope, setScope] = React.useState<"day" | "week">("week");

  const templates = os.templates().filter((template) => planTemplatePayload(template) != null);

  const save = () => {
    const from = scope === "week" ? weekStart : startOfDay(anchor);
    const to = scope === "week" ? weekEnd : startOfDay(anchor) + DAY_MS;
    const blockCount = Object.values(state.timeBlocks).filter(
      (block) => block.startsAt < to && block.endsAt > from,
    ).length;
    if (blockCount === 0) {
      toast("There are no blocks in this range to save", { tone: "danger" });
      return;
    }
    const template = os.savePlanTemplate({
      name: name.trim() || `${scope === "week" ? "Week" : "Day"} plan`,
      from,
      to,
    });
    setName("");
    toast(`Saved "${template.name}" with ${blockCount} blocks`, { tone: "success" });
  };

  const apply = (id: string, target: "day" | "week") => {
    const result = os.applyPlanTemplate(id, target === "week" ? weekStart : startOfDay(anchor));
    toast(result.message, { tone: result.ok ? "success" : "danger" });
    if (result.ok) onClose();
  };

  const remove = (id: string, templateName: string) => {
    os.deleteTemplate(id);
    toast(`Deleted "${templateName}"`, { tone: "success" });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan templates"
      description="Save a day or week of blocks and replay it onto another period."
      size="lg"
      footer={
        <div className="flex items-center justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-surface-2/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
            Save current plan
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Template name"
              aria-label="Template name"
              className="h-8 min-w-40 flex-1"
            />
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as "day" | "week")}
              aria-label="Template range"
              className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink"
            >
              <option value="week">This week</option>
              <option value="day">This day</option>
            </select>
            <Button type="button" variant="primary" size="sm" onClick={save} data-testid="save-plan-template">
              <Save className="size-3.5" aria-hidden="true" />
              Save
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Only blocks in the selected range are captured. Applying never deletes existing blocks.
          </p>
        </div>

        {templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">
            No plan templates yet. Save this week to create one.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="plan-template-list">
            {templates.map((template) => {
              const payload = planTemplatePayload(template);
              if (!payload) return null;
              return (
                <li
                  key={template.id}
                  data-testid="plan-template-row"
                  className="rounded-xl border border-line p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink">{template.name}</p>
                      <p className="text-[11px] text-ink-3">
                        {payload.blocks.length} blocks · {payload.dayCount}{" "}
                        {payload.dayCount === 1 ? "day" : "days"} · used {template.useCount}×
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(template.id, template.name)}
                      aria-label={`Delete ${template.name}`}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {payload.dayCount > 1 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => apply(template.id, "week")}
                        data-testid="apply-plan-template-week"
                      >
                        <CalendarRange className="size-3.5" aria-hidden="true" />
                        Apply to this week
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => apply(template.id, "day")}
                      data-testid="apply-plan-template-day"
                    >
                      <Play className="size-3.5" aria-hidden="true" />
                      {payload.dayCount > 1 ? "Apply from this day" : "Apply to this day"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
