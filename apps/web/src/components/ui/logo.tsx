import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      aria-hidden="true"
      fill="none"
    >
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <rect x="8" y="9.5" width="16" height="3.2" rx="1.6" fill="white" />
      <rect x="8" y="14.6" width="11" height="3.2" rx="1.6" fill="white" fillOpacity="0.82" />
      <rect x="8" y="19.7" width="6" height="3.2" rx="1.6" fill="white" fillOpacity="0.64" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo />
      <span className="text-sm font-semibold tracking-tight text-ink">PersonalOS</span>
    </span>
  );
}
