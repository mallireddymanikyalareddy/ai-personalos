"use client";

import * as React from "react";

import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { AIAnswer } from "@/components/ai/ai-answer";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { estimateAIAction, type AIEstimate } from "@/lib/ai-stream";
import { useAIGateway } from "@/lib/use-ai-gateway";

type CatalogAction = {
  action: string;
  label: string;
  minCredits: number;
  maxCredits: number;
  maxInputTokens: number;
  maxOutputTokens: number;
};

const GROUPS = [
  "AI Assistant",
  "Today",
  "Tasks",
  "Calendar",
  "Planner",
  "Goals",
  "Habits",
  "Notes",
  "Journal",
  "Projects",
  "Meetings",
  "Digital Paper",
  "Notebook",
  "Insights",
  "Rewards",
  "Templates",
  "Inbox",
  "Life Memory",
  "Work Mode",
  "Collaboration",
  "Other",
];

const BATCH_ACTIONS = new Set(["task_bulk_cleanup", "note_merge_dedupe", "inbox_triage", "memory_dedupe"]);

function moduleOf(action: string): string {
  if (action === "quick_question" || action === "complex_planning") return "AI Assistant";
  if (action.startsWith("today_")) return "Today";
  if (action.startsWith("task_")) return "Tasks";
  if (action.startsWith("calendar_")) return "Calendar";
  if (action.startsWith("plan_") || action === "weekly_plan" || action === "daily_plan") return "Planner";
  if (action.startsWith("goal_")) return "Goals";
  if (action.startsWith("habit_")) return "Habits";
  if (action.startsWith("note_")) return "Notes";
  if (action.startsWith("journal_")) return "Journal";
  if (action.startsWith("project_")) return "Projects";
  if (action.startsWith("meeting_")) return "Meetings";
  if (action.startsWith("document_")) return "Digital Paper";
  if (action.startsWith("notebook_") || action === "handwriting_cleanup") return "Notebook";
  if (action.startsWith("insights_") || action === "weekly_review") return "Insights";
  if (action.startsWith("reward_") || action === "celebration_message") return "Rewards";
  if (action.startsWith("template_")) return "Templates";
  if (action.startsWith("capture_") || action.startsWith("inbox_")) return "Inbox";
  if (action.startsWith("memory_")) return "Life Memory";
  if (action.startsWith("workmode_")) return "Work Mode";
  if (action.startsWith("collab_")) return "Collaboration";
  return "Other";
}

