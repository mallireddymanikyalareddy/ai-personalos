"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import type { Timestamp } from "@personalos/core";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

import { useOS } from "@/store/use-os";

import {
  HOUR_PX,
  hasPlannerDrag,
  moveDroppedBlock,
  placeDroppedTask,
  readDragBlock,
  readDragTask,
} from "./planner-utils";

export interface PlannerCellProps {
  startsAt: Timestamp;
  label: string;
  onRequestPlace?: (startsAt: Timestamp) => void;
}

export function PlannerCell({ startsAt, label, onRequestPlace }: PlannerCellProps) {
  const os = useOS();
  const { toast } = useToast();
  const [over, setOver] = React.useState(false);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setOver(false);
    const task = readDragTask(event);
    if (task) {
      const result = placeDroppedTask(os, task, startsAt);
      toast(result.message, { tone: result.ok ? "success" : "danger" });
      return;
    }
    const block = readDragBlock(event);
    if (block) {
      const result = moveDroppedBlock(os, block.blockId, startsAt);
      toast(result.message, { tone: result.ok ? "success" : "danger" });
    }
  };

  return (
    <button
      type="button"
      onClick={() => onRequestPlace?.(startsAt)}
      onDragOver={(event) => {
        if (hasPlannerDrag(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDragEnter={(event) => {
        if (hasPlannerDrag(event)) setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false);
      }}
      onDrop={handleDrop}
      onDragEnd={() => setOver(false)}
      aria-label={`Add to plan at ${label}`}
      className="group relative bg-surface transition-colors hover:bg-surface-2"
      style={{ height: HOUR_PX }}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-line" aria-hidden="true" />
      <span
        className={cn(
          "absolute bottom-1 left-1 rounded px-1.5 text-[10px] font-medium text-accent-ink opacity-0 transition-opacity",
          over && "opacity-100",
        )}
      >
        Drop here
      </span>
      <span className="absolute inset-0 hidden items-center justify-center group-hover:flex">
        <Plus className="size-3 text-ink-3" aria-hidden="true" />
      </span>
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 rounded bg-accent transition-opacity",
          over ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />
    </button>
  );
}