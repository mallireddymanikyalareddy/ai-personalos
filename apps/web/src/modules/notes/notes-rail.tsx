"use client";

import * as React from "react";

import { ModelLabel } from "@/components/ai/model-label";

import type { LucideIcon } from "lucide-react";

import {
  Brain,
  CalendarClock,
  ChevronRight,
  Image as ImageIcon,
  Info,
  Link2,
  ListChecks,
  Lightbulb,
  NotebookPen,
  Pencil,
  PenLine,
  Plus,
  Sparkles,
  Target,
  Wand2,
  Zap,
} from "lucide-react";

import type { NoteDetail, NoteFolderRow, NoteRelated } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";

export interface NoteAssistantAction {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const NOTE_ASSISTANT_ACTIONS: NoteAssistantAction[] = [
  { id: "summarize", label: "Summarize this note", icon: Sparkles },
  { id: "actions", label: "Create action items", icon: ListChecks },
  { id: "improve", label: "Improve writing", icon: Wand2 },
  { id: "tasks", label: "Convert to task list", icon: Target },
  { id: "plan", label: "Generate a project plan", icon: NotebookPen },
  { id: "tags", label: "Suggest tags", icon: ListChecks },
  { id: "flashcards", label: "Study flashcards", icon: Brain },
  { id: "ask", label: "Ask anything", icon: Brain },
];

export function NoteAssistant({
  disabled,
  answer,
  onAction,
  onAsk,
  creditsNote,
}: {
  disabled: boolean;
  answer: string | null;
  onAction: (id: string) => void;
  onAsk: (question: string) => void;
  creditsNote?: string;
}) {
  const [draft, setDraft] = React.useState("");

  return (
    <section
      aria-label="AI Notes Assistant"
      data-testid="notes-assistant"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI Notes Assistant
        </h2>
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3"><ModelLabel /></span>
      </header>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 2xl:grid-cols-1">
        {NOTE_ASSISTANT_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              data-testid={`notes-assistant-${action.id}`}
              disabled={disabled}
              onClick={() => onAction(action.id)}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="size-4 shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="min-w-0 truncate text-[12px] font-medium text-ink-2">{action.label}</span>
            </button>
          );
        })}
      </div>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim().length === 0) return;
          onAsk(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask anything about this note…"
          aria-label="Ask about this note"
          className="h-8 text-[13px]"
        />
        <Button type="submit" variant="primary" size="sm" disabled={disabled}>
          Ask
        </Button>
      </form>

      {answer ? (
        <p
          data-testid="notes-assistant-answer"
          className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
        >
          {answer}
        </p>
      ) : null}
      {creditsNote ? (
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="notes-assistant-credits">
          {creditsNote}
        </p>
      ) : null}
    </section>
  );
}

export function NoteDetails({
  note,
  folders,
  onMoveFolder,
}: {
  note: NoteDetail;
  folders: NoteFolderRow[];
  onMoveFolder: (folderId: string | null) => void;
}) {
  const current = folders.find((folder) => folder.id === note.folderId);
  return (
    <section
      aria-label="Note Details"
      data-testid="notes-details"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center gap-1.5">
        <Info className="size-4 text-accent-ink" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Note Details</h2>
      </header>

      <dl className="space-y-2.5 text-[12px]">
        <Row icon={Zap} label="Created" value={formatDetail(note.createdAt)} />
        <Row icon={Pencil} label="Updated" value={formatDetail(note.updatedAt)} />

        <div className="flex items-center gap-2">
          <dt className="flex w-24 shrink-0 items-center gap-1.5 text-ink-3">
            <Link2 className="size-3.5" aria-hidden="true" />
            Folder
          </dt>
          <dd className="min-w-0 flex-1">
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Move to folder",
                  items: [
                    { label: "No folder", selected: note.folderId == null, onSelect: () => onMoveFolder(null) },
                    ...folders
                      .filter((folder) => folder.id !== "all" && folder.id !== "archive")
                      .map((folder) => ({
                        label: folder.name,
                        selected: note.folderId === folder.id,
                        onSelect: () => onMoveFolder(folder.id),
                      })),
                  ],
                },
              ]}
              trigger={
                <button
                  type="button"
                  data-testid="note-folder-select"
                  className="flex w-full items-center justify-between gap-1 rounded-lg border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:bg-surface-2"
                >
                  <span className="truncate">{current?.name ?? "No folder"}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                </button>
              }
            />
          </dd>
        </div>

        <div className="flex items-start gap-2">
          <dt className="flex w-24 shrink-0 items-center gap-1.5 pt-0.5 text-ink-3">
            <ListChecks className="size-3.5" aria-hidden="true" />
            Tags
          </dt>
          <dd className="flex min-w-0 flex-1 flex-wrap gap-1">
            {note.tags.length === 0 ? (
              <span className="text-ink-3">None</span>
            ) : (
              note.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2"
                  data-testid="note-detail-tag"
                >
                  #{tag}
                </span>
              ))
            )}
          </dd>
        </div>

        <Row icon={PenLine} label="Word Count" value={`${note.wordCount} words`} />
        <Row icon={CalendarClock} label="Reading Time" value={`${note.readingTimeMinutes} min`} />
      </dl>
    </section>
  );
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="flex w-24 shrink-0 items-center gap-1.5 text-ink-3">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate text-ink">{value}</dd>
    </div>
  );
}

