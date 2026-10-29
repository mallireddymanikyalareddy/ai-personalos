"use client";

import * as React from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AIEstimate } from "@/lib/ai-stream";

export function CreditConfirmDialog({
  open,
  label,
  estimate,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  label: string;
  estimate: AIEstimate | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const reason = estimate?.reasons.includes("PAYMENT_GRACE_EXPIRED")
    ? "AI is paused because the subscription is past due."
    : estimate?.reasons.includes("INSUFFICIENT_CREDITS")
      ? `You need ${Math.max(0, estimate.minCredits - estimate.available)} more credits.`
      : estimate?.reasons.includes("INPUT_TOO_LARGE")
        ? `Reduce the input to ${estimate.maxInputTokens.toLocaleString()} tokens or fewer.`
        : estimate?.reasons.includes("ACTION_LIMIT_REACHED")
          ? `You've reached today's limit for this action.`
          : "This action is temporarily unavailable.";
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Use AI credits?"
      description={`${label} — this answer uses credits from your balance.`}
      confirmLabel={estimate?.allowed ? "Use credits" : "Not enough credits"}
      confirmDisabled={!estimate?.allowed || busy}
      busy={busy}
      tone="accent"
    >
      {estimate && (
        <div className="mt-3 space-y-2 text-xs" data-testid="ai-credit-confirm">
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Estimated cost</dt>
              <dd className="font-medium text-ink">
                {estimate.minCredits === estimate.maxCredits
                  ? `${estimate.minCredits} credit${estimate.minCredits === 1 ? "" : "s"}`
                  : `${estimate.minCredits}–${estimate.maxCredits} credits`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Current balance</dt>
              <dd className="font-medium text-ink">{estimate.available}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Expected remaining</dt>
              <dd className="font-medium text-ink">{estimate.expectedRemaining}</dd>
            </div>
            {estimate.maxInputTokens > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Input limit</dt>
                <dd className="font-medium text-ink">
                  {estimate.maxInputTokens.toLocaleString()} tokens
                </dd>
              </div>
            )}
            {estimate.maxOutputTokens > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Output limit</dt>
                <dd className="font-medium text-ink">
                  {estimate.maxOutputTokens.toLocaleString()} tokens
                </dd>
              </div>
            )}
            {estimate.dailyLimit > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Daily limit</dt>
                <dd className="font-medium text-ink">
                  {estimate.dailyUsed}/{estimate.dailyLimit} used
                </dd>
              </div>
            )}
          </dl>
          {estimate.reasons.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {reason}
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}
