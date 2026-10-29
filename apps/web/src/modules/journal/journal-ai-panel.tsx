"use client";

import * as React from "react";

import { Brain, Check, Link2, Sparkles } from "lucide-react";

import {
  applyJournalProposal,
  journalActivitySuggestions,
  journalEventSuggestions,
  journalGoalSuggestions,
  journalHabitSuggestions,
  runJournalAssistant,
  type JournalApplyContext,
} from "@personalos/core";
import type { AIProposal, JournalEntry } from "@personalos/core";
import type { ID, Timestamp } from "@personalos/core";
import type { Habit } from "@personalos/core";
import type { Goal } from "@personalos/core";
import { PersonalOS } from "@personalos/core";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { useToast } from "@/components/ui/toast";
import { useAIGateway } from "@/lib/use-ai-gateway";

type Action = NonNullable<Parameters<typeof runJournalAssistant>[0]["action"]>;

const ACTIONS: Array<{ id: Action; label: string; detail: string }> = [
  { id: "summarize", label: "Summarise", detail: "A short read of your entry" },
  { id: "improve_writing", label: "Improve writing", detail: "Tidy grammar, keep meaning" },
  { id: "extract_highlights", label: "Extract highlights", detail: "Worth remembering" },
  { id: "extract_tasks", label: "Extract tasks", detail: "Create tasks with your confirmation" },
  { id: "extract_goals", label: "Goal contribution", detail: "Link to a goal you have" },
  { id: "detect_mood", label: "Detect mood", detail: "Suggests only — never recorded without you" },
  { id: "reflect", label: "Reflect", detail: "Thoughtful follow-up questions" },
  { id: "tomorrow", label: "Tomorrow", detail: "Priorities, habits, unfinished items" },
  { id: "create_memory", label: "Life memory", detail: "Keep this as a memory" },
];

interface JournalAIPanelProps {
  os: PersonalOS;
  entry: JournalEntry;
}

