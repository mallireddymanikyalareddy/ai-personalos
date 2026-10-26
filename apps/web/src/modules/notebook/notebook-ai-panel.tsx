"use client";

import * as React from "react";

import { Link2, ListTree, PenLine, Sparkles, SplitSquareVertical, Wand2 } from "lucide-react";

import { runNotebookAssistant, type NotebookAiAction, type NotebookAiResult } from "@personalos/core";
import type { Page } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [prompt, setPrompt] = React.useState("");
  const [result, setResult] = React.useState<NotebookAiResult | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = (action: NotebookAiAction) => {
    setBusy(true);
    try {
      setResult(runNotebookAssistant({ page, action, prompt }, state));
    } finally {
      setBusy(false);
    }
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