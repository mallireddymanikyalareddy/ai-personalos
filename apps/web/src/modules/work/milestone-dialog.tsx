"use client";

import * as React from "react";

import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

import type { Timestamp } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

export interface MilestoneDialogTarget {
  projectId: string;
  milestoneId?: string | null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateInput(at: Timestamp | null): string {
  if (at == null) return "";
  const date = new Date(at);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInput(value: string): Timestamp | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0).getTime();
}

export function MilestoneDialog({
  target,
  onClose,
}: {
  target: MilestoneDialogTarget | null;
  onClose: () => void;
}) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const milestone =
    target?.milestoneId != null ? (state.milestones[target.milestoneId] ?? null) : null;
  const project = target ? (state.projects[target.projectId] ?? null) : null;

  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [due, setDue] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    setTitle(milestone?.title ?? "");
    setSummary(milestone?.summary ?? "");
    setDue(toDateInput(milestone?.dueAt ?? null));
    setConfirming(false);
  }, [milestone, target]);

  const canSave = title.trim().length > 0;

  const save = () => {
    if (!target || !canSave) return;
    const dueAt = fromDateInput(due);
    if (milestone) {
      os.updateMilestone(milestone.id, { title: title.trim(), summary: summary.trim(), dueAt });
      toast("Milestone updated", { tone: "success" });
    } else {
      os.addMilestone({
        projectId: target.projectId,
        title: title.trim(),
        summary: summary.trim(),
        dueAt,
      });
      toast(dueAt != null ? "Milestone added to the timeline" : "Milestone added", {
        tone: "success",
      });
    }
    onClose();
  };

  const toggleComplete = () => {
    if (!milestone) return;
    if (milestone.status === "completed") {
      os.reopenMilestone(milestone.id);
      toast("Milestone reopened");
    } else {
      os.completeMilestone(milestone.id);
      toast("Milestone completed", { tone: "success" });
    }
  };

  const remove = () => {
    if (!milestone) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    os.deleteMilestone(milestone.id);
    toast("Milestone deleted", { tone: "success" });
    onClose();
  };

  return (
    <Modal
      open={target != null}
      onClose={onClose}
      title={milestone ? "Edit milestone" : "New milestone"}
      description={project ? project.name : undefined}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {milestone ? (
              <>
                <Button type="button" variant="ghost" onClick={toggleComplete}>
                  {milestone.status === "completed" ? (
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  )}
                  {milestone.status === "completed" ? "Reopen" : "Mark complete"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={remove}
                  data-testid="milestone-delete"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {confirming ? "Confirm delete" : "Delete"}
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={save}
              disabled={!canSave}
              data-testid="milestone-save"
            >
              {milestone ? "Save changes" : "Add milestone"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="milestone-title">Title</FieldLabel>
          <Input
            id="milestone-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Beta launch, Design sign-off…"
            autoFocus
          />
        </div>

        <div>
          <FieldLabel htmlFor="milestone-summary">Summary</FieldLabel>
          <Textarea
            id="milestone-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What does done look like?"
          />
        </div>

        <div>
          <FieldLabel htmlFor="milestone-due">Due date</FieldLabel>
          <Input
            id="milestone-due"
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
          <p className="mt-1 text-[11px] text-ink-3">
            Milestones with a due date appear on the project timeline and set the project deadline.
          </p>
        </div>
      </div>
    </Modal>
  );
}
