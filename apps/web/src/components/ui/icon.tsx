import type { LucideIcon, LucideProps } from "lucide-react";

import { cn } from "@/lib/cn";

export type IconScale = "xs" | "sm" | "md" | "lg" | "xl";

const SCALE_CLASSES: Record<IconScale, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
};

export interface IconProps extends Omit<LucideProps, "size"> {
  icon: LucideIcon;
  scale?: IconScale;
}

export function Icon({ icon: Component, scale = "md", className, ...props }: IconProps) {
  return (
    <Component
      className={cn("shrink-0", SCALE_CLASSES[scale], className)}
      aria-hidden="true"
      {...props}
    />
  );
}