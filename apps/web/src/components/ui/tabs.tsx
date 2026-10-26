"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: "underline" | "pill";
  a11yLabel?: string;
  className?: string;
}

export function Tabs({
  tabs,
  value,
  onChange,
  variant = "underline",
  a11yLabel,
  className,
}: TabsProps) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value && !tab.disabled),
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    let next = activeIndex;
    for (
      let step = event.key === "ArrowRight" ? 1 : -1;
      next >= 0 && next < tabs.length;
      next += step
    ) {
      if (!tabs[next]?.disabled && next !== activeIndex) break;
    }
    const target = tabs[next];
    if (target) {
      onChange(target.value);
      (document.getElementById(`${a11yLabel ?? "tabs"}-${target.value}`) as HTMLElement | null)?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={a11yLabel}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        variant === "underline" ? "flex gap-1 border-b border-line" : "inline-flex gap-1 rounded-xl bg-surface-2 p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        const tabIndex = tab.disabled ? -1 : selected ? 0 : -1;
        return (
          <button
            key={tab.value}
            id={`${a11yLabel ?? "tabs"}-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={tabIndex}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-100",
              variant === "underline"
                ? cn(
                    "border-b-2 px-2.5 pb-2 pt-1.5 outline-offset-[-2px]",
                    selected
                      ? "border-accent text-ink"
                      : "border-transparent text-ink-3 hover:text-ink",
                  )
                : cn(
                    "h-8 rounded-lg px-3",
                    selected
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-3 hover:text-ink",
                  ),
              tab.disabled && "pointer-events-none opacity-50",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}