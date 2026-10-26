"use client";

import * as React from "react";

import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";

import { formatTime, startOfDay, type TimeBlock } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import {
  BLOCK_KIND_LABELS,
  DAY_MS,
  MINUTE_MS,
  clamp,
  formatMinutes,
  moveDroppedBlock,
} from "./planner-utils";

export interface BlockMenuDialogProps {
  blockId: string | null;
  onClose: () => void;
}

export function BlockMenuDialog({ blockId, onClose }: BlockMenuDialogProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const hour12 = state.settings.timeFormat === 12;
  const block: TimeBlock | null = blockId ? (state.timeBlocks[blockId] ?? null) : null;

  const settle = (result: { ok: boolean; message: string }) => {
    toast(result.message, { tone: result.ok ? "success" : "danger" });
    onClose();
  };

  const nudge = (deltaMin: number) => {
    if (!block) return;
    const durationMs = block.endsAt - block.startsAt;
    const dayStart = startOfDay(block.startsAt);
    const nextStart = clamp(
      block.startsAt + deltaMin * MINUTE_MS,
      dayStart,
      dayStart + DAY_MS - durationMs,
    );
    if (nextStart === block.startsAt) {
      toast("This block is already at the edge of its day", { tone: "danger" });
      return;
    }
    settle(moveDroppedBlock(os, block.id, nextStart));
  };

  const remove = () => {
    if (!block) return;
    const snapshot = {
      title: block.title,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      kind: block.kind,
      taskId: block.taskId,
      eventId: block.eventId,
      source: block.source,
    };
    os.deleteTimeBlock(block.id);
    toast("Block deleted", {
      tone: "success",
      action: {
        label: "Undo",
        onClick: () => {
          os.addTimeBlock(snapshot);
          toast("Block restored", { tone: "success" });
        },
      },
    });
    onClose();
  };

  return (
    <Modal
      open={block != null}
      onClose={onClose}
      title={block?.title ?? "Time block"}
      size="sm"
      description={
        block
          ? `${formatTime(block.startsAt, hour12)} – ${formatTime(block.endsAt, hour12)} · ${formatMinutes((block.endsAt - block.startsAt) / MINUTE_MS)}`
          : undefined
      }
    >
      {block ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                block.source === "ai"
                  ? "bg-accent-soft text-accent-ink"
                  : "bg-surface-2 text-ink-3",
              )}
            >
              {block.source === "ai" ? "AI-planned" : "Manual"}
            </span>
            <Badge tone="outline">{BLOCK_KIND_LABELS[block.kind]}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => nudge(-30)}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Earlier 30m
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => nudge(30)}>
              <ArrowRight className="size-3.5" aria-hidden="true" />
              Later 30m
            </Button>
          </div>
          <Button type="button" variant="danger" className="w-full" onClick={remove}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete block
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}