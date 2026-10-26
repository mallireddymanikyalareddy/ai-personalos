"use client";

import * as React from "react";

import { SWIPE_ACTIONS, type SwipeAction, type SwipeActionId, type SwipeableEntityType } from "@personalos/core";

import { useHaptics } from "@/hooks/use-haptics";
import { useSwipe, swipeProgress } from "@/hooks/use-swipe";
import { cn } from "@/lib/cn";

const ACTION_TONE: Record<SwipeActionId, string> = {
  complete: "bg-success text-white",
  delete: "bg-danger text-white",
  archive: "bg-ink-2 text-white",
  schedule: "bg-accent text-white",
  postpone: "bg-warning text-white",
  pin: "bg-accent text-white",
  open: "bg-accent text-white",
  capture: "bg-accent text-white",
};

const ACTION_SHORT_LABEL: Record<SwipeActionId, string> = {
  complete: "Done",
  delete: "Delete",
  archive: "Archive",
  schedule: "Schedule",
  postpone: "Later",
  pin: "Pin",
  open: "Open",
  capture: "Capture",
};

export interface SwipeableRowProps {
  entity: SwipeableEntityType;
  leftAction: SwipeActionId;
  rightAction: SwipeActionId;
  enabled: boolean;
  thresholdPx: number;
  onAction: (action: SwipeActionId, direction: "left" | "right") => void;
  onOpen?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function SwipeableRow({
  entity,
  leftAction,
  rightAction,
  enabled,
  thresholdPx,
  onAction,
  onOpen,
  children,
  className,
}: SwipeableRowProps) {
  const haptics = useHaptics();
  const [settling, setSettling] = React.useState(false);

  const { state, handlers, reset } = useSwipe({
    enabled,
    config: { thresholdPx },
    onCommit: (direction) => {
      const action: SwipeAction = direction === "left" ? SWIPE_ACTIONS[leftAction] : SWIPE_ACTIONS[rightAction];
      haptics.trigger(action.destructive ? "destructive" : "commit");
      setSettling(true);
      window.setTimeout(() => setSettling(false), 200);
      onAction(action.id, direction);
      reset();
    },
  });

  const swipedRight = state.dx > 8;
  const swipedLeft = state.dx < -8;
  const progress = swipeProgress(state, thresholdPx);
  const armed = progress >= 1;
  const visibleAction = swipedRight ? SWIPE_ACTIONS[rightAction] : swipedLeft ? SWIPE_ACTIONS[leftAction] : null;

  const handleClick = (event: React.MouseEvent) => {
    if (Math.abs(state.dx) > 12) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onOpen?.();
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)} data-swipe-entity={entity}>
      <div className={cn("absolute inset-0 transition-opacity", visibleAction ? ACTION_TONE[visibleAction.id] : "bg-surface-2")}>
        <div className="flex h-full items-center justify-between px-4">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition-opacity",
              swipedRight ? "bg-black/20 text-white opacity-100" : "opacity-0",
            )}
          >
            {ACTION_SHORT_LABEL[rightAction]}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition-opacity",
              swipedLeft ? "bg-black/20 text-white opacity-100" : "opacity-0",
            )}
          >
            {ACTION_SHORT_LABEL[leftAction]}
          </span>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen?.();
          }
        }}
        {...handlers}
        style={{
          transform: `translateX(${state.dx}px)`,
          transition: settling ? "transform 180ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        className={cn(
          "relative z-10 select-none rounded-xl border border-line bg-surface",
          armed && "opacity-80",
        )}
      >
        {children}
      </div>
    </div>
  );
}
