"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export interface TooltipProps {
  label: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ label, children, side = "top", delay = 400 }: TooltipProps) {
  const generatedId = React.useId();
  const tooltipId = `tooltip-${generatedId.replace(/[:]/g, "")}`;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const showTimer = React.useRef(0);
  const hideTimer = React.useRef(0);

  const show = React.useCallback(() => {
    window.clearTimeout(hideTimer.current);
    showTimer.current = window.setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = React.useCallback(() => {
    window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => setOpen(false), 80);
  }, []);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) {
      setPos(null);
      return;
    }
    const trigger = triggerRef.current.getBoundingClientRect();
    const panel = panelRef.current.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    let top = 0;
    let left = 0;
    if (side === "top") {
      top = trigger.top - panel.height - gap;
      left = trigger.left + trigger.width / 2 - panel.width / 2;
    } else if (side === "bottom") {
      top = trigger.bottom + gap;
      left = trigger.left + trigger.width / 2 - panel.width / 2;
    } else if (side === "left") {
      top = trigger.top + trigger.height / 2 - panel.height / 2;
      left = trigger.left - panel.width - gap;
    } else {
      top = trigger.top + trigger.height / 2 - panel.height / 2;
      left = trigger.right + gap;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - panel.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - panel.height - margin));
    setPos({ top, left });
  }, [open, side]);

  type TriggerProps = React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> };
  const triggerElement = children as React.ReactElement<TriggerProps>;

  const triggerNode = React.cloneElement(triggerElement, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
    },
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      triggerElement.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      triggerElement.props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      triggerElement.props.onFocus?.(event);
      show();
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      triggerElement.props.onBlur?.(event);
      hide();
    },
    "aria-describedby": open ? tooltipId : triggerElement.props["aria-describedby"],
  });

  React.useEffect(
    () => () => {
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
    },
    [],
  );

  if (!open) return <>{triggerNode}</>;

  return (
    <>
      {triggerNode}
      {createPortal(
        <div
          ref={panelRef}
          id={tooltipId}
          role="tooltip"
          style={{
            position: "fixed",
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? "visible" : "hidden",
            opacity: pos ? 1 : 0,
          }}
          className={cn(
            "pointer-events-none z-50 max-w-60 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-pop",
            "transition-opacity duration-100",
          )}
        >
          {label}
        </div>,
        document.body,
      )}
    </>
  );
}