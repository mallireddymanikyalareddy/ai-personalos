"use client";

import * as React from "react";

import { CheckCircle2, Copy, ListChecks, Sparkles } from "lucide-react";

import type { ActionItem, MeetingReport } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function copyText(text: string, label: string) {
  if (typeof navigator !== "undefined" && "clipboard" in navigator) {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }
  return label;
}

export function MeetingRail({
  report,
  actionItems,
  onToggleActionItem,
  onConvertActionItem,
}: {
  report: MeetingReport | null;
  actionItems: ActionItem[];
  onToggleActionItem: (item: ActionItem) => void;
  onConvertActionItem: (item: ActionItem) => void;
}) {
  const [copied, setCopied] = React.useState<string | null>(null);

  const summary = report?.summary ?? "";
  const takeaways = report?.keyPoints ?? [];

  const copy = (value: string, key: string) => {
    copyText(value, key);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <aside className="min-w-0 space-y-4" aria-label="Meeting insights">
      <section
        aria-label="AI Meeting Summary"
        data-testid="meeting-ai-summary"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
            AI Meeting Summary
          </h2>
          <button
            type="button"
            onClick={() => copy(summary, "summary")}
            disabled={summary.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <Copy className="size-3" aria-hidden="true" />
            {copied === "summary" ? "Copied" : "Copy"}
          </button>
        </header>
        {summary.length === 0 ? (
          <p className="rounded-xl bg-surface-2/70 p-3 text-[12px] leading-relaxed text-ink-3">
            Summarise the transcript to get an AI summary of this meeting.
          </p>
        ) : (
          <p className="rounded-xl bg-accent-soft/60 p-3 text-[12px] leading-relaxed text-ink-2">
            {summary}
          </p>
        )}
      </section>

      <section
        aria-label="Key Takeaways"
        data-testid="meeting-takeaways"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Key Takeaways</h2>
          <button
            type="button"
            onClick={() => copy(takeaways.join("\n"), "takeaways")}
            disabled={takeaways.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <Copy className="size-3" aria-hidden="true" />
            {copied === "takeaways" ? "Copied" : "Copy"}
          </button>
        </header>
        {takeaways.length === 0 ? (
          <p className="text-[12px] text-ink-3">No takeaways yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {takeaways.map((point) => (
              <li key={point} className="flex items-start gap-2 text-[12px] leading-snug text-ink-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Action Items"
        data-testid="meeting-action-rail"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ListChecks className="size-4 text-accent-ink" aria-hidden="true" />
            Action Items ({actionItems.length})
          </h2>
          <a href="/tasks" className="text-[11px] font-medium text-accent-ink hover:underline">
            View all
          </a>
        </header>
        {actionItems.length === 0 ? (
          <p className="text-[12px] text-ink-3">No action items yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {actionItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2" data-testid="meeting-rail-action">
                <button
                  type="button"
                  onClick={() => onToggleActionItem(item)}
                  aria-label={`Toggle ${item.title}`}
                  aria-pressed={item.status === "done"}
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    item.status === "done" ? "border-success bg-success text-white" : "border-line-strong",
                  )}
                >
                  {item.status === "done" ? <CheckCircle2 className="size-3" aria-hidden="true" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => onConvertActionItem(item)}
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-[12px]",
                    item.status === "done" ? "text-ink-3 line-through" : "text-ink-2 hover:text-accent-ink hover:underline",
                  )}
                >
                  {item.title}
                </button>
                {item.assigneeId != null ? (
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[9px] font-bold text-accent-ink"
                    aria-label={`Assignee ${item.assigneeId}`}
                  >
                    {initials(item.assigneeId)}
                  </span>
                ) : null}
                {item.dueAt != null ? (
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
                    {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
                      new Date(item.dueAt),
                    )}
                  </span>
                ) : null}
                {item.taskId == null ? <Badge tone="outline">New</Badge> : <Badge tone="success">Task</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}