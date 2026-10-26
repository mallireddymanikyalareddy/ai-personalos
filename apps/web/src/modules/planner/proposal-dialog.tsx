"use client";

import * as React from "react";

import { ListChecks, Sparkles } from "lucide-react";

import { formatTime, type PlanProposal, type PlanSlot, type Timestamp } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

import { PLAN_KIND_LABELS, formatMinutes } from "./planner-utils";
import { SlotChip } from "./plan-item";

function sortSlots(slots: PlanSlot[]): PlanSlot[] {
  return [...slots].sort((a, b) => a.startsAt - b.startsAt);
}

export interface ProposalDialogProps {
  proposal: PlanProposal | null;
  onClose: () => void;
  rangeLabel: string;
  onScheduleTask: (taskId: string) => void;
}

export function ProposalDialog({
  proposal,
  onClose,
  rangeLabel,
  onScheduleTask,
}: ProposalDialogProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const hour12 = state.settings.timeFormat === 12;
  const planningEnabled = state.settings.planning.enabled;
  const open = proposal != null;

  const applyPlan = () => {
    if (!proposal) return;
    const diff = os.diffPlan(proposal);
    const previousBlocks = diff.changes.flatMap((change) => {
      if (change.action !== "move" || change.blockId == null) return [];
      const block = os.getState().timeBlocks[change.blockId];
      return block ? [{ blockId: block.id, startsAt: block.startsAt, endsAt: block.endsAt }] : [];
    });
    const previousTasks = new Map<string, Timestamp | null>();
    for (const change of diff.changes) {
      if (change.taskId != null && !previousTasks.has(change.taskId)) {
        previousTasks.set(change.taskId, os.getTask(change.taskId)?.scheduledAt ?? null);
      }
    }

    const result = os.applyPlan(proposal);
    const undo = () => {
      for (const id of result.createdBlockIds) os.deleteTimeBlock(id);
      for (const entry of previousBlocks) {
        os.updateTimeBlock(entry.blockId, { startsAt: entry.startsAt, endsAt: entry.endsAt });
      }
      for (const [taskId, scheduledAt] of previousTasks) {
        os.updateTask(taskId, { scheduledAt });
      }
      toast("Plan reverted", { tone: "success" });
    };
    if (result.applied > 0) {
      toast(
        `Applied ${result.applied} ${result.applied === 1 ? "slot" : "slots"} to your plan`,
        { tone: "success", action: { label: "Undo", onClick: undo } },
      );
    } else {
      toast("The plan already matches your schedule", { tone: "success" });
    }
    if (result.rejected.length > 0) {
      toast(
        `Skipped ${result.rejected.length} ${result.rejected.length === 1 ? "change" : "changes"} that are no longer available`,
        { tone: "danger" },
      );
    }
    onClose();
  };

  const slots = proposal ? sortSlots(proposal.slots) : [];
  const unplanned = proposal?.unplanned ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Suggested plan"
      description={
        proposal
          ? planningEnabled
            ? `${rangeLabel} · ${formatMinutes(proposal.plannedMin)} planned across ${proposal.slots.length} ${proposal.slots.length === 1 ? "slot" : "slots"}. Applying never deletes existing blocks.`
            : `${rangeLabel} · AI planning is turned off in your preferences.`
          : undefined
      }
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Dismiss
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={proposal == null || proposal.slots.length === 0}
            onClick={applyPlan}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Apply plan
          </Button>
        </div>
      }
    >
      {proposal == null ? null : (
        <div className="space-y-5">
          {!planningEnabled && (
            <p className="py-6 text-center text-sm text-ink-3">
              AI planning is off. Turn it on in Planner preferences to generate suggestions.
            </p>
          )}

          {planningEnabled && slots.length === 0 && unplanned.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-3">
              Nothing to plan in this window — your calendar is wide open.
            </p>
          )}

          {slots.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                <ListChecks className="size-3.5" aria-hidden="true" />
                Planned slots
              </h3>
              <ul className="space-y-1.5">
                {slots.map((slot) => (
                  <li key={slot.id}>
                    <SlotChip
                      kind={slot.kind}
                      title={slot.title}
                      subtitle={`${formatTime(slot.startsAt, hour12)} – ${formatTime(slot.endsAt, hour12)}${slot.reason ? ` · ${slot.reason}` : ""}`}
                      trailing={
                        slot.blockId != null ? (
                          <Badge tone="accent">Move</Badge>
                        ) : slot.kind === "buffer" ? (
                          <Badge tone="neutral">Buffer</Badge>
                        ) : (
                          <Badge tone="outline">{PLAN_KIND_LABELS[slot.kind]}</Badge>
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unplanned.length > 0 && (
            <div>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                Left unscheduled · {unplanned.length}
              </h3>
              <ul className="space-y-1">
                {unplanned.map((task) => (
                  <li
                    key={task.taskId}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">{task.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">{task.reason}</span>
                    <button
                      type="button"
                      data-testid="proposal-schedule-task"
                      onClick={() => onScheduleTask(task.taskId)}
                      className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-accent-ink transition-colors hover:bg-accent-soft"
                    >
                      Schedule
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}