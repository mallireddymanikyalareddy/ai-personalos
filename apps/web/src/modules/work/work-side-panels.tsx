"use client";

import * as React from "react";

import {
  CheckCircle2,
  Flag,
  ListChecks,
  MessageSquare,
  PlayCircle,
  Plus,
  PlusCircle,
  Rocket,
} from "lucide-react";

import { relativeTime, type TeamMemberView, type WorkActivityEntry } from "@personalos/core";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const ACTIVITY_ICON: Record<
  WorkActivityEntry["kind"],
  React.ComponentType<{ className?: string }>
> = {
  task_completed: CheckCircle2,
  task_started: PlayCircle,
  task_created: PlusCircle,
  task_review: MessageSquare,
  milestone_completed: Flag,
  milestone_created: Flag,
  project_created: Rocket,
};

const ACTIVITY_TONE: Record<WorkActivityEntry["kind"], string> = {
  task_completed: "text-success",
  task_started: "text-info",
  task_created: "text-ink-3",
  task_review: "text-warning",
  milestone_completed: "text-success",
  milestone_created: "text-ink-3",
  project_created: "text-accent",
};

export function WorkTeam({
  team,
  onAddMember,
}: {
  team: TeamMemberView[];
  onAddMember?: () => void;
}) {
  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Team members"
      data-testid="work-team"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <ListChecks className="size-3.5 text-ink-3" aria-hidden="true" />
          Team members
        </h2>
        <div className="flex items-center gap-2">
          {onAddMember ? (
            <button
              type="button"
              data-testid="add-member"
              onClick={onAddMember}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
            >
              <Plus className="size-3" aria-hidden="true" />
              Add
            </button>
          ) : null}
          <a href="/workmode" className="text-[11px] font-medium text-accent-ink hover:underline">
            Manage
          </a>
        </div>
      </div>

      {team.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-ink-3">
            No members yet. Assign a task to someone, or add a workspace member, and they will
            appear here.
          </p>
          {onAddMember ? (
            <button
              type="button"
              onClick={onAddMember}
              className="text-[11px] font-medium text-accent-ink hover:underline"
            >
              Add the first member
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {team.map((entry) => (
            <li key={entry.member.id} className="flex items-center gap-2">
              <Avatar name={entry.displayName} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{entry.displayName}</span>
                <span className="block text-[11px] capitalize text-ink-3">
                  {entry.role}
                  {entry.taskCount > 0 ? ` · ${entry.taskCount} task${entry.taskCount === 1 ? "" : "s"}` : ""}
                </span>
              </span>
              <Badge tone={entry.role === "owner" ? "accent" : "outline"}>{entry.role}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WorkActivity({ entries }: { entries: WorkActivityEntry[] }) {
  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Recent activity"
      data-testid="work-activity"
    >
      <h2 className="mb-2 text-sm font-semibold text-ink">Recent activity</h2>

      {entries.length === 0 ? (
        <p className="text-xs text-ink-3">Nothing recorded in the last 60 days yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const Icon = ACTIVITY_ICON[entry.kind];
            return (
              <li key={entry.id} className="flex gap-2">
                <Icon
                  className={cn("mt-0.5 size-3.5 shrink-0", ACTIVITY_TONE[entry.kind])}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs leading-snug text-ink-2">
                    <span className="font-medium text-ink">{entry.title}</span> {entry.detail}
                  </span>
                  <span className="block text-[11px] text-ink-3">{relativeTime(entry.at)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}