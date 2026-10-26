import { cn } from "@/lib/cn";

import { Logo } from "./logo";

export function BrandMark({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const icon = size === "lg" ? "size-11" : size === "md" ? "size-8" : "size-7";
  const text = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base";
  return (
    <span data-testid="brand-mark" className={cn("inline-flex items-center gap-2", className)}>
      <Logo className={icon} />
      <span className={cn("font-semibold tracking-tight text-ink", text)}>PersonalOS</span>
    </span>
  );
}
