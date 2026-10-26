"use client";

import * as React from "react";

import type { SwipeConfig, SwipeDecision } from "@personalos/core";
import { DEFAULT_SWIPE_CONFIG, decideSwipe } from "@personalos/core";

export interface SwipeHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
}

export interface SwipeState {
  dx: number;
  dy: number;
  decision: SwipeDecision;
  dragging: boolean;
}

export interface UseSwipeOptions {
  enabled: boolean;
  config?: Partial<SwipeConfig>;
  onCommit: (direction: "left" | "right") => void;
  onPending?: (decision: SwipeDecision) => void;
  axis?: "x" | "both";
}

const IDLE: SwipeState = { dx: 0, dy: 0, decision: "none", dragging: false };

export function useSwipe(options: UseSwipeOptions): {
  state: SwipeState;
  handlers: SwipeHandlers;
  reset: () => void;
} {
  const config = React.useMemo<SwipeConfig>(
    () => ({ ...DEFAULT_SWIPE_CONFIG, ...(options.config ?? {}) }),
    [options.config],
  );
  const startRef = React.useRef<{ x: number; y: number; at: number } | null>(null);
  const [state, setState] = React.useState<SwipeState>(IDLE);
  const committedRef = React.useRef(false);

  const reset = React.useCallback(() => {
    startRef.current = null;
    committedRef.current = false;
    setState(IDLE);
  }, []);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      if (!options.enabled) return;
      if (event.pointerType === "mouse" && event.buttons !== 1) return;
      startRef.current = { x: event.clientX, y: event.clientY, at: Date.now() };
      committedRef.current = false;
    },
    [options.enabled],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const durationMs = Math.max(1, Date.now() - start.at);
      const decision = decideSwipe({ dx, dy, durationMs }, config);

      if (decision === "none" && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        setState({ dx: 0, dy: 0, decision: "none", dragging: false });
        return;
      }

      setState({ dx, dy, decision, dragging: decision.startsWith("pending") });

      if (decision === "commit-left" || decision === "commit-right") {
        if (!committedRef.current) {
          committedRef.current = true;
          options.onCommit(decision === "commit-left" ? "left" : "right");
        }
        return;
      }

      if (decision !== "none") {
        options.onPending?.(decision);
      }
    },
    [config, options],
  );

  const onPointerUp = React.useCallback(() => {
    reset();
  }, [reset]);

  const onPointerCancel = React.useCallback(() => {
    reset();
  }, [reset]);

  return { state, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }, reset };
}

export function swipeOffsetFor(state: SwipeState, max = 96): number {
  const clamped = Math.max(-max, Math.min(max, state.dx));
  return clamped;
}

export function swipeProgress(state: SwipeState, threshold = 72): number {
  return Math.min(1, Math.abs(state.dx) / threshold);
}
