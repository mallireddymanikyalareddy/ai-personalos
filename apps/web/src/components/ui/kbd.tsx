import { cn } from "@/lib/cn";

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1.5 font-sans text-[11px] font-medium text-ink-3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
