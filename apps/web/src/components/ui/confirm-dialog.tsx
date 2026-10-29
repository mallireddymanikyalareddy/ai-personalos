import * as React from "react";

import { TriangleAlert, Info } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "accent";
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  const isDanger = tone === "danger";
  const Icon = isDanger ? TriangleAlert : Info;

  return (
    <Modal open={open} onClose={onClose} hideClose size="sm" className="sm:max-w-md">
      <div className="flex gap-3.5 sm:items-start">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            isDanger ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-ink",
          )}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-ink-3">{description}</p>
          )}
          {children}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button
          type="button"
          variant="ghost"
          autoFocus
          data-autofocus
          disabled={busy}
          onClick={onClose}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={isDanger ? "danger" : "primary"}
          disabled={busy || confirmDisabled}
          onClick={() => {
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}