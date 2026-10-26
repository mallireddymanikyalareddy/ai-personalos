import * as React from "react";

import { cn } from "@/lib/cn";

export type TimelineTone = "accent" | "success" | "danger" | "warning" | "info" | "muted";

const TONES: Record<TimelineTone, string> = {
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  muted: "bg-surface-2 text-ink-3",
};

export interface TimelineItemData {
  title: React.ReactNode;
  description?: React.ReactNode;
  time?: React.ReactNode;
  tone?: TimelineTone;
  icon?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItemData[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={index} className="relative flex gap-3 pb-5 last:pb-0">
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full",
                  TONES[item.tone ?? "muted"],
                )}
              >
                {item.icon ? (
                  <span className="grid place-items-center">{item.icon}</span>
                ) : (
                  <span className="size-2 rounded-full bg-current" />
                )}
              </div>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-8 w-px -translate-x-1/2 bg-line"
                  style={{ bottom: "-1.25rem" }}
                />
              )}
            </div>
            <div className="min-w-0 pt-1">
              <div className="flex items-baseline gap-2">
                <div className="min-w-0 text-sm font-medium text-ink">{item.title}</div>
                {item.time && (
                  <time className="shrink-0 text-xs text-ink-3">{item.time}</time>
                )}
              </div>
              {item.description && (
                <div className="mt-0.5 text-sm leading-relaxed text-ink-3">
                  {item.description}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}