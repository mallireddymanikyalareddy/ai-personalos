import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max,
  className,
  tone = "accent",
}: {
  value: number;
  max: number;
  className?: string;
  tone?: "accent" | "success";
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${value} of ${max} done`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          tone === "success" ? "bg-success" : "bg-accent",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
