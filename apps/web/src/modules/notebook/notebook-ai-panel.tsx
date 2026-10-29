"use client";

import * as React from "react";

import { GraduationCap, HelpCircle, Link2, ListTree, PenLine, Sparkles, SplitSquareVertical, Wand2 } from "lucide-react";

import { runNotebookAssistant, type NotebookAiAction, type NotebookAiResult } from "@personalos/core";
import type { Page } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { Input } from "@/components/ui/input";
import { useAIGateway } from "@/lib/use-ai-gateway";

import { useAppState, useOS } from "@/store/use-os";

const ACTIONS: Array<{
  value: NotebookAiAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  needsPrompt?: boolean;
}> = [
  { value: "outline", label: "Outline", icon: ListTree, needsPrompt: true },
  { value: "continue", label: "Continue", icon: PenLine },
  { value: "summarize", label: "Summarize", icon: Sparkles },
  { value: "backlinks", label: "Backlinks", icon: Link2 },
  { value: "extract_notes", label: "Extract notes", icon: SplitSquareVertical },
];

export interface NotebookAiPanelProps {
  page: Page;
  onApplyBlocks: (blocks: Page["blocks"], message: string) => void;
  onAddRef: (ref: { type: "page"; id: string; label: string }, message: string) => void;
}

export function NotebookAiPanel({ page, onApplyBlocks, onAddRef }: NotebookAiPanelProps) {
  const os = useOS();
  const state = useAppState();
  const ai = useAIGateway();
  const [prompt, setPrompt] = React.useState("");
  const [result, setResult] = React.useState<NotebookAiResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const pageContext = JSON.stringify(page.blocks).slice(0, 190000);

  const run = (action: NotebookAiAction) => {
    if (ai.gatewayEnabled && (action === "summarize" || action === "outline")) {
      void ai.request({
        action: action === "summarize" ? "notebook_summary" : "notebook_outline",
        prompt: action === "summarize" ? "Summarize this notebook page." : "Build an outline for this notebook page.",
        context: pageContext,
        label: action === "summarize" ? "Summarize notebook" : "Notebook outline",
      });
      return;
    }
    setBusy(true);
    try {
      setResult(runNotebookAssistant({ page, action, prompt }, state));
    } finally {
      setBusy(false);
    }
  };

  const runExtra = (action: "flashcards" | "quiz" | "links") => {
    const meta =
      action === "flashcards"
        ? { action: "notebook_flashcards", label: "Generate flashcards", prompt: "Create 5–8 study flashcards from this page." }
        : action === "quiz"
          ? { action: "notebook_quiz", label: "Generate quiz", prompt: "Create a short quiz from this page with answers." }
          : { action: "notebook_link_suggest", label: "Suggest links", prompt: "Suggest related pages and ideas to link from this page." };
    if (!ai.gatewayEnabled) {
      ai.setAnswer(
        action === "flashcards"
          ? "Local flashcards: turn each heading into a question and its first sentence into the answer."
          : action === "quiz"
            ? "Local quiz: use each heading as a question and the following paragraph as the answer."
            : "Local links: connect this page to notes with matching tags or titles.",
      );
      return;
    }
    void ai.request({ action: meta.action, prompt: meta.prompt, context: pageContext, label: meta.label });
  };

  return (
    <section
      aria-label="Notebook assistant"
      className="rounded-xl border border-line bg-surface p-4"
      data-testid="notebook-ai-panel"
    >
      <div className="mb-3 flex items-center gap-2">
        <Wand2 className="size-4 text-accent" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Assistant</h2>
        <Badge tone="accent">Local</Badge>
      </div>

      <Input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Optional focus, e.g. “remote work”"
        aria-label="Assistant prompt"
        className="mb-3"
      />

      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map((action) => (
          <Button
            key={action.value}
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => run(action.value)}
          >
            <action.icon className="size-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => runExtra("flashcards")}>
          <GraduationCap className="size-3.5" />
          Flashcards
        </Button>
        <Button variant="ghost" size="sm" onClick={() => runExtra("quiz")}>
          <HelpCircle className="size-3.5" />
          Quiz
        </Button>
        <Button variant="ghost" size="sm" onClick={() => runExtra("links")}>
          <Link2 className="size-3.5" />
          Link ideas
        </Button>
      </div>

      {ai.answer ? (
        <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-ink-2" data-testid="notebook-ai-answer">
          {ai.answer}
        </p>
      ) : null}
      <p className="mt-1.5 text-[10px] text-ink-3" data-testid="notebook-ai-credits">
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

      {result ? (
        <div className="mt-4 space-y-3" data-testid="notebook-ai-result">
          <p className="text-sm text-ink-2">{result.message}</p>

          {result.summary ? (
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-sm text-ink">{result.summary}</p>
            </div>
          ) : null}

          {result.blocks && result.blocks.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApplyBlocks(result.blocks!, `Added ${result.blocks!.length} blocks`)}
            >
              Insert into page
            </Button>
          ) : null}

          {result.proposals.length > 0 ? (
            <ul className="space-y-1.5">
              {result.proposals.map((proposal, index) => {
                const targetId = typeof proposal.payload.id === "string" ? proposal.payload.id : "";
                const targetTitle = typeof proposal.payload.title === "string" ? proposal.payload.title : "";
                const isLink = proposal.capability === "notebook_backlinks" && targetId.length > 0;
                if (isLink) {
                  return (
                    <li key={`${proposal.capability}-${index}`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() =>
                          onAddRef(
                            { type: "page", id: targetId, label: String(proposal.title).replace("Link ", "") },
                            `Linked ${String(proposal.title).replace("Link ", "")}`,
                          )
                        }
                      >
                        <Link2 className="size-3.5" />
                        {String(proposal.title)}
                      </Button>
                    </li>
                  );
                }
                return (
                  <li key={`${proposal.capability}-${index}`} className="rounded-lg bg-surface-2 p-2.5">
                    <p className="text-sm font-medium text-ink">{String(proposal.title)}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{proposal.summary}</p>
                    {targetTitle.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1.5"
                        onClick={() =>
                          os.addNote({
                            title: String(proposal.payload.title),
                            body: String(proposal.payload.body ?? ""),
                            source: "ai",
                          })
                        }
                      >
                        Save as note
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {result.suggestions.length > 0 ? (
            <ul className="space-y-1 border-t border-line pt-2">
              {result.suggestions.slice(0, 5).map((suggestion, index) => (
                <li key={`${suggestion.label}-${index}`} className="text-xs text-ink-3">
                  <span className="font-medium text-ink-2">{suggestion.label}:</span> {suggestion.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}