"use client";

import type { ID } from "@personalos/core";

import { cn } from "@/lib/cn";
import { useAppState } from "@/store/use-os";

export function LifeAreaChip({ lifeAreaId, className }: { lifeAreaId: ID | null | undefined; className?: string }) {
  const state = useAppState();
  const area = lifeAreaId ? state.lifeAreas[lifeAreaId] : null;
  if (!area) return null;
  return (
    <span
      data-testid={`life-area-chip-${area.name.toLowerCase()}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-2",
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: area.color ?? "var(--ink-3)" }} aria-hidden="true" />
      {area.name}
    </span>
  );
}

export function LifeAreaSelect({
  id,
  value,
  onChange,
  testId,
}: {
  id: string;
  value: ID | null;
  onChange: (value: ID | null) => void;
  testId: string;
}) {
  const state = useAppState();
  const areas = Object.values(state.lifeAreas)
    .filter((area) => area.status === "active" || area.id === value)
    .sort((a, b) => a.order - b.order);
  return (
    <select
      id={id}
      data-testid={testId}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
    >
      <option value="">No life area</option>
      {areas.map((area) => (
        <option key={area.id} value={area.id}>
          {area.name}
        </option>
      ))}
    </select>
  );
}

export function LifeAreaFilter({ value, onChange }: { value: ID | "all"; onChange: (value: ID | "all") => void }) {
  const state = useAppState();
  const areas = Object.values(state.lifeAreas)
    .filter((area) => area.status === "active")
    .sort((a, b) => a.order - b.order);
  if (areas.length === 0) return null;
  const pill = (active: boolean) =>
    cn(
      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
      active ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
    );
  return (
    <div role="group" aria-label="Filter by life area" className="flex flex-wrap items-center gap-1.5" data-testid="life-area-filter">
      <button type="button" className={pill(value === "all")} aria-pressed={value === "all"} data-testid="life-area-filter-all" onClick={() => onChange("all")}>
        All areas
      </button>
      {areas.map((area) => (
        <button
          key={area.id}
          type="button"
          className={pill(value === area.id)}
          aria-pressed={value === area.id}
          data-testid={`life-area-filter-${area.name.toLowerCase()}`}
          onClick={() => onChange(value === area.id ? "all" : area.id)}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: area.color ?? "var(--ink-3)" }} aria-hidden="true" />
          {area.name}
        </button>
      ))}
    </div>
  );
}
