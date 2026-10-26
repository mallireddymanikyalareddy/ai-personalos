import * as React from "react";

import { Bot, Check, X } from "lucide-react";

import type { AIObject } from "@personalos/core";

import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const KIND_LABELS: Record<AIObject["kind"], string> = {
  suggestion: "Suggestion",
  plan: "Plan",
  summary: "Summary",
  insight: "Insight",
  draft: "Draft",
  answer: "Answer",
};

const KIND_TONES: Record<AIObject["kind"], BadgeTone> = {
  suggestion: "accent",
  plan: "accent",
  summary: "outline",
  insight: "success",
  draft: "warning",
  answer: "accent",
};

export interface AIObjectCardProps {
  object: AIObject;
  onAccept?: () => void;
  onDismiss?: () => void;
  onOpen?: () => void;
  className?: string;
}

export function AIObjectCard({ object, onAccept, onDismiss, onOpen, className }: AIObjectCardProps) {
  const pending = object.status === "pending";
  const created = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    object.createdAt,
  );
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop",
        className,
      )}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
        <Bot className="size-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            disabled={!onOpen}
            className={cn(
              "min-w-0 truncate text-sm font-semibold tracking-tight text-ink",
              onOpen && "hover:text-accent-ink",
            )}
          >
            {object.title}
          </button>
          <Badge tone={KIND_TONES[object.kind]} className="shrink-0">
            {KIND_LABELS[object.kind]}
          </Badge>
        </div>
        {object.body && (
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-3">{object.body}</p>
        )}
        <div className="mt-2.5 flex items-center gap-2 text-xs text-ink-3">
          <span>{created}</span>
          {object.model && <span>· {object.model}</span>}
          {object.refs.length > 0 && (
            <span>
              · {object.refs.length} {object.refs.length === 1 ? "reference" : "references"}
            </span>
          )}
        </div>
        {pending && (onAccept || onDismiss) && (
          <div className="mt-3 flex items-center gap-2">
            {onAccept && (
              <Button type="button" size="sm" variant="primary" onClick={onAccept}>
                <Check className="size-3.5" aria-hidden="true" />
                Accept
              </Button>
            )}
            {onDismiss && (
              <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
                <X className="size-3.5" aria-hidden="true" />
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}