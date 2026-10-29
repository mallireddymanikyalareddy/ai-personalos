"use client";

import * as React from "react";

import { useToast } from "@/components/ui/toast";
import { estimateAIAction, streamAIChat, type AIEstimate } from "@/lib/ai-stream";
import { useCredits } from "@/lib/use-credits";
import { useAppState } from "@/store/use-os";

export type PendingAI = {
  action: string;
  prompt: string;
  label: string;
  context: string;
  itemCount: number;
  estimate: AIEstimate;
};

export function useAIGateway() {
  const state = useAppState();
  const { toast } = useToast();
  const { balance, reload } = useCredits(true);
  const gatewayEnabled = (state.settings.aiProvider ?? "local") === "openai";
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingAI | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lastCharge, setLastCharge] = React.useState<{ charged: number; available: number } | null>(null);

  const request = React.useCallback(
    async ({
      action,
      prompt,
      context,
      label,
      itemCount = 1,
    }: {
      action: string;
      prompt: string;
      context: string;
      label: string;
      itemCount?: number;
    }) => {
      setLastCharge(null);
      setAnswer("Pricing…");
      try {
        const estimate = await estimateAIAction(action, prompt.length + context.length, itemCount);
        if (!estimate.allowed) {
          const message = estimate.reasons.includes("PAYMENT_GRACE_EXPIRED")
            ? "AI is paused because this subscription is past due."
            : estimate.reasons.includes("INSUFFICIENT_CREDITS")
              ? `You need ${Math.max(0, estimate.minCredits - estimate.available)} more credits for this.`
              : estimate.reasons.includes("INPUT_TOO_LARGE")
                ? `This input is too large. The limit is ${estimate.maxInputTokens.toLocaleString()} tokens.`
                : estimate.reasons.includes("ACTION_LIMIT_REACHED")
                  ? "You've reached today's limit for this action."
                  : "This action is temporarily unavailable.";
          setAnswer(message);
          toast(message, { tone: "danger" });
          return false;
        }
        setPending({ action, prompt, context, label, itemCount, estimate });
        setAnswer(null);
        return true;
      } catch (err) {
        setAnswer(null);
        toast((err as Error).message, { tone: "danger" });
        return false;
      }
    },
    [toast],
  );

  const confirm = React.useCallback(async () => {
    if (!pending) return;
    const current = pending;
    setPending(null);
    setBusy(true);
    setAnswer("Thinking…");
    try {
      await streamAIChat(
        { action: current.action, prompt: current.prompt, context: current.context,
          history: [], itemCount: current.itemCount },
        setAnswer,
        (info) => {
          setLastCharge({ charged: info.charged, available: info.available });
          reload();
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
      setBusy(false);
    }
  }, [pending, reload, toast]);

  const creditsNote = gatewayEnabled
    ? lastCharge
      ? `${lastCharge.charged} credits used · ${lastCharge.available} remaining`
      : balance
        ? `GPT 6 Luna · ${balance.available} credits available`
        : "GPT 6 Luna · charges apply"
    : "Local — no credits";

  return {
    state,
    gatewayEnabled,
    balance,
    answer,
    setAnswer,
    pending,
    busy,
    lastCharge,
    request,
    confirm,
    dismiss: () => setPending(null),
    creditsNote,
  };
}
