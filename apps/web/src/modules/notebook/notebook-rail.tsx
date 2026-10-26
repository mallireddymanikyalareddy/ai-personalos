"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  AlignLeft,
  Bold,
  Clock,
  Italic,
  List,
  MessageSquare,
  PenLine,
  Send,
  Sparkles,
  SquareCheck,
  Strikethrough,
  Wand2,
} from "lucide-react";

import { aiProvider, type ID, type NotebookNoteRow } from "@personalos/core";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAppState } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { NOTEBOOK_QUICK_CAPTURE_KINDS, notebookNoteIcon, relativeTime } from "./notebook-meta";

const ASSISTANT_ACTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "summarize", label: "Summarize this note", icon: AlignLeft },
  { id: "actions", label: "Create action items", icon: SquareCheck },
  { id: "improve", label: "Improve writing", icon: PenLine },
  { id: "translate", label: "Translate", icon: MessageSquare },
  { id: "ideas", label: "Expand with ideas", icon: Wand2 },
  { id: "tasks", label: "Convert to task", icon: List },
];

export function NotebookRail({
  rows,
  now,
  quickText,
  quickKind,
  answer,
  onQuickTextChange,
  onCapture,
  onOpenNote,
  onRun,
}: {
  rows: NotebookNoteRow[];
  now: number;
  quickText: string;
  quickKind: string | null;
  answer: string | null;
  onQuickTextChange: (value: string) => void;
  onCapture: (kind: string) => void;
  onOpenNote: (id: ID) => void;
  onRun: (id: string) => void;
}) {
  const state = useAppState();
  const providerLabel = aiProvider(state.settings.aiProvider).label;
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = (label: string) => {
    const node = textareaRef.current;
    const start = node?.selectionStart ?? quickText.length;
    const end = node?.selectionEnd ?? start;
    const selected = quickText.slice(start, end);
    const before = quickText.slice(0, start);
    const after = quickText.slice(end);
    let next = quickText;
    let cursor = start;

    switch (label) {
      case "Bold":
        next = `${before}**${selected || "bold text"}**${after}`;
        cursor = start + 2 + (selected || "bold text").length + 2;
        break;
      case "Italic":
        next = `${before}_${selected || "italic text"}_${after}`;
        cursor = start + 1 + (selected || "italic text").length + 1;
        break;
      case "Strikethrough":
        next = `${before}~~${selected || "text"}~~${after}`;
        cursor = start + 2 + (selected || "text").length + 2;
        break;
      case "List":
        next = `${before}${before.endsWith("\n") || before.length === 0 ? "" : "\n"}- ${selected || "List item"}${after}`;
        cursor = next.length;
        break;
      case "Checklist":
        next = `${before}${before.endsWith("\n") || before.length === 0 ? "" : "\n"}- [ ] ${selected || "Checklist item"}${after}`;
        cursor = next.length;
        break;
      case "Link": {
        const url = window.prompt("Link URL");
        if (!url) return;
        next = `${before}[${selected || "link text"}](${url})${after}`;
        cursor = start + (selected || "link text").length + url.length + 4;
        break;
      }
      default:
        return;
    }

    onQuickTextChange(next);
    window.requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <aside className="min-w-0 space-y-4" aria-label="Notebook tools">
      <section
        aria-label="AI Notebook Assistant"
        data-testid="notebook-assistant"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
            AI Notebook Assistant
          </h2>
          <span className="max-w-24 truncate rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3" title={`Active AI model: ${providerLabel}`}>{providerLabel}</span>
        </header>

        <p className="rounded-xl bg-surface-2/70 p-2.5 text-[12px] leading-snug text-ink-3">
          Summarize notes, generate ideas, rewrite, or turn notes into tasks.
        </p>

        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 2xl:grid-cols-1">
          {ASSISTANT_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={`notebook-assistant-${action.id}`}
                onClick={() => onRun(action.id)}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
              >
                <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                <span className="min-w-0 truncate text-[11px] font-medium text-ink-2">{action.label}</span>
              </button>
            );
          })}
        </div>

        {answer != null ? (
          <p
            data-testid="notebook-assistant-answer"
            className="mt-2 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
          >
            {answer}
          </p>
        ) : null}
      </section>

      <section
        aria-label="Quick Capture"
        data-testid="notebook-quick-capture"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center gap-1.5">
          <PenLine className="size-4 text-accent-ink" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Quick Capture</h2>
        </header>

        <div className="mb-2 flex flex-wrap gap-1">
          {NOTEBOOK_QUICK_CAPTURE_KINDS.map((kind) => {
            const Icon = kind.icon;
            return (
              <button
                key={kind.id}
                type="button"
                data-testid={`notebook-capture-${kind.id}`}
                onClick={() => onCapture(kind.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  quickKind === kind.id
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:bg-surface-3",
                )}
              >
                <Icon className="mr-1 inline size-3" aria-hidden="true" />
                {kind.label}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onCapture("note");
          }}
        >
          <textarea
            ref={textareaRef}
            value={quickText}
            onChange={(event) => onQuickTextChange(event.target.value)}
            placeholder="Write a quick note…"
            aria-label="Quick capture note"
            rows={3}
            className="w-full resize-none rounded-xl border border-line bg-surface p-2.5 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[
                { icon: Bold, label: "Bold" },
                { icon: Italic, label: "Italic" },
                { icon: Strikethrough, label: "Strikethrough" },
                { icon: List, label: "List" },
                { icon: MessageSquare, label: "Link" },
                { icon: SquareCheck, label: "Checklist" },
              ].map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.label}
                    type="button"
                    aria-label={entry.label}
                    onClick={() => applyFormat(entry.label)}
                    className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <Button type="submit" variant="primary" size="sm" data-testid="notebook-capture-save">
              <Send className="size-3.5" aria-hidden="true" />
              Save
            </Button>
          </div>
        </form>
      </section>

      <section
        aria-label="Recent Notes"
        data-testid="notebook-recent"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Clock className="size-4 text-accent-ink" aria-hidden="true" />
            Recent Notes
          </h2>
          <Link href="/notebook" className="text-[11px] font-medium text-accent-ink hover:underline">
            View all
          </Link>
        </header>

        {rows.length === 0 ? (
          <p className="text-[12px] text-ink-3">No notes yet.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  data-testid="notebook-recent-row"
                  onClick={() => onOpenNote(row.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-base"
                    aria-hidden="true"
                  >
                    {notebookNoteIcon(row.icon)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">{row.title}</span>
                    <span className="block text-[10px] text-ink-3">{relativeTime(row.updatedAt, now)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
