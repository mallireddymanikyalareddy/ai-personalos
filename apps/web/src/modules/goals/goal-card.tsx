"use client";

import * as React from "react";

import { Archive, CalendarDays, Check, MoreVertical, Pause, Pencil, Play, Trash2 } from "lucide-react";

import type { GoalCardData, GoalCategory } from "@personalos/core";
import { GOAL_CATEGORY_LABELS } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { DropdownMenu } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";
import { LifeAreaChip } from "@/components/life-area/life-area";
import { useAppState } from "@/store/use-os";

function GoalLifeArea({ goalId }: { goalId: string }) {
  const state = useAppState();
  return <LifeAreaChip lifeAreaId={state.goals[goalId]?.lifeAreaId} />;
}

import {
  formatGoalDate,
  GOAL_CATEGORY_COLOR,
  GOAL_CATEGORY_ICON,
  GOAL_CATEGORY_SOFT,
  GOAL_HEALTH_META,
} from "./goals-meta";

export function GoalCategoryBadge({ category }: { category: GoalCategory }) {
  const Icon = GOAL_CATEGORY_ICON[category];
  const color = GOAL_CATEGORY_COLOR[category];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color, backgroundColor: GOAL_CATEGORY_SOFT[category] }}
    >
      <Icon className="size-3" aria-hidden="true" />
      {GOAL_CATEGORY_LABELS[category]}
    </span>
  );
}

export interface GoalCardProps {
  card: GoalCardData;
  onOpen: () => void;
  onEdit: () => void;
  onToggleComplete: () => void;
  onToggleHold: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export function GoalCard({
  card,
  onOpen,
  onEdit,
  onToggleComplete,
  onToggleHold,
  onToggleArchive,
  onDelete,
}: GoalCardProps) {
  const Icon = GOAL_CATEGORY_ICON[card.category];
  const color = GOAL_CATEGORY_COLOR[card.category];
  const health = GOAL_HEALTH_META[card.health];
  const dueLabel = formatGoalDate(card.dueAt);
  const targetLabel = card.metricSummary
    ? `Target: ${card.metricSummary}${card.dueAt ? ` by ${dueLabel}` : ""}`
    : card.dueAt
      ? `Target date: ${dueLabel}`
      : "No target set";
  const isHeld = card.status === "on_hold";
  const isDone = card.status === "completed";
  const isArchived = card.status === "archived";

  return (
    <article
      data-testid={`goal-card-${card.id}`}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GoalCategoryBadge category={card.category} />
          <GoalLifeArea goalId={card.id} />
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 block w-full truncate text-left text-sm font-semibold text-ink hover:underline"
            aria-label={`Open goal ${card.title}`}
          >
            {card.title}
          </button>
          {card.description ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-3">{card.description}</p>
          ) : null}
        </div>

        <div className="shrink-0">
          {card.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.coverUrl} alt="" loading="lazy" className="h-16 w-20 rounded-xl object-cover" />
          ) : (
            <span
              className="grid h-16 w-20 place-items-center rounded-xl"
              style={{ backgroundColor: GOAL_CATEGORY_SOFT[card.category] }}
              aria-hidden="true"
            >
              <Icon className="size-6" style={{ color }} />
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-2">
          <ProgressBar
            value={card.progress}
            max={100}
            tone={card.progress >= 70 ? "success" : "accent"}
            className="flex-1"
          />
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">{card.progress}%</span>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-3">{targetLabel}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
          <CalendarDays className="size-3" aria-hidden="true" />
          {dueLabel}
        </span>
        <div className="flex items-center gap-1">
          <Badge tone={health.tone}>{health.label}</Badge>
          <DropdownMenu
            align="end"
            sections={[
              {
                items: [
                  { label: "Edit goal", icon: <Pencil className="size-3.5" />, onSelect: onEdit },
                  {
                    label: isDone ? "Reopen goal" : "Mark complete",
                    icon: <Check className="size-3.5" />,
                    onSelect: onToggleComplete,
                  },
                  {
                    label: isHeld ? "Resume goal" : "Put on hold",
                    icon: isHeld ? <Play className="size-3.5" /> : <Pause className="size-3.5" />,
                    onSelect: onToggleHold,
                  },
                  {
                    label: isArchived ? "Restore goal" : "Archive goal",
                    icon: <Archive className="size-3.5" />,
                    onSelect: onToggleArchive,
                  },
                ],
              },
              {
                separatorBefore: true,
                items: [
                  { label: "Delete goal", icon: <Trash2 className="size-3.5" />, danger: true, onSelect: onDelete },
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                aria-label={`Actions for ${card.title}`}
                className={cn(
                  "rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink",
                )}
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </div>
    </article>
  );
}