"use client";

import * as React from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseDialogOptions {
  open: boolean;
  onDismiss: () => void;
  panelRef: React.RefObject<HTMLElement | null>;
}

export function useDialog({ open, onDismiss, panelRef }: UseDialogOptions) {
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const autofocus = panel.querySelector<HTMLElement>("[data-autofocus]");
      const focusable = autofocus ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      focusable.focus();
    }, 30);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = overflow;
      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open, onDismiss, panelRef]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onDismiss, panelRef],
  );

  return { mounted, onKeyDown };
}