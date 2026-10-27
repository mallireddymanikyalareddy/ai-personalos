"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export type PopoverSide = "bottom" | "top" | "right";
export type PopoverAlign = "start" | "end";

export interface PopoverProps {
  open: boolean;
  anchor: HTMLElement | null;
  onClose?: () => void;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  side?: PopoverSide;
  align?: PopoverAlign;
  gap?: number;
  matchWidth?: boolean;
  children: React.ReactNode;
  id?: string;
  role?: string;
  className?: string;
}

export function Popover({
  open,
  anchor,
  onClose,
  panelRef,
  side = "bottom",
  align = "start",
  gap = 6,
  matchWidth = false,
  children,
  id,
  role,
  className,
}: PopoverProps) {
  const internalRef = React.useRef<HTMLDivElement>(null);
  const ref = panelRef ?? internalRef;
  const [rect, setRect] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    if (!open || !anchor) return;
    const panel = ref.current;
    if (!panel) return;
    let raf = 0;
    const compute = () => {
      const a = anchor.getBoundingClientRect();
      const p = { width: panel.offsetWidth, height: panel.offsetHeight };
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 8;
      let left: number;
      let top: number;
      if (side === "right") {
        left = a.right + gap;
        top = a.top;
        if (left + p.width > vw - margin) left = a.left - p.width - gap;
      } else {
        left = align === "end" ? a.right - p.width : a.left;
        if (matchWidth) left = a.left;
        top = side === "bottom" ? a.bottom + gap : a.top - p.height - gap;
        if (side === "bottom" && top + p.height > vh - margin)
          top = a.top - p.height - gap;
        if (side === "top" && top < margin) top = a.bottom + gap;
      }
      left = Math.max(margin, Math.min(left, vw - p.width - margin));
      top = Math.max(margin, Math.min(top, vh - p.height - margin));
      setRect({ top, left, width: matchWidth ? a.width : p.width });
    };
    compute();
    raf = requestAnimationFrame(compute);
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) return;
      // Only scrolling that moves the anchor (the page or one of its ancestors) should dismiss.
      if (!(
        target === document ||
        (target instanceof Node && target.contains(anchor))
      ))
        return;
      onClose?.();
    };
    const onResize = () => compute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, anchor, side, align, gap, matchWidth, onClose, ref]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={ref}
      id={id}
      role={role}
      style={{
        position: "fixed",
        top: rect?.top ?? -10000,
        left: rect?.left ?? -10000,
        width: matchWidth ? rect?.width : undefined,
      }}
      className={cn("z-40 animate-scale-in", className)}
    >
      {children}
    </div>,
    document.body,
  );
}

export function useOutsideDismiss(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean,
) {
  React.useEffect(() => {
    if (!active) return;
    const onPointer = (event: PointerEvent) => {
      const panel = ref.current;
      if (!panel) return;
      const target = event.target as Node | null;
      if (!target || panel.contains(target)) return;
      if (!target.isConnected) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, onClose, ref]);
}
