import * as React from "react";

import { cn } from "@/lib/cn";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
}

export function Chip({ active = false, className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium",
        active ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-2",
        className,
      )}
      {...props}
    />
  );
}