import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-soft-pulse rounded-lg bg-surface-3", className)}
    />
  );
}
