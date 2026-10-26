import * as React from "react";

import { cn } from "@/lib/cn";

export type ProgressTone = "accent" | "success" | "danger" | "warning" | "muted";

const TONES: Record<ProgressTone, string> = {
  accent: "stroke-accent",
  success: "stroke-success",
  danger: "stroke-danger",
  warning: "stroke-warning",
  muted: "stroke-ink-3",
};

export interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: ProgressTone;
  className?: string;
  label?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 40,
  stroke = 4,
  tone = "accent",
  className,
  label,
}: CircularProgressProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(value, max));
  const ratio = max === 0 ? 0 : clamped / max;
  const dashOffset = circumference * (1 - ratio);
  const percent = Math.round(ratio * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={label}
      aria-label={label}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(TONES[tone], "transition-[stroke-dashoffset] duration-300 ease-out")}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums text-ink">
        {percent}
      </span>
    </div>
  );
}