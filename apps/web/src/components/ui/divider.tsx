import * as React from "react";

import { cn } from "@/lib/cn";

export function Divider({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn("h-px w-full bg-line", className)}
    />
  );
}

export function DividerLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="separator" className={cn("flex items-center gap-3", className)}>
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
        {children}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}