import type { Goal } from "@personalos/core";

import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";

const HORIZON_LABELS: Record<Goal["horizon"], string> = {
  life: "Life",
  year: "Yearly",
  quarter: "Quarterly",
  month: "Monthly",
  week: "Weekly",
};

export interface GoalCardProps {
  goal: Goal;
  onOpen?: () => void;
  className?: string;
}

export function GoalCard({ goal, onOpen, className }: GoalCardProps) {
  const percent = Math.max(0, Math.min(100, Math.round(goal.progress)));
  const badgeTone =
    goal.status === "completed"
      ? "success"
      : goal.status === "active"
        ? "accent"
        : "neutral";

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left pr-2"
          aria-label={`Open goal ${goal.title}`}
        >
          <span className="block truncate text-sm font-semibold tracking-tight text-ink">
            {goal.title}
          </span>
        </button>
        <Badge tone={badgeTone} className="shrink-0">
          {HORIZON_LABELS[goal.horizon]}
        </Badge>
      </div>

      {goal.description && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-3">
          {goal.description}
        </p>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-3">
            {goal.metrics.length > 0
              ? goal.metrics
                  .map((metric) => `${metric.label}: ${metric.current} / ${metric.target} ${metric.unit}`)
                  .join(" · ")
              : "Progress"}
          </span>
          <span className="font-semibold tabular-nums text-ink">{percent}%</span>
        </div>
        <ProgressBar
          value={goal.progress}
          max={100}
          tone={goal.status === "completed" ? "success" : "accent"}
          className="h-1.5"
        />
      </div>
    </div>
  );
}