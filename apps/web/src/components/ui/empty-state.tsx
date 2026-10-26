import * as React from "react";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <Icon className="size-5" aria-hidden="true" strokeWidth={1.75} />
        </div>
      )}
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
