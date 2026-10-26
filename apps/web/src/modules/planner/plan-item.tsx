"use client";

import * as React from "react";

import {
  formatTime,
  type CalendarEvent,
  type PlanSlotKind,
  type TimeBlock,
  type TimeBlockKind,
  type Timestamp,
} from "@personalos/core";

import { cn } from "@/lib/cn";

import { eventTone } from "@/modules/calendar/event-chip";

import { DRAG_BLOCK, HOUR_PX, slotChip } from "./planner-utils";

function blockChip(kind: TimeBlockKind): string {
  switch (kind) {
    case "focus":
      return slotChip("task");
    case "meeting":
      return slotChip("habit");
    case "routine":
      return slotChip("routine");
    case "buffer":
      return slotChip("buffer");
    case "personal":
      return slotChip("personal");
    default:
      return slotChip("task");
  }
}

export interface PlannerChipProps {
  title: string;
  timeText?: string;
  badge?: string;
  chip: string;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function PlannerChip({
  title,
  timeText,
  badge,
  chip,
  draggable = false,
  onDragStart,
  onClick,
  className,
  style,
  children,
}: PlannerChipProps) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      aria-label={`${title}${badge ? ` (${badge})` : ""}`}
      className={cn(
        "pointer-events-auto absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 shadow-card",
        draggable && "cursor-grab active:cursor-grabbing",
        chip,
        className,
      )}
      style={style}
    >
      <span className="block truncate">{title}</span>
      {(timeText || badge) && (
        <span className="flex items-center gap-1 text-[10px] font-normal opacity-80">
          {timeText && <span className="truncate tabular-nums">{timeText}</span>}
          {badge && (
            <span className="ml-auto shrink-0 rounded bg-black/10 px-1 leading-3.5 dark:bg-white/15">
              {badge}
            </span>
          )}
        </span>
      )}
      {children}
    </button>
  );
}

export interface SlotChipProps {
  title: string;
  kind: PlanSlotKind;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function SlotChip({ title, kind, subtitle, trailing, onClick, className }: SlotChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left",
        slotChip(kind),
        onClick ? "transition-colors hover:brightness-105" : "cursor-default",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{title}</span>
        {subtitle && <span className="mt-0.5 block text-[11px] leading-4 opacity-75">{subtitle}</span>}
      </span>
      {trailing}
    </button>
  );
}

export interface PlannerItemChipProps {
  item: CalendarEvent | TimeBlock;
  hour12: boolean;
  style?: React.CSSProperties;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenBlock: (blockId: string) => void;
  onResizeBlock?: (blockId: string, startsAt: Timestamp, endsAt: Timestamp) => void;
}

const RESIZE_STEP_MIN = 15;

export function PlannerItemChip({
  item,
  hour12,
  style,
  onOpenEvent,
  onOpenBlock,
  onResizeBlock,
}: PlannerItemChipProps) {
  const isEvent = item.type === "event";
  const tone = isEvent ? eventTone(item.color).chip : blockChip(item.kind);
  const badge = !isEvent ? (item.source === "ai" ? "AI" : item.kind === "buffer" ? "Buffer" : "") : "";

  const dragRef = React.useRef<{ edge: "start" | "end"; startY: number; deltaMin: number } | null>(null);
  const suppressClick = React.useRef(false);
  const [resizing, setResizing] = React.useState<{ edge: "start" | "end"; deltaMin: number } | null>(null);

  const durationMin = Math.round((item.endsAt - item.startsAt) / 60_000);

  React.useEffect(() => {
    if (isEvent || !onResizeBlock) return;
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rawMin = ((event.clientY - drag.startY) / HOUR_PX) * 60;
      let deltaMin = Math.round(rawMin / RESIZE_STEP_MIN) * RESIZE_STEP_MIN;
      if (drag.edge === "start") deltaMin = Math.min(deltaMin, durationMin - RESIZE_STEP_MIN);
      else deltaMin = Math.max(deltaMin, RESIZE_STEP_MIN - durationMin);
      drag.deltaMin = deltaMin;
      setResizing({ edge: drag.edge, deltaMin });
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setResizing(null);
      if (!drag || drag.deltaMin === 0) return;
      const startsAt = drag.edge === "start" ? item.startsAt + drag.deltaMin * 60_000 : item.startsAt;
      const endsAt = drag.edge === "end" ? item.endsAt + drag.deltaMin * 60_000 : item.endsAt;
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      onResizeBlock(item.id, startsAt, endsAt);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [durationMin, isEvent, item.endsAt, item.id, item.startsAt, onResizeBlock]);

  const beginResize = (edge: "start" | "end") => (event: React.MouseEvent) => {
    if (isEvent || !onResizeBlock) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { edge, startY: event.clientY, deltaMin: 0 };
    setResizing({ edge, deltaMin: 0 });
  };

  const previewStyle =
    resizing && style
      ? {
          ...style,
          top:
            Number(style.top ?? 0) +
            (resizing.edge === "start" ? (resizing.deltaMin / 60) * HOUR_PX : 0),
          height:
            Number(style.height ?? 0) +
            (resizing.edge === "start"
              ? -(resizing.deltaMin / 60) * HOUR_PX
              : (resizing.deltaMin / 60) * HOUR_PX),
        }
      : style;

  return (
    <PlannerChip
      title={item.title}
      timeText={`${formatTime(item.startsAt, hour12)} – ${formatTime(item.endsAt, hour12)}`}
      badge={badge || undefined}
      chip={tone}
      draggable={!isEvent}
      onClick={() => {
        if (suppressClick.current) return;
        if (isEvent) onOpenEvent(item);
        else onOpenBlock(item.id);
      }}
      onDragStart={
        isEvent
          ? undefined
          : (event) => {
              event.dataTransfer.setData(DRAG_BLOCK, JSON.stringify({ blockId: item.id }));
              event.dataTransfer.effectAllowed = "move";
            }
      }
      style={previewStyle}
    >
      {!isEvent && onResizeBlock ? (
        <>
          <span
            role="presentation"
            data-testid="planner-resize-start"
            onMouseDown={beginResize("start")}
            className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize rounded-t-md bg-black/0 transition-colors hover:bg-black/15 dark:hover:bg-white/20"
          />
          <span
            role="presentation"
            data-testid="planner-resize-end"
            onMouseDown={beginResize("end")}
            className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize rounded-b-md bg-black/0 transition-colors hover:bg-black/15 dark:hover:bg-white/20"
          />
        </>
      ) : null}
    </PlannerChip>
  );
}