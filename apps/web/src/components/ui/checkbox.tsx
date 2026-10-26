import * as React from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  size?: "md" | "sm";
  className?: string;
}

export function Checkbox({ checked, onChange, label, size = "md", className }: CheckboxProps) {
  const dims = size === "md" ? "size-5" : "size-4";
  const iconSize = size === "md" ? "size-3" : "size-2.5";

  return (
    <label className={cn("group relative inline-flex cursor-pointer items-center", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        className={cn(
          "grid place-items-center rounded-full border-[1.5px] border-line-strong bg-surface transition-all duration-150",
          dims,
          "peer-hover:border-ink-3 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          checked && "border-accent bg-accent",
        )}
      >
        <Check
          className={cn(
            "text-white transition-all duration-150",
            iconSize,
            checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
    </label>
  );
}
