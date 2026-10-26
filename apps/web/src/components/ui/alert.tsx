"use client";

import * as React from "react";

import { Sparkles, Info, CircleCheck, TriangleAlert, CircleAlert, X } from "lucide-react";

import { cn } from "@/lib/cn";

export type AlertTone = "accent" | "info" | "success" | "warning" | "danger";

const TONES: Record<AlertTone, { wrap: string; text: string }> = {
  accent: { wrap: "border-accent/25 bg-accent-soft", text: "text-accent-ink" },
  info: { wrap: "border-info/25 bg-info-soft", text: "text-info" },
  success: { wrap: "border-success/25 bg-success-soft", text: "text-success" },
  warning: { wrap: "border-warning/25 bg-warning-soft", text: "text-warning" },
  danger: { wrap: "border-danger/25 bg-danger-soft", text: "text-danger" },
};

const ICONS: Record<AlertTone, typeof Info> = {
  accent: Sparkles,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({
  tone = "info",
  title,
  children,
  action,
  dismissible = false,
  onDismiss,
  className,
}: AlertProps) {
  const { wrap, text } = TONES[tone];
  const Icon = ICONS[tone];
  const isCritical = tone === "danger" || tone === "warning";
  return (
    <div
      role={isCritical ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3", wrap, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", text)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-ink">{title}</p>}
        {children && (
          <div className="mt-0.5 text-sm leading-relaxed text-ink-2">{children}</div>
        )}
        {action && <div className="mt-2.5 flex items-center gap-2">{action}</div>}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}