export function JournalAIPanel({ os, entry }: JournalAIPanelProps) {
  const { toast } = useToast();
  const ai = useAIGateway();
  const [pending, setPending] = React.useState<AIProposal[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<Action | null>(null);

  const journalContext = `${entry.title}\n${entry.body}`.slice(0, 190000);

  const run = (action: Action, now: Timestamp = Date.now()) => {
    if (ai.gatewayEnabled) {
      const meta =
        action === "summarize"
          ? { action: "journal_summary", label: "Summarize journal entry" }
          : action === "reflect"
            ? { action: "journal_reflection", label: "Guided reflection" }
            : action === "detect_mood"
              ? { action: "journal_mood_insight", label: "Mood and theme insight" }
              : action === "extract_tasks"
                ? { action: "task_from_note", label: "Extract tasks" }
                : action === "tomorrow"
                  ? { action: "today_weekly_preview", label: "Tomorrow preview" }
                  : action === "improve_writing"
                    ? { action: "note_rewrite", label: "Improve writing" }
                    : { action: "quick_question", label: "Quick AI question" };
      void ai.request({
        action: meta.action,
        prompt: action === "reflect" ? "Reflect on this journal entry with 3 thoughtful follow-up questions." : `Journal action: ${action}.`,
        context: journalContext,
        label: meta.label,
      });
      return;
    }
    setBusy(action);
    try {
      const result = runJournalAssistant({ entry: os.getJournalEntry(entry.id) ?? entry, action }, os.getState(), now);
      setMessage(result.message);
      setPending(result.proposals);
    } finally {
      setBusy(null);
    }
  };

  const runExtra = (action: "pattern_review" | "gratitude_prompt") => {
    if (!ai.gatewayEnabled) {
      setMessage(
        action === "pattern_review"
          ? "Local pattern review: your recent entries share themes of work, energy and planning."
          : "Local gratitude prompt: name one person, one moment and one thing that helped today.",
      );
      return;
    }
    void ai.request({
      action: action === "pattern_review" ? "journal_pattern_review" : "journal_gratitude_prompt",
      prompt: action === "pattern_review" ? "Review my journal entries for recurring themes and patterns." : "Give me one short gratitude prompt for today.",
      context: journalContext,
      label: action === "pattern_review" ? "Journal pattern review" : "Gratitude prompt",
    });
  };

  const context: JournalApplyContext = {
    addTask: (input, now) => os.addTask(input, now),
    updateEntry: (entryId: ID, patch) => os.updateJournalEntry(entryId, patch),
    addEvent: (input, now) => os.addEvent(input, now),
    addLifeMemoryItem: (input, now) => os.addLifeMemoryItem(input, now),
    linkJournalToTask: (entryId, taskId) => {
      os.linkJournalToTask(entryId, taskId);
    },
    linkJournalToEvent: (entryId, eventId) => {
      os.linkJournalToEvent(entryId, eventId);
    },
    linkJournalToGoal: (entryId, goalId) => {
      os.linkJournalToGoal(entryId, goalId);
    },
    linkJournalToLifeMemory: (entryId, memoryId) => {
      os.linkJournalToLifeMemory(entryId, memoryId);
    },
  };

  const apply = (proposal: AIProposal) => {
    const outcome = applyJournalProposal(context, proposal);
    if (!outcome.ok) {
      toast(outcome.message);
      return;
    }
    setPending((current) => current.filter((candidate) => candidate !== proposal));
    toast(outcome.message);
  };

  const dismissAll = () => {
    setPending([]);
    setMessage("Suggestions dismissed — nothing was changed.");
  };

  const attached = os.getJournalEntry(entry.id) ?? entry;
  const habits = Object.values(os.getState().habits).filter((habit: Habit) => !habit.archived);
  const goals = Object.values(os.getState().goals) as Goal[];
  const habitMatches = journalHabitSuggestions(attached, habits).filter(
    (match) => match.confidence >= 0.85 && !attached.habitIds.includes(match.habitId),
  );
  const goalMatches = journalGoalSuggestions(attached, goals).filter(
    (match) => match.confidence >= 0.45 && !attached.goalIds.includes(match.goalId),
  );
  const eventMatches = attached.eventIds.length === 0 ? journalEventSuggestions(attached) : [];
  const activities = journalActivitySuggestions(attached).filter((activity) => !attached.activities.includes(activity));

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Brain className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-medium">Journal assistant</h3>
            <p className="text-xs text-ink-3">Everything here needs your confirmation before it changes anything.</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant="secondary"
              disabled={busy === action.id}
              title={action.detail}
              onClick={() => run(action.id)}
            >
              {busy === action.id ? (
                <Sparkles className="size-3.5 animate-pulse" aria-hidden />
              ) : null}
              {action.label}
            </Button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => runExtra("pattern_review")}>
            Pattern review
          </Button>
          <Button size="sm" variant="ghost" onClick={() => runExtra("gratitude_prompt")}>
            Gratitude prompt
          </Button>
        </div>

        {(ai.answer ?? message) ? (
          <p className="mt-3 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-ink-2" role="status" data-testid="journal-ai-answer">
            {ai.answer ?? message}
          </p>
        ) : null}
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="journal-ai-credits">
          {ai.creditsNote}
        </p>
        <CreditConfirmDialog
          open={ai.pending != null}
          label={ai.pending?.label ?? "AI action"}
          estimate={ai.pending?.estimate ?? null}
          busy={ai.busy}
          onClose={ai.dismiss}
          onConfirm={() => void ai.confirm()}
        />
      </section>

      {pending.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Waiting for your confirmation</h3>
            <Button size="sm" variant="ghost" onClick={dismissAll}>
              Dismiss all
            </Button>
          </div>
          {pending.map((proposal, index) => (
            <div key={`${proposal.title}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{proposal.title}</p>
                <p className="text-xs text-ink-3">{proposal.summary}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPending((current) => current.filter((item) => item !== proposal))}>
                  Not now
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => apply(proposal)}
                >
                  <Check className="size-3.5" aria-hidden />
                  Create
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {eventMatches.length > 0 ? (
        <SuggestionRow
          title="Add to calendar"
          description={`${eventMatches[0]!.title} — ${new Date(eventMatches[0]!.startsAt).toLocaleString()}`}
          onConfirm={() => {
            if (os.createEventFromJournal(attached.id, eventMatches[0]!)) {
              toast("Event added to your calendar");
            } else {
              toast("A similar event already exists");
            }
          }}
          onDismiss={() => toast("Suggestion dismissed")}
        />
      ) : null}

      {habitMatches.length > 0 ? (
        <div className="space-y-2">
          {habitMatches.map((habitMatch) => (
            <SuggestionRow
              key={habitMatch.habitId}
              title="Mark a habit complete?"
              description={`You mentioned exercising today. Mark your ${habitMatch.title} habit complete?`}
              onConfirm={() => {
                os.confirmJournalHabitCompletion(attached.id, habitMatch.habitId);
                toast(`${habitMatch.title} marked complete and linked to this entry`);
              }}
              onDismiss={() => toast("Left for you to check in later")}
            />
          ))}
        </div>
      ) : null}

      {goalMatches.length > 0 ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="text-sm font-medium">Goal contribution</h3>
          <div className="mt-2 space-y-2">
            {goalMatches.map((match) => (
              <div key={match.goalId} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  Link to <strong>{match.title}</strong>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    os.linkJournalToGoal(attached.id, match.goalId);
                    toast(`Entry linked to ${match.title}`);
                  }}
                >
                  <Link2 className="size-3.5" aria-hidden />
                  Link
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activities.length > 0 ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="text-sm font-medium">Activities mentioned</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {activities.map((activity) => (
              <Button
                key={activity}
                size="sm"
                variant="ghost"
                onClick={() => {
                  os.updateJournalEntry(attached.id, { activities: [...attached.activities, activity] });
                  toast(`${activity} added`);
                }}
              >
                + {activity}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {pending.length === 0 && message == null ? (
        <Alert tone="info" title="Nothing pending">
          Pick an action above and I will show you exactly what I would do before doing it.
        </Alert>
      ) : null}

      <p className="text-xs text-ink-3">
        AI observations are generated from your words. They are not diagnoses, and nothing is written without
        your confirmation.
      </p>
      <Badge tone="outline">Suggestions: {pending.length}</Badge>
      <span className="sr-only">{entryDateLabel(attached)}</span>
    </div>
  );
}

function entryDateLabel(entry: JournalEntry): string {
  return new Date(entry.entryDate).toLocaleDateString();
}

function SuggestionRow({
  title,
  description,
  onConfirm,
  onDismiss,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-ink-3">{description}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
        <Button size="sm" variant="primary" onClick={onConfirm}>
          <Check className="size-3.5" aria-hidden />
          Confirm
        </Button>
      </div>
    </section>
  );
}
