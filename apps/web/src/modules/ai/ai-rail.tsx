"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  Lightbulb,
  ListTodo,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";

import type { AIConversation, AIContextCounts, ID, Timestamp } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";

export interface AITool {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: string;
}

export const AI_TOOLS: AITool[] = [
  { id: "plan-day", label: "Plan my day", icon: CalendarDays, tone: "bg-accent-soft text-accent-ink" },
  { id: "create-task", label: "Create tasks", icon: CheckSquare, tone: "bg-success-soft text-success" },
  { id: "break-goals", label: "Break down goals", icon: Target, tone: "bg-accent-soft text-accent-ink" },
  { id: "summarize-note", label: "Summarize notes", icon: NotebookPen, tone: "bg-info-soft text-info" },
  { id: "optimize-schedule", label: "Analyze schedule", icon: BarChart3, tone: "bg-warning-soft text-warning" },
  { id: "recommend", label: "Generate ideas", icon: Lightbulb, tone: "bg-danger-soft text-danger" },
];

export function AIToolsPanel({
  activeId,
  onRun,
  expanded,
  onToggleExpanded,
  extraTools,
}: {
  activeId: string | null;
  onRun: (tool: AITool) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  extraTools: AITool[];
}) {
  const tools = expanded ? [...AI_TOOLS, ...extraTools] : AI_TOOLS;

  return (
    <section
      aria-label="AI Tools"
      data-testid="ai-tools"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI Tools
        </h2>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="text-xs font-medium text-accent-ink hover:underline"
          data-testid="ai-tools-view-all"
        >
          {expanded ? "Show less" : "View all"}
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const active = tool.id === activeId;
          return (
            <button
              key={tool.id}
              type="button"
              data-testid={`ai-tool-${tool.id}`}
              onClick={() => onRun(tool)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${
                active ? "border-accent bg-accent-soft" : "border-line bg-surface-2/60 hover:border-line-strong hover:bg-surface-2"
              }`}
            >
              <span className={`grid size-8 place-items-center rounded-lg ${tool.tone}`} aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <span className="text-center text-[11px] font-medium leading-tight text-ink-2">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface ContextRow {
  id: string;
  label: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: string;
}

export function AIContextPanel({ counts }: { counts: AIContextCounts }) {
  const rows: ContextRow[] = [
    {
      id: "calendar",
      label: "Calendar",
      detail: counts.todayMeetings > 0 ? `${counts.todayMeetings} meetings today` : `${counts.todayEvents} events today`,
      href: "/calendar",
      icon: CalendarDays,
      tone: "bg-danger-soft text-danger",
    },
    {
      id: "tasks",
      label: "Tasks",
      detail:
        counts.overdueTasks > 0
          ? `${counts.overdueTasks} overdue · ${counts.openTasks} pending`
          : `${counts.openTasks} pending tasks`,
      href: "/tasks",
      icon: CheckSquare,
      tone: "bg-accent-soft text-accent-ink",
    },
    {
      id: "goals",
      label: "Goals",
      detail: `${counts.activeGoals} active goals`,
      href: "/goals",
      icon: Target,
      tone: "bg-success-soft text-success",
    },
    {
      id: "habits",
      label: "Habits",
      detail: `${counts.activeHabits} habits this week`,
      href: "/habits",
      icon: RefreshCw,
      tone: "bg-info-soft text-info",
    },
    {
      id: "notes",
      label: "Notes",
      detail: `${counts.notes} notes`,
      href: "/notes",
      icon: FileText,
      tone: "bg-warning-soft text-warning",
    },
  ];

  return (
    <section
      aria-label="Your context"
      data-testid="ai-context"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Settings2 className="size-4 text-accent-ink" aria-hidden="true" />
          Your context
        </h2>
      </header>

      <ul className="space-y-0.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.id}>
              <a
                href={row.href}
                data-testid={`ai-context-${row.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
              >
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${row.tone}`} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">{row.label}</span>
                  <span className="block truncate text-[11px] text-ink-3">{row.detail}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export interface ConversationRow {
  id: ID;
  title: string;
  at: Timestamp;
  pinned: boolean;
}

export function AIConversationsPanel({
  conversations,
  activeId,
  onOpen,
  onNew,
  onRename,
  onDelete,
  onPin,
  limit,
}: {
  conversations: ConversationRow[];
  activeId: ID | null;
  onOpen: (id: ID) => void;
  onNew: () => void;
  onRename?: (id: ID) => void;
  onDelete?: (id: ID) => void;
  onPin?: (id: ID) => void;
  limit: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const filtered = query.trim().length
    ? conversations.filter((conversation) =>
        conversation.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : conversations;
  const rows = expanded ? filtered : filtered.slice(0, limit);

  return (
    <section
      aria-label="Recent conversations"
      data-testid="ai-conversations"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Clock className="size-4 text-accent-ink" aria-hidden="true" />
          Recent conversations
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-xs font-medium text-accent-ink hover:underline"
        >
          {expanded ? "Show less" : "View all"}
        </button>
      </header>

      <div className="relative mb-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="h-8 text-[12px]"
        />
      </div>

      {conversations.length === 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-3">No conversations yet. Ask something to start one.</p>
          <Button variant="secondary" size="sm" onClick={onNew}>
            <MessageSquare className="size-3.5" aria-hidden="true" />
            New conversation
          </Button>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((conversation) => (
            <li key={conversation.id} className="group relative">
              <button
                type="button"
                data-testid="ai-conversation-row"
                onClick={() => onOpen(conversation.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg py-2 pl-2 pr-8 text-left transition-colors hover:bg-surface-2 ${
                  conversation.id === activeId ? "bg-accent-soft" : ""
                }`}
              >
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3"
                  aria-hidden="true"
                >
                  <MessageSquare className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">
                    {conversation.pinned ? "📌 " : ""}
                    {conversation.title}
                  </span>
                  <span className="block text-[11px] text-ink-3">{relativeTime(conversation.at)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              </button>
              {onRename || onDelete ? (
                <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <DropdownMenu
                    align="end"
                    sections={[
                      {
                        label: conversation.title,
                        items: [
                          ...(onRename ? [{ label: "Rename", onSelect: () => onRename(conversation.id) }] : []),
                          ...(onPin
                            ? [{
                                label: conversation.pinned ? "Unpin conversation" : "Pin conversation",
                                onSelect: () => onPin(conversation.id),
                              }]
                            : []),
                          ...(onDelete
                            ? [{ label: "Delete conversation", danger: true, onSelect: () => onDelete(conversation.id) }]
                            : []),
                        ],
                      },
                    ]}
                    trigger={
                      <button
                        type="button"
                        aria-label={`Options for ${conversation.title}`}
                        className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
                      >
                        <MoreHorizontal className="size-3.5" aria-hidden="true" />
                      </button>
                    }
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function relativeTime(at: Timestamp, now: number = Date.now()): string {
  const DAY = 86_400_000;
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(at),
  );
  const today = new Date(now);
  const target = new Date(at);
  const sameDay = today.toDateString() === target.toDateString();
  if (sameDay) return `Today, ${time}`;
  if (target.getTime() > now - 2 * DAY) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(at),
  );
}

export function conversationRows(conversations: AIConversation[]): ConversationRow[] {
  return [...conversations]
    .sort((a, b) => {
      const pinnedDiff = (b.pinnedAt != null ? 1 : 0) - (a.pinnedAt != null ? 1 : 0);
      if (pinnedDiff !== 0) return pinnedDiff;
      return (b.lastMessageAt ?? b.updatedAt) - (a.lastMessageAt ?? a.updatedAt);
    })
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title || "New conversation",
      at: conversation.lastMessageAt ?? conversation.updatedAt,
      pinned: conversation.pinnedAt != null,
    }));
}

export const EXTRA_AI_TOOLS: AITool[] = [
  { id: "create-note", label: "Create a note", icon: FileText, tone: "bg-success-soft text-success" },
  { id: "weekly-review", label: "Weekly review", icon: ListTodo, tone: "bg-info-soft text-info" },
  { id: "insights", label: "My insights", icon: FolderKanban, tone: "bg-accent-soft text-accent-ink" },
  { id: "search-notes", label: "Search notes", icon: NotebookPen, tone: "bg-success-soft text-success" },
  { id: "reschedule", label: "Reschedule", icon: CalendarDays, tone: "bg-warning-soft text-warning" },
];
