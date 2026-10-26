import type * as React from "react";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export function PageHeader({
  icon: Icon,
  tone = "bg-accent-soft text-accent-ink",
  title,
  subtitle,
  actions,
  className,
  testId,
}: {
  icon?: LucideIcon;
  tone?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <header
      data-testid={testId}
      className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", tone)}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle ? <div className="mt-0.5 max-w-2xl text-sm text-ink-3">{subtitle}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
