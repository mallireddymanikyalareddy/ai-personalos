"use client";

import * as React from "react";

import Link from "next/link";

import { CalendarClock, ListChecks, NotebookPen, Sparkles, Target } from "lucide-react";

import type { AIObject, AIResult, ID } from "@personalos/core";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { aiProvider, AI_PROVIDERS } from "@personalos/core";
import { useAppState, useOS } from "@/store/use-os";
import { buildAIContext, streamAIChat, type ChatTurn } from "@/lib/ai-stream";
import { useCredits } from "@/lib/use-credits";

import { AIChat, type ChatEntry, type ChatSuggestion } from "./ai-chat";
import { AIActionCatalog } from "./action-catalog";
import { useSpeechInput } from "./use-speech";
import { AIFeatureCards, AIHero, defaultAIFeatures, type AIFeature } from "./ai-hero";
import {
  AIContextPanel,
  AIConversationsPanel,
  AIToolsPanel,
  conversationRows,
  EXTRA_AI_TOOLS,
  type AITool,
} from "./ai-rail";

function newId(): string {
  return `msg-${Math.random().toString(36).slice(2, 10)}`;
}

export function AIModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [entries, setEntries] = React.useState<ChatEntry[]>([]);
  const [draft, setDraft] = React.useState("");
  const [activeId, setActiveId] = React.useState<ID | null>(null);
  const [activeTool, setActiveTool] = React.useState<string | null>(null);
  const [toolsExpanded, setToolsExpanded] = React.useState(false);
  const [confirmPrompt, setConfirmPrompt] = React.useState<string | null>(null);
  const skipConfirm = React.useRef(false);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const { balance, flags } = useCredits(true);
  const [actionPrice, setActionPrice] = React.useState<{
    label: string;
    minCredits: number;
    maxCredits: number;
    maxInputTokens: number;
    maxOutputTokens: number;
  } | null>(null);
  const [complexPrice, setComplexPrice] = React.useState<{
    label: string;
    minCredits: number;
    maxCredits: number;
    maxInputTokens: number;
    maxOutputTokens: number;
  } | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/plans", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { actions?: { action: string; label: string; minCredits: number; maxCredits: number; maxInputTokens?: number; maxOutputTokens?: number }[] } | null) => {
        const price = data?.actions?.find((item) => item.action === "quick_question");
        const complex = data?.actions?.find((item) => item.action === "complex_planning");
        if (alive && price) {
          setActionPrice({
            label: price.label,
            minCredits: price.minCredits,
            maxCredits: price.maxCredits,
            maxInputTokens: price.maxInputTokens ?? 0,
            maxOutputTokens: price.maxOutputTokens ?? 0,
          });
        }
        if (alive && complex) {
          setComplexPrice({
            label: complex.label,
            minCredits: complex.minCredits,
            maxCredits: complex.maxCredits,
            maxInputTokens: complex.maxInputTokens ?? 0,
            maxOutputTokens: complex.maxOutputTokens ?? 0,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const now = Date.now();
  const context = os.aiContext(now);
  const conversations = conversationRows(state.aiConversations ? Object.values(state.aiConversations) : []);
  const greetingName = state.profile?.displayName?.split(" ")[0] || "there";
  const firstGoal = Object.values(state.goals).find((goal) => goal.status === "active");
  const pendingProposals = os.aiPendingProposals();
  const providerId = state.settings.aiProvider ?? "local";
  const provider = aiProvider(providerId);
  const feedbackSummary = os.aiFeedbackSummary();

  const ensureConversation = React.useCallback(
    (title?: string) => {
      const existing = activeId != null ? state.aiConversations[activeId] : null;
      if (existing) return existing;
      const created = os.addConversation({ title: title ?? "New conversation" });
      setActiveId(created.id);
      return created;
    },
    [activeId, state.aiConversations, os],
  );

  const run = React.useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (trimmed.length === 0) return;
      const action = trimmed.toLowerCase().startsWith("complex plan") ? "complex_planning" : "quick_question";
      if (flags.ai_confirmation_modal && providerId === "openai" && !skipConfirm.current) {
        setConfirmPrompt(trimmed);
        return;
      }
      skipConfirm.current = false;

      const conversation = ensureConversation(trimmed.slice(0, 64));
      const userMessage = os.addMessage({ conversationId: conversation.id, role: "user", content: trimmed });

      const result = os.aiRun(trimmed, { now });
      const proposals: AIObject[] = result.proposals
        .map((proposal) => os.aiSaveProposal(proposal, now))
        .filter((object): object is AIObject => object != null);

      const assistantMessage = os.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        model: provider.label,
        content: result.message,
        refs: [
          ...result.citations.map(({ entityType, entityId }) => ({ entityType, entityId })),
          ...proposals.map((proposal) => ({ entityType: "ai_object" as const, entityId: proposal.id })),
        ],
        result: {
          kind: result.kind,
          capability: result.capability,
          citations: result.citations,
          ...(result.data !== undefined ? { data: result.data } : {}),
        },
      });

      setEntries((prev) => [
        ...prev,
        { id: userMessage.id, role: "user", text: trimmed, at: now, messageId: userMessage.id },
        {
          id: assistantMessage.id,
          role: "assistant",
          text: result.message,
          result,
          proposals,
          at: now,
          messageId: assistantMessage.id,
          feedback: null,
        },
      ]);
      setDraft("");
      if (result.kind === "proposal" && proposals.length > 0) {
        toast(`${proposals.length} proposal${proposals.length === 1 ? "" : "s"} ready to review`);
      }
      if (providerId === "openai") {
        const history: ChatTurn[] = entries.slice(-10).map((entry) => ({ role: entry.role, text: entry.text }));
        const setText = (text: string) =>
          setEntries((prev) => prev.map((entry) => (entry.id === assistantMessage.id ? { ...entry, text } : entry)));
        setText("Thinking…");
        streamAIChat(
          { prompt: trimmed, context: buildAIContext(os.getState(), result.message), history, action },
          setText,
          (info) =>
            setEntries((prev) =>
              prev.map((entry) =>
                entry.id === assistantMessage.id
                  ? { ...entry, credits: { charged: info.charged, available: info.available } }
                  : entry,
              ),
            ),
        )
          .then((text) => os.updateMessage(assistantMessage.id, { content: text }))
          .catch((error: Error) => {
            setText(result.message);
            toast(`GPT 6 Luna unavailable: ${error.message}`);
          });
      }
    },
    [ensureConversation, now, os, toast, provider.label, providerId, entries, flags.ai_confirmation_modal],
  );

  const suggestions: ChatSuggestion[] = React.useMemo(() => {
    const list: ChatSuggestion[] = [
      {
        id: "plan",
        label:
          context.counts.todayTasks > 0
            ? `Plan my day based on ${context.counts.todayTasks} tasks due today`
            : "Plan my day based on my calendar and tasks",
        prompt: "plan my day",
        icon: CalendarClock,
      },
      {
        id: "goal",
        label: firstGoal != null ? `Break down my goal: ${firstGoal.title}` : "Break down a goal into steps",
        prompt: firstGoal != null ? `break down my goal: ${firstGoal.title}` : "break down my goal",
        icon: Target,
      },
      {
        id: "prioritise",
        label: "Help me prioritise what to work on this week",
        prompt: "what should I work on",
        icon: ListChecks,
      },
      {
        id: "progress",
        label: "How am I doing this week?",
        prompt: "how am I doing",
        icon: NotebookPen,
      },
      {
        id: "complex",
        label: "Create a complex multi-step plan",
        prompt: "complex plan my next 30 days",
        icon: Sparkles,
      },
    ];
    return list;
  }, [context.counts.todayTasks, firstGoal]);

  const features = React.useMemo(() => defaultAIFeatures(firstGoal?.title ?? null), [firstGoal?.title]);

  const runFeature = (feature: AIFeature) => {
    if (feature.id === "plan-day") return run("plan my day");
    if (feature.id === "break-goals") {
      return run(firstGoal != null ? `break down my goal: ${firstGoal.title}` : "break down my goal");
    }
    if (feature.id === "scheduling") return run("optimize my schedule");
    return run("my insights");
  };

  const prefill = (value: string) => {
    setDraft(value);
    setActiveTool(null);
    composerRef.current?.focus();
  };

  const runTool = (tool: AITool) => {
    setActiveTool(tool.id);
    if (tool.id === "plan-day") return run("plan my day");
    if (tool.id === "create-task") return prefill("add a task: ");
    if (tool.id === "break-goals") {
      return run(firstGoal != null ? `break down my goal: ${firstGoal.title}` : "break down my goal");
    }
    if (tool.id === "summarize-note") return prefill("summarize my note about ");
    if (tool.id === "optimize-schedule") return run("optimize my schedule");
    if (tool.id === "weekly-review") return run("review my week");
    if (tool.id === "insights") return run("my insights");
    if (tool.id === "search-notes") return prefill("search my notes for ");
    if (tool.id === "create-note") return prefill("note: ");
    if (tool.id === "reschedule") return run("reschedule my week");
    return run("what should I work on");
  };

  const onMore = (id: string) => {
    if (id === "proposals" && pendingProposals.length > 0) {
      const conversation = ensureConversation("Pending proposals");
      const content = `${pendingProposals.length} proposal${pendingProposals.length === 1 ? " is" : "s are"} waiting for your review.`;
      os.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        content,
        refs: pendingProposals.map((proposal) => ({ entityType: "ai_object", entityId: proposal.id })),
      });
      setEntries((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: content,
          proposals: pendingProposals,
          at: now,
        },
      ]);
      return;
    }
    if (id === "weekly-review") return run("review my week");
    if (id === "insights") return run("my insights");
    if (id === "clear") {
      if (activeId != null) os.clearConversation(activeId, now);
      setEntries([]);
      setDraft("");
      toast("Conversation cleared");
      return;
    }
    const created = os.addConversation({ title: "New conversation" });
    setActiveId(created.id);
    setEntries([]);
    setDraft("");
    toast("New conversation started");
  };

  const regenerate = () => {
    const lastAssistantIndex = entries.map((entry) => entry.role).lastIndexOf("assistant");
    if (lastAssistantIndex < 0) return;
    const lastAssistant = entries[lastAssistantIndex]!;
    const prompt = [...entries.slice(0, lastAssistantIndex)]
      .reverse()
      .find((entry) => entry.role === "user")?.text;
    if (!prompt) return;

    const conversation = ensureConversation(prompt.slice(0, 64));
    const result = os.aiRun(prompt, { now });
    const proposals: AIObject[] = result.proposals
      .map((proposal) => os.aiSaveProposal(proposal, now))
      .filter((object): object is AIObject => object != null);
    const refs = [
      ...result.citations.map(({ entityType, entityId }) => ({ entityType, entityId })),
      ...proposals.map((proposal) => ({ entityType: "ai_object" as const, entityId: proposal.id })),
    ];
    const resultMeta = {
      kind: result.kind,
      capability: result.capability,
      citations: result.citations,
      ...(result.data !== undefined ? { data: result.data } : {}),
    };

    for (const proposal of lastAssistant.proposals ?? []) os.aiDismissProposal(proposal.id, now);

    let messageId = lastAssistant.messageId;
    if (messageId) {
      os.updateMessage(messageId, {
        content: result.message,
        refs,
        result: resultMeta,
        model: provider.label,
        feedback: null,
      });
    } else {
      const stored = os.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        model: provider.label,
        content: result.message,
        refs,
        result: resultMeta,
      });
      messageId = stored.id;
    }

    setEntries((prev) =>
      prev.map((entry, index) =>
        index === lastAssistantIndex
          ? {
              ...entry,
              id: messageId!,
              messageId,
              text: result.message,
              result,
              proposals,
              feedback: null,
            }
          : entry,
      ),
    );
    toast("Answer regenerated");
  };

  const setFeedback = (entry: ChatEntry, value: "up" | "down" | null) => {
    if (!entry.messageId) return;
    os.setMessageFeedback(entry.messageId, value);
    setEntries((prev) =>
      prev.map((item) => (item.id === entry.id ? { ...item, feedback: value } : item)),
    );
  };

  const submitVoice = (text: string) => {
    run(text);
  };

  const voice = useSpeechInput({
    onTranscript: submitVoice,
    onUnsupported: () => toast("Voice input is not supported in this browser"),
    onError: () => toast("Voice input stopped — check microphone permissions"),
  });

  const openConversation = (id: ID) => {
    setActiveId(id);
    setDraft("");
    const messages = Object.values(state.aiMessages)
      .filter((message) => message.conversationId === id)
      .sort((a, b) => a.createdAt - b.createdAt);
    setEntries(
      messages.map((message) => ({
        id: message.id,
        role: message.role === "user" ? "user" : "assistant",
        text: message.content,
        at: message.createdAt,
        messageId: message.id,
        feedback: message.feedback ?? null,
        result: message.result
          ? ({
              ...message.result,
              message: message.content,
              capability: message.result.capability as AIResult["capability"],
              proposals: [],
            } satisfies AIResult)
          : undefined,
        proposals: message.role === "assistant"
          ? message.refs
              .filter((ref) => ref.entityType === "ai_object")
              .map((ref) => state.aiObjects[ref.entityId])
              .filter((object): object is AIObject => object != null)
          : undefined,
      })),
    );
  };

  const complex = confirmPrompt?.toLowerCase().startsWith("complex plan") ?? false;
  const price = (complex ? complexPrice : actionPrice) ?? actionPrice ?? {
    label: "Quick AI question",
    minCredits: 1,
    maxCredits: 1,
    maxInputTokens: 0,
    maxOutputTokens: 0,
  };
  const available = balance?.available ?? 0;
  const aiAllowed = balance?.aiAllowed !== false;
  const enough = aiAllowed && available >= price.minCredits;

  return (
    <div className="space-y-4">
      {!aiAllowed && (
        <div
          data-testid="ai-past-due"
          className="rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          AI is paused because this subscription is past due. Your data and non-AI
          features still work.{" "}
          <Link href="/plans" className="underline underline-offset-2">
            Update your plan
          </Link>
          .
        </div>
      )}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <AIHero />
          <AIFeatureCards features={features} onRun={runFeature} />
          <AIChat
            greetingName={greetingName}
            entries={entries}
            suggestions={suggestions}
            draft={draft}
            onDraftChange={setDraft}
            onSend={() => run(draft)}
            onRunChip={run}
            onMore={onMore}
            composerRef={composerRef}
            pendingProposalCount={pendingProposals.length}
            onRegenerate={regenerate}
            onFeedback={setFeedback}
            onVoice={voice.supported ? (voice.listening ? voice.stop : voice.start) : () => toast("Voice input is not supported in this browser")}
            voiceListening={voice.listening}
            feedbackSummary={feedbackSummary}
            modelControl={
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Model",
                    items: AI_PROVIDERS.map((option) => ({
                      label: option.available ? option.label : `${option.label} (needs API key)`,
                      selected: option.id === providerId,
                      disabled: !option.available,
                      onSelect: () => {
                        os.updateSettings({ aiProvider: option.id });
                        toast(option.available ? `${option.label} selected` : (option.reason ?? "Not available yet"));
                      },
                    })),
                  },
                ]}
                trigger={
                  <button
                    type="button"
                    aria-label="Choose AI model"
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  >
                    {provider.label}
                  </button>
                }
              />
            }
            onAcceptProposal={(id) => {
              const result = os.aiAcceptProposal(id, now);
              const updated = os.getState().aiObjects[id];
              if (updated) {
                setEntries((prev) => prev.map((entry) => ({
                  ...entry,
                  proposals: entry.proposals?.map((proposal) => proposal.id === id ? updated : proposal),
                })));
              }
              toast(result.ok ? "Proposal applied" : result.message);
            }}
            onDismissProposal={(id) => {
              os.aiDismissProposal(id);
              const updated = os.getState().aiObjects[id];
              if (updated) {
                setEntries((prev) => prev.map((entry) => ({
                  ...entry,
                  proposals: entry.proposals?.map((proposal) => proposal.id === id ? updated : proposal),
                })));
              }
              toast("Proposal dismissed");
            }}
          />
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Assistant tools">
          <AIToolsPanel
            activeId={activeTool}
            onRun={runTool}
            expanded={toolsExpanded}
            onToggleExpanded={() => setToolsExpanded((value) => !value)}
            extraTools={EXTRA_AI_TOOLS}
          />
          <AIContextPanel counts={context.counts} />
          <AIConversationsPanel
            conversations={conversations}
            activeId={activeId}
            onOpen={openConversation}
            onNew={onMore.bind(null, "new") as () => void}
            onPin={(id) => {
              const conversation = state.aiConversations[id];
              if (!conversation) return;
              os.pinConversation(id, conversation.pinnedAt == null, now);
              toast(conversation.pinnedAt == null ? "Conversation pinned" : "Conversation unpinned");
            }}
            onRename={(id) => {
              const conversation = state.aiConversations[id];
              if (!conversation) return;
              const next = window.prompt("Rename conversation", conversation.title);
              if (next == null) return;
              os.renameConversation(id, next, now);
              toast("Conversation renamed");
            }}
            onDelete={(id) => {
              os.deleteConversation(id);
              if (activeId === id) {
                setActiveId(null);
                setEntries([]);
              }
              toast("Conversation deleted");
            }}
            limit={4}
          />
        </aside>
      </div>

      <AIActionCatalog />

      <p className="text-center text-[11px] leading-relaxed text-ink-3">
        Everything I use comes from your own data on this device. I only read what you can see, I
        never delete anything, and anything that changes your data needs your confirmation first.
      </p>

      <ConfirmDialog
        open={confirmPrompt != null}
        onClose={() => setConfirmPrompt(null)}
        onConfirm={() => {
          const prompt = confirmPrompt;
          setConfirmPrompt(null);
          if (!prompt) return;
          skipConfirm.current = true;
          run(prompt);
        }}
        title="Use AI credits?"
        description={`${actionPrice?.label ?? "Quick AI question"} — this answer uses credits from your balance.`}
        confirmLabel={enough ? "Use credits" : "Not enough credits"}
        confirmDisabled={!enough}
        tone="accent"
      >
        <dl className="mt-3 space-y-1.5 text-xs" data-testid="ai-confirm-cost">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Estimated cost</dt>
            <dd className="font-medium text-ink">
              {price.minCredits === price.maxCredits
                ? `${price.minCredits} credit${price.minCredits === 1 ? "" : "s"}`
                : `${price.minCredits}–${price.maxCredits} credits`}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Current balance</dt>
            <dd className="font-medium text-ink">{available}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Expected remaining</dt>
            <dd className="font-medium text-ink">{Math.max(0, available - price.maxCredits)}</dd>
          </div>
          {price.maxInputTokens > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Input limit</dt>
              <dd className="font-medium text-ink">{price.maxInputTokens.toLocaleString()} tokens</dd>
            </div>
          )}
          {price.maxOutputTokens > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Output limit</dt>
              <dd className="font-medium text-ink">{price.maxOutputTokens.toLocaleString()} tokens</dd>
            </div>
          )}
        </dl>
        {!aiAllowed ? (
          <p
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300"
            data-testid="ai-confirm-past-due"
          >
            AI is paused because the subscription is past due. Update payment or plan
            to continue. Non-AI features still work.
          </p>
        ) : (
          !enough && (
            <p
              className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
              data-testid="ai-confirm-shortfall"
            >
              You need {price.minCredits - available} more credit
              {price.minCredits - available === 1 ? "" : "s"}.{" "}
              <Link href="/plans" className="underline underline-offset-2">
                Upgrade or wait for your reset
              </Link>
              . Non-AI features keep working.
            </p>
          )
        )}
      </ConfirmDialog>
    </div>
  );
}
