import type * as React from "react";

import { cn } from "@/lib/cn";

export function Section({
  title,
  count,
  tone = "default",
  action,
  children,
  className,
}: {
  title: string;
  count?: number;
  tone?: "default" | "danger" | "accent" | "muted";
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClasses = {
    default: "text-ink-3",
    danger: "text-danger",
    accent: "text-accent-ink",
    muted: "text-ink-3",
  };

  return (
    <section className={cn("mt-7 first:mt-0", className)}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3 px-1">
        <h2
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            toneClasses[tone],
          )}
        >
          {title}
          {count != null && (
            <span className="tnum ml-1.5 font-medium normal-case tracking-normal opacity-70">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