export function AIActionCatalog() {
  const ai = useAIGateway();
  const [actions, setActions] = React.useState<CatalogAction[]>([]);
  const [selected, setSelected] = React.useState("quick_question");
  const [prompt, setPrompt] = React.useState("");
  const [context, setContext] = React.useState("");
  const [itemCount, setItemCount] = React.useState("1");
  const [quote, setQuote] = React.useState<AIEstimate | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/plans", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { actions?: CatalogAction[] } | null) => {
        if (alive && data?.actions?.length) {
          setActions(data.actions);
          if (!data.actions.some((item) => item.action === "quick_question")) {
            setSelected(data.actions[0]!.action);
          }
        }
      })
      .catch(() => setError("Could not load the action catalogue."));
    return () => {
      alive = false;
    };
  }, []);

  const current = actions.find((item) => item.action === selected) ?? null;
  const grouped = GROUPS.map((group) => ({
    group,
    items: actions.filter((item) => moduleOf(item.action) === group),
  })).filter((entry) => entry.items.length > 0);
  const known = Boolean(current);

  const estimate = async () => {
    if (!current) return;
    setError(null);
    try {
      const result = await estimateAIAction(current.action, prompt.length + context.length, Number(itemCount) || 1);
      setQuote(result);
    } catch (err) {
      setQuote(null);
      setError((err as Error).message);
    }
  };

  const run = async () => {
    if (!current) return;
    const text = prompt.trim() || `${current.label}: use the context provided.`;
    await ai.request({
      action: current.action,
      prompt: text,
      context,
      label: current.label,
      itemCount: Number(itemCount) || 1,
    });
  };

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      aria-label="All AI actions"
      data-testid="ai-action-catalog"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">All AI actions</h2>
          <p className="text-xs text-ink-3">
            Every action in the registry, with server pricing and limits. Choose an action, add context, estimate, then run.
          </p>
        </div>
        <span className="rounded-md border border-line px-2 py-0.5 text-[10px] font-medium text-ink-3">
          {actions.length} actions
        </span>
      </header>

      {!ai.gatewayEnabled && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Local mode is selected. Switch to OpenAI in Settings to run catalogue actions; local actions stay free.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-2">
            Action
            <select
              className="mt-1 h-9 w-full rounded-lg border border-line bg-bg px-2 text-sm text-ink focus:border-accent focus:outline-none"
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setQuote(null);
                setError(null);
              }}
              data-testid="ai-catalog-select"
            >
              {grouped.map((entry) => (
                <optgroup key={entry.group} label={entry.group}>
                  {entry.items.map((item) => (
                    <option key={item.action} value={item.action}>
                      {item.label} · {item.minCredits === item.maxCredits ? item.minCredits : `${item.minCredits}–${item.maxCredits}`} credits
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {current && (
            <div className="rounded-lg border border-line bg-surface-2 p-2.5 text-[11px] text-ink-2" data-testid="ai-catalog-details">
              <p>
                <strong className="text-ink">{current.label}</strong> · <code>{current.action}</code>
              </p>
              <p className="mt-1 text-ink-3">
                {moduleOf(current.action)} · {current.minCredits === current.maxCredits
                  ? `${current.minCredits} credits`
                  : `${current.minCredits}–${current.maxCredits} credits`}
                {current.maxInputTokens > 0 ? ` · max ${current.maxInputTokens.toLocaleString()} input tokens` : ""}
                {current.maxOutputTokens > 0 ? ` · max ${current.maxOutputTokens.toLocaleString()} output tokens` : ""}
              </p>
            </div>
          )}

          <label className="block text-xs font-medium text-ink-2">
            Instruction
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What should this action do? Leave empty to use the action label."
              className="mt-1"
              data-testid="ai-catalog-prompt"
            />
          </label>

          {BATCH_ACTIONS.has(selected) && (
            <label className="block text-xs font-medium text-ink-2">
              Items in this batch
              <Input
                type="number"
                min={1}
                max={500}
                value={itemCount}
                onChange={(event) => setItemCount(event.target.value)}
                className="mt-1"
                data-testid="ai-catalog-items"
              />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-2">
            Context (document, transcript, notes, or extra detail)
            <Textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Paste the content this action should work on…"
              className="mt-1 min-h-28"
              data-testid="ai-catalog-context"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => void estimate()} disabled={!known || !ai.gatewayEnabled || !current}>
          Estimate
        </Button>
        <Button size="sm" variant="primary" onClick={() => void run()} disabled={!known || !ai.gatewayEnabled || !current}>
          Run with AI
        </Button>
        {quote && (
          <span className="text-xs text-ink-2" data-testid="ai-catalog-quote">
            {quote.minCredits === quote.maxCredits
              ? `${quote.minCredits} credits`
              : `${quote.minCredits}–${quote.maxCredits} credits`}{" "}
            · {quote.available} available · {quote.expectedRemaining} after
            {quote.allowed ? "" : ` · ${quote.reasons.join(", ")}`}
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {ai.answer ? (
        <AIAnswer
          text={ai.answer}
          testId="ai-catalog-answer"
          className="mt-3 rounded-xl border border-line bg-surface-2 p-3"
        />
      ) : null}
      <p className="mt-1.5 text-[10px] text-ink-3" data-testid="ai-catalog-credits">
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