function formatDetail(at: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
}

export function NoteRelated({ items, tasks }: { items: NoteRelated[]; tasks: { id: string; title: string }[] }) {
  return (
    <section
      aria-label="Related Content"
      data-testid="notes-related"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center gap-1.5">
        <Link2 className="size-4 text-accent-ink" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Related Content</h2>
      </header>

      {items.length === 0 && tasks.length === 0 ? (
        <p className="text-[12px] text-ink-3">Nothing linked yet. Add tags to surface related notes.</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <a
                href={item.href}
                data-testid="note-related-item"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-surface-2"
              >
                <Link2 className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="shrink-0 text-[11px] text-ink-3">{item.meta}</span>
                <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              </a>
            </li>
          ))}
          {tasks.length > 0 ? (
            <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink-2">
              <ListChecks className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Tasks from this note</span>
              <span className="shrink-0 text-[11px] text-ink-3" data-testid="note-task-count">
                {tasks.length}
              </span>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

export function QuickCapture({
  text,
  onChange,
  onCapture,
}: {
  text: string;
  onChange: (text: string) => void;
  onCapture: (kind: "note" | "task" | "event" | "idea" | "photo") => void;
}) {
  const kinds: { id: "note" | "task" | "event" | "idea" | "photo"; label: string; icon: LucideIcon }[] = [
    { id: "note", label: "Note", icon: NotebookPen },
    { id: "task", label: "Task", icon: ListChecks },
    { id: "event", label: "Event", icon: CalendarClock },
    { id: "idea", label: "Idea", icon: Lightbulb },
    { id: "photo", label: "Photo", icon: ImageIcon },
  ];

  return (
    <section
      aria-label="Quick Capture"
      data-testid="notes-quick-capture"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center gap-1.5">
        <Zap className="size-4 text-accent-ink" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Quick Capture</h2>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCapture("note");
        }}
      >
        <Input
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add a quick note…"
          aria-label="Quick capture"
          className="h-8 text-[13px]"
        />
      </form>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {kinds.map((kind) => {
          const Icon = kind.icon;
          return (
            <button
              key={kind.id}
              type="button"
              data-testid={`notes-capture-${kind.id}`}
              onClick={() => onCapture(kind.id)}
              className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface-2 px-1 py-1.5 text-[10px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-3"
            >
              <Icon className="size-3.5 text-accent-ink" aria-hidden="true" />
              {kind.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function EmptyNotePlaceholder() {
  return (
    <section
      aria-label="Note editor"
      data-testid="note-editor-empty"
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface p-10 text-center shadow-card"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-ink" aria-hidden="true">
        <Plus className="size-5" />
      </span>
      <p className="text-sm font-medium text-ink">Select a note to open it</p>
      <p className="text-[12px] text-ink-3">Or create a new note to start writing.</p>
    </section>
  );
}