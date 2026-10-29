"use client";

import * as React from "react";

import { Sparkles, Wand2 } from "lucide-react";

import type { AIResult, GoalCategory } from "@personalos/core";
import { GOAL_CATEGORY_LABELS } from "@personalos/core";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { useToast } from "@/components/ui/toast";
import { useAIGateway } from "@/lib/use-ai-gateway";
import { useOS } from "@/store/use-os";

import { GOAL_CATEGORY_ICON } from "./goals-meta";

const ASSISTANT_ACTIONS = [
  { label: "Break down this goal", prompt: "Break down my goal into milestones" },
  { label: "Suggest next steps", prompt: "Suggest next steps for my goals" },
  { label: "Create a plan", prompt: "Create a plan for my active goals" },
  { label: "Check risks", prompt: "Check risks for my active goals" },
  { label: "Rewrite as OKRs", prompt: "Rewrite my active goals as measurable OKRs" },
  { label: "Find similar goals", prompt: "Find similar goals" },
] as const;

export function GoalAssistant() {
  const os = useOS();
  const ai = useAIGateway();
  const [question, setQuestion] = React.useState("");
  const [result, setResult] = React.useState<AIResult | null>(null);

  const ask = (prompt: string) => {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) return;
    if (!ai.gatewayEnabled) {
      setResult(os.aiRun(trimmed));
      return;
    }
    const meta = /milestone|break down/i.test(trimmed)
      ? { action: "goal_milestone_breakdown", label: "Break down goal" }
      : /risk/i.test(trimmed)
        ? { action: "goal_risk_check", label: "Goal risk check" }
        : /okr/i.test(trimmed)
          ? { action: "goal_okr_rewrite", label: "Rewrite as OKRs" }
          : /plan/i.test(trimmed)
            ? { action: "goal_plan", label: "Goal action plan" }
            : /progress|next steps/i.test(trimmed)
              ? { action: "goal_progress_review", label: "Goal progress review" }
              : { action: "quick_question", label: "Quick AI question" };
    void ai.request({
      action: meta.action,
      prompt: trimmed,
      context: os.aiContextSummary(),
      label: meta.label,
    });
  };

  const answer = ai.answer ?? result?.message ?? null;

  return (
    <section
      aria-label="AI Goal Assistant"
      data-testid="goals-assistant"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent" aria-hidden="true" />
          AI Goal Assistant
        </h2>
      </header>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="How can I help with your goals?"
          aria-label="Ask the goal assistant"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!question.trim()}>
          Ask
        </Button>
      </form>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {ASSISTANT_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => ask(action.prompt)}
            className="rounded-lg border border-line px-2 py-1.5 text-left text-[11px] font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent-ink"
          >
            {action.label}
          </button>
        ))}
      </div>

      {answer ? (
        <div
          role="status"
          data-testid="goals-assistant-answer"
          className="mt-2 rounded-lg bg-surface-2 p-2.5 text-[13px] leading-relaxed text-ink-2"
        >
          {answer}
        </div>
      ) : null}
      <p className="mt-1.5 text-[10px] text-ink-3" data-testid="goals-assistant-credits">
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
  );
}

const QUICK_ADD_CATEGORIES: GoalCategory[] = ["career", "health", "learning", "financial"];

export function GoalQuickAdd() {
  const os = useOS();
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");

  const add = (category: GoalCategory) => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      toast("Type a goal first");
      return;
    }
    os.addGoal({ title: trimmed, category });
    setTitle("");
    toast(`${GOAL_CATEGORY_LABELS[category]} goal added`);
  };

  return (
    <section
      aria-label="Quick Add"
      data-testid="goals-quick-add"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Wand2 className="size-4 text-accent" aria-hidden="true" />
          Quick Add
        </h2>
      </header>

      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What's your new goal?"
        aria-label="What's your new goal"
        data-testid="goals-quick-add-input"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            add(QUICK_ADD_CATEGORIES[0]);
          }
        }}
      />

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {QUICK_ADD_CATEGORIES.map((category) => {
          const Icon = GOAL_CATEGORY_ICON[category];
          return (
            <button
              key={category}
              type="button"
              onClick={() => add(category)}
              className="flex flex-col items-center gap-1 rounded-lg border border-line px-1 py-1.5 transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <Icon className="size-3.5 text-accent" aria-hidden="true" />
              <span className="text-[10px] text-ink-2">{GOAL_CATEGORY_LABELS[category]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}