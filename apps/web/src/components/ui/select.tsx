import * as React from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  selectClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, selectClassName, children, ...props },
  ref,
) {
  return (
    <span className={cn("relative inline-flex w-full items-center", className)}>
      <select
        ref={ref}
        className={cn(
          "h-9 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface py-0 pl-3 pr-8 text-sm text-ink transition-colors hover:border-line-strong",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50",
          selectClassName,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 size-3.5 text-ink-3"
        aria-hidden="true"
      />
    </span>
  );
});
