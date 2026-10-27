"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

export function DemoNotice() {
  return (
    <div
      role="note"
      data-testid="admin-demo-notice"
      className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      DEMONSTRATION DATA — this screen is not connected to live data yet (Stage 2 preview). Numbers below are samples.
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 data-testid="admin-page-title" className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>
      </div>
      {actions}
    </header>
  );
}

export function Stat({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

const TONES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  succeeded: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  trial: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  trialing: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  draft: "bg-surface-2 text-ink-2",
  past_due: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  reconciliation_required: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
  denied: "bg-red-500/10 text-red-700 dark:text-red-300",
  suspended: "bg-red-500/10 text-red-700 dark:text-red-300",
  canceled: "bg-surface-2 text-ink-3",
  refunded: "bg-surface-2 text-ink-3",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", TONES[value] ?? "bg-surface-2 text-ink-2")}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  align?: "right";
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  testId,
  search,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  testId: string;
  search?: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  const [query, setQuery] = React.useState("");
  const visible = search && query ? rows.filter((row) => search(row).toLowerCase().includes(query.toLowerCase())) : rows;
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      {search && (
        <div className="border-b border-line p-3">
          <input
            data-testid={`${testId}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="h-9 w-full max-w-xs rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table data-testid={testId} className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-3">
              {columns.map((col) => (
                <th key={col.key} className={cn("px-4 py-2.5 font-semibold", col.align === "right" && "text-right")}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                data-testid={`${testId}-row-${row.id}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(row)) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn("border-b border-line/60 last:border-0 hover:bg-surface-2/60", onRowClick && "cursor-pointer focus:bg-surface-2 focus:outline-none")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-2.5 text-ink-2", col.align === "right" && "text-right tabular-nums")}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-ink-3">
                  No matching records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
