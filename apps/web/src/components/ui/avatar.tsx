import { cn } from "@/lib/cn";

export function Avatar({ name, className }: { name?: string; className?: string }) {
  const initials = (name ?? "You")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink",
        className,
      )}
    >
      {initials || "Y"}
    </span>
  );
}
