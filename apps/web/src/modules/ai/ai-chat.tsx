"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  ChevronRight,
  Mic,
  MicOff,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import type { AIObject, AIResult, ID, Timestamp } from "@personalos/core";

import { AIObjectCard } from "@/components/entities/ai-object-card";
import { DropdownMenu } from "@/components/ui/dropdown";

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: AIResult;
  proposals?: AIObject[];
  at: Timestamp;
  messageId?: ID;
  feedback?: "up" | "down" | null;
}

export interface ChatSuggestion {
  id: string;
  label: string;
  prompt: string;
  icon: LucideIcon;
}

export const CHAT_CHIPS: { id: string; label: string; prompt: string }[] = [
  { id: "plan", label: "Plan", prompt: "plan my day" },
  { id: "summarize", label: "Summarize", prompt: "review my week" },
  { id: "improve", label: "Improve", prompt: "optimize my schedule" },
  { id: "brainstorm", label: "Brainstorm", prompt: "what should I work on" },
];

export function AIChat({
  greetingName,
  entries,
  suggestions,
  draft,
  onDraftChange,
  onSend,
  onRunChip,
  onMore,
  composerRef,
  pendingProposalCount,
  onAcceptProposal,
  onDismissProposal,
  onRegenerate,
  onFeedback,
  modelControl,
  onVoice,
  voiceListening,
  feedbackSummary,
}: {
  greetingName: string;
  entries: ChatEntry[];
  suggestions: ChatSuggestion[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onRunChip: (prompt: string) => void;
  onMore: (id: string) => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  pendingProposalCount: number;
  onAcceptProposal: (id: ID) => void;
  onDismissProposal: (id: ID) => void;
  onRegenerate?: () => void;
  onFeedback?: (entry: ChatEntry, value: "up" | "down" | null) => void;
  modelControl?: React.ReactNode;
  onVoice?: () => void;
  voiceListening?: boolean;
  feedbackSummary?: { up: number; down: number; total: number };
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries.length]);

  React.useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 128)}px`;
  }, [draft, composerRef]);

  const copy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
  };

  return (
    <section
      aria-label="AI conversation"
      data-testid="ai-chat"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card"
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        <header className="flex items-start gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink"
            aria-hidden="true"
          >
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Hi {greetingName}! 👋</p>
            <p className="text-[13px] text-ink-3">How can I help you today?</p>
          </div>
          {modelControl ? <div className="shrink-0">{modelControl}</div> : null}
        </header>

        {entries.length === 0 ? (
          <ul className="mt-4 space-y-1.5" data-testid="ai-suggestions">
            {suggestions.map((suggestion) => {
              const Icon = suggestion.icon;
              return (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    data-testid={`ai-suggestion-${suggestion.id}`}
                    onClick={() => onRunChip(suggestion.prompt)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-left text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink" aria-hidden="true">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
                    <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ol className="mt-4 space-y-3" data-testid="ai-thread">
            {entries.map((entry, index) =>
              entry.role === "user" ? (
                <li key={entry.id} className="flex justify-end">
                  <span
                    className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[13px] text-white"
                    data-testid="ai-user-message"
                  >
                    {entry.text}
                  </span>
                </li>
              ) : (
                <li key={entry.id} className="flex gap-2.5" data-testid="ai-assistant-message">
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink"
                    aria-hidden="true"
                  >
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md border border-line bg-surface-2/50 px-3 py-2">
                    <AssistantResponse
                      result={entry.result}
                      text={entry.text}
                      proposals={entry.proposals}
                      onAcceptProposal={onAcceptProposal}
                      onDismissProposal={onDismissProposal}
                      onCopy={() => copy(entry.id, entry.text)}
                      copied={copiedId === entry.id}
                      feedback={entry.feedback ?? null}
                      onFeedback={onFeedback ? (value) => onFeedback(entry, value) : undefined}
                      onRegenerate={
                        onRegenerate && index === entries.length - 1 ? onRegenerate : undefined
                      }
                    />
                  </div>
                </li>
              ),
            )}
          </ol>
        )}
      </div>

      <footer className="border-t border-line p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              placeholder='Ask anything... e.g. "Plan my week", "Help me focus", or "Turn this goal into tasks"'
              aria-label="Ask the assistant"
              data-testid="ai-composer"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-3"
            />
            {onVoice ? (
              <button
                type="button"
                onClick={onVoice}
                aria-label={voiceListening ? "Stop voice input" : "Start voice input"}
                data-testid="ai-voice"
                className={`grid size-9 shrink-0 place-items-center rounded-xl border transition-colors ${
                  voiceListening
                    ? "border-danger bg-danger-soft text-danger"
                    : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {voiceListening ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
              </button>
            ) : null}
            <button
              type="submit"
              aria-label="Send message"
              data-testid="ai-send"
              disabled={draft.trim().length === 0}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        {feedbackSummary && feedbackSummary.total > 0 ? (
          <p className="mt-2 text-[11px] text-ink-3" data-testid="ai-feedback-summary">
            Helpful {feedbackSummary.up} · Not helpful {feedbackSummary.down}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {CHAT_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              data-testid={`ai-chip-${chip.id}`}
              onClick={() => onRunChip(chip.prompt)}
              className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-3"
            >
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            data-testid="ai-chip-ask"
            onClick={() => composerRef.current?.focus()}
            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-3"
          >
            Ask
          </button>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: "Assistant",
                items: [
                  {
                    label: "Pending proposals",
                    disabled: pendingProposalCount === 0,
                    onSelect: () => onMore("proposals"),
                  },
                  { label: "Weekly review", onSelect: () => onMore("weekly-review") },
                  { label: "My insights", onSelect: () => onMore("insights") },
                  { label: "New conversation", onSelect: () => onMore("new") },
                  { label: "Clear conversation", onSelect: () => onMore("clear") },
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                aria-label="More assistant actions"
                className="grid size-7 place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <MoreHorizontal className="size-3.5" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </footer>
    </section>
  );
}

interface ReviewData {
  completedCount: number;
  completedByDay: Array<{ label: string; count: number }>;
  wins: string[];
  risks: string[];
  focusNextWeek: string[];
}

function readReview(data: unknown): ReviewData | null {
  if (data == null || typeof data !== "object") return null;
  const value = data as Partial<ReviewData>;
  if (!Array.isArray(value.completedByDay)) return null;
  return {
    completedCount: value.completedCount ?? 0,
    completedByDay: value.completedByDay,
    wins: Array.isArray(value.wins) ? value.wins : [],
    risks: Array.isArray(value.risks) ? value.risks : [],
    focusNextWeek: Array.isArray(value.focusNextWeek) ? value.focusNextWeek : [],
  };
}

function WeeklyReviewChart({ review }: { review: ReviewData }) {
  const max = Math.max(1, ...review.completedByDay.map((day) => day.count));
  return (
    <div className="mt-3" data-testid="ai-review-chart">
      <div className="flex items-end gap-1.5" style={{ height: 96 }}>
        {review.completedByDay.map((day) => (
          <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium tabular-nums text-ink-2">{day.count}</span>
            <span
              className="w-full rounded-t bg-chart-5"
              style={{ height: `${Math.max(4, (day.count / max) * 72)}px` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {review.completedByDay.map((day) => (
          <span key={day.label} className="flex-1 truncate text-center text-[10px] text-ink-3">
            {day.label.slice(0, 3)}
          </span>
        ))}
      </div>
      {review.focusNextWeek.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {review.focusNextWeek.map((line) => (
            <li key={line} className="flex items-start gap-1.5 text-[12px] text-ink-2">
              <Pencil className="mt-0.5 size-3 shrink-0 text-ink-3" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AssistantResponse({
  result,
  text,
  proposals,
  onAcceptProposal,
  onDismissProposal,
  onCopy,
  copied,
  feedback,
  onFeedback,
  onRegenerate,
}: {
  result?: AIResult;
  text: string;
  proposals?: AIObject[];
  onAcceptProposal?: (id: ID) => void;
  onDismissProposal?: (id: ID) => void;
  onCopy?: () => void;
  copied?: boolean;
  feedback?: "up" | "down" | null;
  onFeedback?: (value: "up" | "down" | null) => void;
  onRegenerate?: () => void;
}) {
  const review = result?.capability === "weekly_review" ? readReview(result.data) : null;

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-ink-2">{text}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="text-[11px] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            data-testid="ai-regenerate"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Regenerate
          </button>
        ) : null}
        {onFeedback ? (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              aria-label={feedback === "up" ? "Remove helpful rating" : "Mark helpful"}
              aria-pressed={feedback === "up"}
              onClick={() => onFeedback(feedback === "up" ? null : "up")}
              className={`grid size-6 place-items-center rounded-md transition-colors ${
                feedback === "up" ? "bg-success-soft text-success" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <ThumbsUp className="size-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={feedback === "down" ? "Remove not helpful rating" : "Mark not helpful"}
              aria-pressed={feedback === "down"}
              onClick={() => onFeedback(feedback === "down" ? null : "down")}
              className={`grid size-6 place-items-center rounded-md transition-colors ${
                feedback === "down" ? "bg-danger-soft text-danger" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <ThumbsDown className="size-3" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      {review ? <WeeklyReviewChart review={review} /> : null}

      {result && result.citations.length > 0 ? (
        <ul className="mt-2 space-y-1" data-testid="ai-citations">
          {result.citations.map((citation) => (
            <li key={`${citation.entityType}-${citation.entityId}`} className="text-[11px] text-ink-3">
              <span className="font-medium text-ink-2">{citation.title}</span>
              {citation.quote ? ` — ${citation.quote}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {proposals && proposals.length > 0 ? (
        <ul className="mt-3 space-y-2" data-testid="ai-proposals">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <AIObjectCard
                object={proposal}
                onAccept={() => onAcceptProposal?.(proposal.id)}
                onDismiss={() => onDismissProposal?.(proposal.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}