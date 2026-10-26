import * as React from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useDialog } from "@/hooks/use-dialog";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
  className?: string;
  bodyClassName?: string;
  labelledById?: string;
}

const sizeClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose = false,
  className,
  bodyClassName,
  labelledById,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const { mounted, onKeyDown } = useDialog({ open, onDismiss: onClose, panelRef });

  if (!open || !mounted) return null;

  const titleId = labelledById ?? "modal-title";
  const descriptionId = `${titleId}-description`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop animate-sheet-up",
          "sm:max-h-[85dvh] sm:rounded-2xl",
          sizeClasses[size],
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="truncate text-[15px] font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-0.5 text-sm text-ink-3">
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
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", bodyClassName)}>
          {children}
        </div>
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