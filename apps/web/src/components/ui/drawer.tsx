import * as React from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useDialog } from "@/hooks/use-dialog";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "bottom";
  hideClose?: boolean;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "right",
  hideClose = false,
  className,
}: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const { mounted, onKeyDown } = useDialog({ open, onDismiss: onClose, panelRef });

  if (!open || !mounted) return null;

  const isBottom = side === "bottom";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        aria-describedby={description ? "drawer-description" : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex flex-col overflow-hidden border border-line bg-surface shadow-pop",
          isBottom
            ? "max-h-[85dvh] w-full rounded-t-2xl animate-drawer-in-bottom"
            : "h-dvh w-full max-w-md border-y-0 border-r-0 animate-drawer-in sm:max-w-md",
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id="drawer-title" className="truncate text-[15px] font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id="drawer-description" className="mt-0.5 text-sm text-ink-3">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface-2/60 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}