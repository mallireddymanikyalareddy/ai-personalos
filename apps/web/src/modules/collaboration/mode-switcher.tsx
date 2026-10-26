"use client";

import { Briefcase, User } from "lucide-react";

import type { Mode } from "@personalos/core";

import { useToast } from "@/components/ui/toast";
import { useOS, useAppState } from "@/store/use-os";
import { cn } from "@/lib/cn";

const MODES: Array<{ value: Mode; label: string; icon: typeof User; hint: string; home: string }> = [
  { value: "personal", label: "Personal", icon: User, hint: "Only you", home: "/today" },
  { value: "work", label: "Work", icon: Briefcase, hint: "Your team", home: "/workmode" },
];

export const modeNavigation = {
  go(url: string): void {
    window.location.assign(url);
  },
};

export function ModeSwitcher({ className }: { className?: string }) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const active = state.settings.activeMode;

  const switchMode = (mode: (typeof MODES)[number]) => {
    const changed = os.activeMode() !== mode.value;
    os.setActiveMode(mode.value);
    if (changed) toast(`${mode.label} mode`);

    const path = typeof window === "undefined" ? "" : window.location.pathname;
    const onHome =
      mode.value === "work"
        ? path === "/workmode" || path.startsWith("/workmode/")
        : path === "/today" || path.startsWith("/today/");
    if (!onHome) modeNavigation.go(mode.home);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Mode"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = active === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={`${mode.label} — ${mode.hint}. Opens ${mode.home}`}
            aria-label={`${mode.label} mode`}
            onClick={() => switchMode(mode)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-surface text-ink shadow-card"
                : "text-ink-3 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
