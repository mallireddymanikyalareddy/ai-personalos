"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  ArrowRightLeft,
  FileText,
  ListChecks,
  MessageSquareText,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react";

import type { PaperPageRow } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import { PAPER_QUICK_CAPTURE_KINDS, paperKindMeta, relativeTime } from "./paper-meta";

const ASSISTANT_ACTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "summarize", label: "Summarize this page", icon: Sparkles },
  { id: "improve", label: "Edit or improve", icon: PenLine },
  { id: "actions", label: "Create action items", icon: ListChecks },
  { id: "translate", label: "Translate", icon: ArrowRightLeft },
  { id: "explain", label: "Explain this document", icon: MessageSquareText },
  { id: "tasks", label: "Turn into tasks", icon: Wand2 },
];

export function PaperAssistant({
  pageName,
  pageText,
  answer,
  onRun,
}: {
  pageName: string | null;
  pageText: string;
  answer: string | null;
  onRun: (id: string) => void;
}) {
  return (
    <section
      aria-label="AI Paper Assistant"
      data-testid="paper-assistant"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI Paper Assistant
        </h2>
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3">GPT-5</span>
      </header>

      <p className="rounded-xl bg-surface-2/70 p-2.5 text-[12px] leading-snug text-ink-3">
        {pageName != null
          ? `Ask about "${pageName}", summarize, or create a new page…`
          : "Ask about your documents, summarize, or create a new page…"}
      </p>

      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 2xl:grid-cols-1">
        {ASSISTANT_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              data-testid={`paper-assistant-${action.id}`}
              onClick={() => onRun(action.id)}
              disabled={pageName == null}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="min-w-0 truncate text-[11px] font-medium text-ink-2">{action.label}</span>
            </button>
          );
        })}
      </div>

      {answer != null ? (
        <p
          data-testid="paper-assistant-answer"
          className="mt-2 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
        >
          {answer}
        </p>
      ) : null}

      {pageText.trim().length > 0 ? (
        <p className="mt-2 text-[10px] text-ink-3">{pageText.trim().split(/\s+/).length} words on this page</p>
      ) : null}
    </section>
  );
}

export function RecentPages({
  rows,
  now,
  onOpen,
}: {
  rows: PaperPageRow[];
  now: number;
  onOpen: (id: string) => void;
}) {
  return (
    <section
      aria-label="Recent Pages"
      data-testid="paper-recent"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <FileText className="size-4 text-accent-ink" aria-hidden="true" />
          Recent Pages
        </h2>
        <a href="/paper" className="text-[11px] font-medium text-accent-ink hover:underline">
          View all
        </a>
      </header>

      {rows.length === 0 ? (
        <p className="text-[12px] text-ink-3">No pages yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => {
            const kind = paperKindMeta(row.kind);
            const KindIcon = kind.icon;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  data-testid="paper-recent-row"
                  onClick={() => onOpen(row.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${kind.tone}`} aria-hidden="true">
                    <KindIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">{row.name}</span>
                    <span className="block text-[10px] text-ink-3">{relativeTime(row.updatedAt, now)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function QuickCapture({
  text,
  onChange,
  onCapture,
  lastKind,
}: {
  text: string;
  onChange: (value: string) => void;
  onCapture: (kind: string) => void;
  lastKind: string | null;
}) {
  return (
    <section
      aria-label="Quick Capture"
      data-testid="paper-quick-capture"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center gap-1.5">
        <ZapIcon />
        <h2 className="text-sm font-semibold text-ink">Quick Capture</h2>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCapture("text");
        }}
      >
        <input
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write a quick note…"
          aria-label="Quick capture"
          className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
        />
      </form>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {PAPER_QUICK_CAPTURE_KINDS.map((kind) => {
          const Icon = kind.icon;
          return (
            <button
              key={kind.id}
              type="button"
              data-testid={`paper-capture-${kind.id}`}
              onClick={() => onCapture(kind.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-colors",
                lastKind === kind.id
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:bg-surface-3",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {kind.label}
            </button>
          );
        })}
      </div>

      {lastKind != null ? (
        <Badge tone="success" className="mt-2">
          Captured as {lastKind}
        </Badge>
      ) : null}
    </section>
  );
}

function ZapIcon() {
  return <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />;
}
