import * as React from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "danger" | "warning" | "outline";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-3",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  outline: "border border-line text-ink-3",
};

export interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-4",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
