"use client";

import * as React from "react";

import { Inbox as InboxIcon, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { AIAnswer } from "@/components/ai/ai-answer";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { selectInboxTasks, type InboxItem } from "@personalos/core";
import { buildAIContext, estimateAIAction, streamAIChat, type AIEstimate } from "@/lib/ai-stream";
import { useCredits } from "@/lib/use-credits";

import { useCapture } from "@/modules/capture/capture-context";
import { AddTaskRow } from "@/modules/tasks/add-task-row";
import { TaskDetailSheet } from "@/modules/tasks/task-detail-sheet";
import { TaskList } from "@/modules/tasks/task-row";
import { useToast } from "@/components/ui/toast";
import { useAppState, useOS } from "@/store/use-os";

export default function InboxPage() {
  const state = useAppState();
  const os = useOS();
  const { openCapture } = useCapture();
  const { toast } = useToast();
  const [detailTaskId, setDetailTaskId] = React.useState<string | null>(null);
  const { balance, reload: reloadCredits } = useCredits(true);
  const gatewayEnabled = (state.settings.aiProvider ?? "local") === "openai";
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [pendingAI, setPendingAI] = React.useState<{
    action: string;
    prompt: string;
    label: string;
    context: string;
    estimate: AIEstimate;
  } | null>(null);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [lastCharge, setLastCharge] = React.useState<{ charged: number; available: number } | null>(null);

  const inbox = selectInboxTasks(state);
  const knowledgeItems = os.getInboxItems();
  const inboxContext = [
    `Inbox tasks: ${inbox.map((task) => task.title).join("; ") || "none"}`,
    `Knowledge items: ${knowledgeItems.map((item) => `${item.title} [${item.kind}]`).join("; ") || "none"}`,
  ].join("\n");

  const requestAI = async (action: string, prompt: string, label: string, context: string) => {
    setLastCharge(null);
    setAnswer("Pricing…");
    try {
      const merged = `${buildAIContext(state, "")}\n\n${context}`;
      const estimate = await estimateAIAction(action, prompt.length + merged.length);
      if (!estimate.allowed) {
        const message = estimate.reasons.includes("PAYMENT_GRACE_EXPIRED")
          ? "AI is paused because this subscription is past due."
          : estimate.reasons.includes("INSUFFICIENT_CREDITS")
            ? `You need ${Math.max(0, estimate.minCredits - estimate.available)} more credits for this.`
            : estimate.reasons.includes("INPUT_TOO_LARGE")
              ? `This inbox is too large. The limit is ${estimate.maxInputTokens.toLocaleString()} tokens.`
              : "This action is temporarily unavailable.";
        setAnswer(message);
        toast(message, { tone: "danger" });
        return;
      }
      setPendingAI({ action, prompt, label, context: merged, estimate });
      setAnswer(null);
    } catch (err) {
      setAnswer(null);
      toast((err as Error).message, { tone: "danger" });
    }
  };

  const confirmAI = async () => {
    if (!pendingAI) return;
    const { action, prompt, context } = pendingAI;
    setPendingAI(null);
    setAiBusy(true);
    setAnswer("Thinking…");
    try {
      await streamAIChat(
        { action, prompt, context, history: [] },
        setAnswer,
        (info) => {
          setLastCharge({ charged: info.charged, available: info.available });
          reloadCredits();
          toast(
            `${info.charged} credit${info.charged === 1 ? "" : "s"} used · ${info.available} remaining`,
            { tone: "success" },
          );
        },
      );
    } catch (err) {
      setAnswer(null);
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setAiBusy(false);
    }
  };

  const triage = (action: "inbox_triage" | "inbox_summary") => {
    if (!gatewayEnabled) {
      setAnswer(
        action === "inbox_triage"
          ? "Local triage: give dated items a date, and file the rest into tasks or notes."
          : `Inbox summary: ${inbox.length} tasks and ${knowledgeItems.length} knowledge items waiting.`,
      );
      return;
    }
    void requestAI(
      action,
      action === "inbox_triage"
        ? "Triage this inbox. Group items into tasks, notes, events or archive, and explain the next action for each."
        : "Summarize this inbox in a few lines and call out anything urgent.",
      action === "inbox_triage" ? "Triage inbox" : "Summarize inbox",
      inboxContext,
    );
  };

  const classify = (item: InboxItem) => {
    if (!gatewayEnabled) {
      setAnswer(`Local classification: “${item.title}” looks like a ${item.kind}.`);
      return;
    }
    void requestAI(
      "capture_classify",
      `Classify this capture as a task, note, event or archive: “${item.title}”. Explain briefly.`,
      "Classify capture",
      `Capture: ${item.title}\nKind: ${item.kind}\nTags: ${item.tags.join(", ")}`,
    );
  };

  return (
    <>
      <PageHeader
        icon={InboxIcon}
        title="Inbox"
        subtitle={
          inbox.length + knowledgeItems.length > 0
            ? `${inbox.length + knowledgeItems.length} ${inbox.length + knowledgeItems.length === 1 ? "item" : "items"} waiting to be decided`
            : "Everything lands here first"
        }
        actions={
          <Button variant="primary" size="sm" onClick={openCapture}>
            Capture
          </Button>
        }
      />

      <AddTaskRow placeholder="Capture without deciding — dates and tags are optional" />

      <Section title="AI triage" className="mt-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => triage("inbox_triage")}>
            Triage inbox
          </Button>
          <Button variant="ghost" size="sm" onClick={() => triage("inbox_summary")}>
            Summarize inbox
          </Button>
        </div>
        {answer ? (
          <AIAnswer
            text={answer}
            testId="inbox-ai-answer"
            className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[12px]"
          />
        ) : null}
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="inbox-ai-credits">
          {gatewayEnabled
            ? lastCharge
              ? `${lastCharge.charged} credits used · ${lastCharge.available} remaining`
              : balance
                ? `GPT 6 Luna · ${balance.available} credits available`
                : "GPT 6 Luna · charges apply"
            : "Local — no credits"}
        </p>
      </Section>

      <Section title="To triage" count={inbox.length} className="mt-6">
        {inbox.length > 0 ? (
          <TaskList tasks={inbox} onOpen={setDetailTaskId} showQuickSchedule showProject={false} />
        ) : (
          <EmptyState
            icon={InboxIcon}
            title="Inbox zero"
            description="Nothing waiting. Capture anything that crosses your mind — a task, a thought, a half-formed idea — and sort it out later."
            action={
              <Button variant="primary" size="md" onClick={openCapture}>
                Capture something
              </Button>
            }
          />
        )}
      </Section>

      <Section title="Knowledge inbox" count={knowledgeItems.length} className="mt-8">
        {knowledgeItems.length > 0 ? (
          <div className="space-y-2">
            {knowledgeItems.map((item: InboxItem) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {item.kind}
                    {item.tags.length > 0 ? ` · ${item.tags.map((t) => `#${t}`).join(" ")}` : ""}
                  </span>
                </div>
                <Badge tone="neutral">{item.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => classify(item)}
                  data-testid={`inbox-classify-${item.id}`}
                >
                  AI classify
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    os.triageInboxItem(item.id);
                  }}
                >
                  Triage
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No knowledge waiting"
            description="Web clips, documents, and recordings land here for sorting into notes, notebooks, and folders."
          />
        )}
      </Section>

      <div className="mt-8 rounded-2xl border border-dashed border-line px-5 py-4 text-sm leading-relaxed text-ink-3">
        Quick triage: give a capture a date to move it onto your calendar, or add a project to file
        it under <span className="text-ink-2">Tasks</span>. Anything with a date automatically
        becomes part of your day.
      </div>

      <TaskDetailSheet taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
      <CreditConfirmDialog
        open={pendingAI != null}
        label={pendingAI?.label ?? "AI action"}
        estimate={pendingAI?.estimate ?? null}
        busy={aiBusy}
        onClose={() => setPendingAI(null)}
        onConfirm={() => void confirmAI()}
      />
    </>
  );
}
