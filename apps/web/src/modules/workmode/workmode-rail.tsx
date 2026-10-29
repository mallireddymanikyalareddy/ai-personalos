"use client";

import * as React from "react";

import { ModelLabel } from "@/components/ai/model-label";

import type { LucideIcon } from "lucide-react";

import {
  BarChart3,
  CalendarPlus,
  ClipboardList,
  FileText,
  Lightbulb,
  Mail,
  MessageSquare,
  NotebookPen,
  Play,
  Search,
  Settings,
  Sparkles,
  Square,
  Target,
  Timer,
} from "lucide-react";

import type { ID, Project } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAIGateway } from "@/lib/use-ai-gateway";
import { useOS } from "@/store/use-os";

const ASSISTANT_ACTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "summarize", label: "Summarize meeting", icon: MessageSquare },
  { id: "draft", label: "Draft email", icon: Mail },
  { id: "explain", label: "Explain ticket", icon: Lightbulb },
  { id: "tasks", label: "Prioritise tasks", icon: ClipboardList },
  { id: "report", label: "Generate report", icon: BarChart3 },
  { id: "find", label: "Find information", icon: Search },
  { id: "standup", label: "Draft standup", icon: NotebookPen },
  { id: "brief", label: "Meeting brief", icon: CalendarPlus },
  { id: "focus", label: "Plan focus", icon: Timer },
];

const QUICK_ACTIONS: { id: string; label: string; shortcut: string; icon: LucideIcon }[] = [
  { id: "task", label: "Create a new task", shortcut: "Alt + T", icon: ClipboardList },
  { id: "meeting", label: "Schedule a meeting", shortcut: "Alt + M", icon: CalendarPlus },
  { id: "document", label: "Create a document", shortcut: "Alt + D", icon: FileText },
  { id: "note", label: "Capture a note", shortcut: "Alt + N", icon: NotebookPen },
  { id: "ask", label: "Ask AI", shortcut: "Alt + K", icon: Sparkles },
];

interface TaskInput {
  id: ID;
  title: string;
  done: boolean;
  tags: string[];
}

export function WorkModeRail({
  askDraft,
  onAskDraftChange,
  tasks,
  meetings,
  projects,
  documents,
  focusWeekMinutes,
  focusWeekRatio,
  focusWeekSessions,
  onCreateTask,
  onLoadDefaults,
}: {
  askDraft: string;
  onAskDraftChange: (value: string) => void;
  tasks: TaskInput[];
  meetings: { id: ID; title: string }[];
  projects: Project[];
  documents: { id: ID; title: string }[];
  focusWeekMinutes: number;
  focusWeekRatio: number;
  focusWeekSessions: number;
  onCreateTask: () => void;
  onLoadDefaults: () => void;
}) {
  const os = useOS();
  const { toast } = useToast();
  const ai = useAIGateway();

  const answer = ai.answer;
  const setAnswer = ai.setAnswer;
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [endsAt, setEndsAt] = React.useState<number | null>(null);
  const [remaining, setRemaining] = React.useState(25 * 60_000);
  const [preset, setPreset] = React.useState("Pomodoro");
  const [paused, setPaused] = React.useState(false);

  const presetMinutes = preset === "Deep work" ? 50 : preset === "Quick focus" ? 15 : 25;

  const askRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const active = os.activeFocusSession();
    if (!active) return;
    setSessionId(active.id);
    const end = active.rounds[active.rounds.length - 1]?.endsAt ?? null;
    if (active.status === "paused") {
      setPaused(true);
      setEndsAt(null);
      setRemaining(Math.max(0, (active.pausedAt ?? Date.now()) - active.startedAt - (active.pausedMs ?? 0)));
      return;
    }
    setPaused(false);
    setEndsAt(end);
    if (end != null) setRemaining(Math.max(0, end - Date.now()));
  }, [os]);

  React.useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => {
      const left = endsAt - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setEndsAt(null);
        if (sessionId != null) {
          os.completeFocusSession(sessionId, {});
          toast("Focus session completed");
        }
        setSessionId(null);
        return;
      }
      setRemaining(left);
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, sessionId, os, toast]);

  const startTimer = () => {
    if (sessionId != null) return;
    const plannedMin = presetMinutes;
    const startedAt = Date.now();
    const session = os.startFocusSession({ startedAt, plannedMin, mode: "countdown" }, startedAt);
    setSessionId(session.id);
    setEndsAt(startedAt + plannedMin * 60_000);
    setRemaining(plannedMin * 60_000);
    toast("Focus session started");
  };

  const stopTimer = () => {
    if (sessionId != null) {
      os.abortFocusSession(sessionId);
      toast("Focus session stopped");
    }
    setSessionId(null);
    setEndsAt(null);
    setPaused(false);
    setRemaining(presetMinutes * 60_000);
  };

  const pauseTimer = () => {
    if (sessionId == null || paused) return;
    os.pauseFocusSession(sessionId);
    setPaused(true);
    setEndsAt(null);
  };

  const resumeTimer = () => {
    if (sessionId == null || !paused) return;
    os.resumeFocusSession(sessionId);
    setPaused(false);
    setEndsAt(Date.now() + remaining);
  };

  const runAssistant = (id: string) => {
    if (ai.gatewayEnabled) {
      const meta: Record<string, { action: string; label: string; prompt: string }> = {
        summarize: { action: "meeting_summary", label: "Summarize meeting", prompt: "Summarize today's meeting and key decisions." },
        draft: { action: "meeting_followup_email", label: "Draft email", prompt: "Draft a concise work update email from today's work." },
        explain: { action: "quick_question", label: "Explain ticket", prompt: "Explain the open support ticket and the next step." },
        tasks: { action: "workmode_task_triage", label: "Prioritise tasks", prompt: "Triage and prioritize my open work tasks." },
        report: { action: "workmode_end_of_day", label: "Generate report", prompt: "Write my end-of-day work report." },
        find: { action: "quick_question", label: "Find information", prompt: `Find information about: ${askDraft.trim() || "my work"}` },
        standup: { action: "workmode_standup", label: "Draft standup", prompt: "Draft my standup update: done, next, blockers." },
        brief: { action: "workmode_meeting_brief", label: "Meeting brief", prompt: "Prepare a brief for my next work meeting." },
        focus: { action: "workmode_focus_plan", label: "Plan focus", prompt: "Plan my next focus session and what to protect." },
      };
      const selected = meta[id] ?? {
        action: "quick_question",
        label: "Quick AI question",
        prompt: askDraft.trim(),
      };
      if (!selected.prompt) {
        setAnswer("Ask about your work, projects or meetings.");
        return;
      }
      void ai.request({ ...selected, context: os.aiContextSummary() });
      return;
    }
    if (id === "summarize") {
      const meeting = meetings[0];
      if (meeting == null) {
        setAnswer("There is no meeting to summarize today.");
        return;
      }
      const transcript = os.transcripts().find(
        (entry) => entry.meetingId === meeting.id && entry.status !== "trashed",
      );
      setAnswer(
        transcript
          ? `"${meeting.title}" has a transcript. Open Meetings to summarise it or extract tasks and decisions.`
          : `"${meeting.title}" has no transcript yet. Record or import one in Meetings first.`,
      );
      return;
    }
    if (id === "draft") {
      const open = tasks.filter((task) => !task.done).map((task) => task.title);
      setAnswer(
        open.length > 0
          ? `Draft ready:\nSubject: Work update\n\nHi team,\n\nToday I worked on:\n${open.map((line) => `• ${line}`).join("\n")}\n\nThanks`
          : "Nothing to report - no open work tasks today.",
      );
      return;
    }
    if (id === "explain") {
      const ticket = tasks.find((task) => task.tags.includes("support") || task.title.toLowerCase().includes("review"));
      setAnswer(
        ticket != null
          ? `“${ticket.title}” — review the linked runbook, confirm the SLA, then reply with the next step.`
          : "No open support ticket is assigned to you today.",
      );
      return;
    }
    if (id === "tasks") {
      const created = tasks.filter((task) => !task.done).slice(0, 3);
      for (const task of created) {
        os.updateTask(task.id, { priority: 3, tags: [...task.tags, "from-ai"] });
      }
      setAnswer(
        created.length > 0
          ? `Prioritised ${created.length} task${created.length === 1 ? "" : "s"} and tagged them from-ai: ${created
              .map((task) => task.title)
              .join(", ")}.`
          : "There are no open tasks to prioritise.",
      );
      return;
    }
    if (id === "report") {
      setAnswer(
        `Work report: ${tasks.length} tasks today, ${projects.length} active projects, ${meetings.length} meetings, ${formatHours(focusWeekMinutes)} focused this week.`,
      );
      return;
    }
    const query = askDraft.trim();
    if (query.length === 0) {
      setAnswer("Ask about your work, projects or meetings.");
      return;
    }
    const hits = os.search({ query });
    const localMatches = [
      ...tasks
        .filter((task) => task.title.toLowerCase().includes(query.toLowerCase()))
        .map((task) => task.title),
      ...documents
        .filter((doc) => doc.title.toLowerCase().includes(query.toLowerCase()))
        .map((doc) => doc.title),
    ];
    const found = [...hits.map((hit) => hit.title), ...localMatches];
    setAnswer(
      found.length > 0
        ? `Found ${found.length} match${found.length === 1 ? "" : "es"} for “${query}”: ${found
            .slice(0, 3)
            .join(", ")}.`
        : `Nothing matched “${query}”.`,
    );
  };

  const runQuick = (id: string) => {
    if (id === "task") {
      onCreateTask();
      return;
    }
    if (id === "meeting") {
      const startsAt = Date.now() + 3_600_000;
      os.addMeeting({ title: "New work meeting", startsAt, endsAt: startsAt + 1_800_000 });
      toast("Meeting scheduled for the next hour");
      return;
    }
    if (id === "document") {
      os.addNote({ title: "New work document", body: "", tags: ["work"], mode: "work" });
      toast("Document created");
      return;
    }
    if (id === "note") {
      os.addNote({ title: "Quick note", body: "", tags: ["work"], mode: "work" });
      toast("Note captured");
      return;
    }
    askRef.current?.focus();
  };

  const runQuickRef = React.useRef(runQuick);

  React.useEffect(() => {
    runQuickRef.current = runQuick;
  });

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === "t") runQuickRef.current("task");
      if (key === "m") runQuickRef.current("meeting");
      if (key === "d") runQuickRef.current("document");
      if (key === "n") runQuickRef.current("note");
      if (key === "k") {
        event.preventDefault();
        runQuickRef.current("ask");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ringRadius = 52;
  const circumference = 2 * Math.PI * ringRadius;
  const ratio = 1 - remaining / (presetMinutes * 60_000);

  return (
    <aside className="min-w-0 space-y-4" aria-label="Work mode tools">
      <section
        aria-label="Work Mode AI Assistant"
        data-testid="workmode-assistant"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
            Work Mode AI Assistant
          </h2>
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
            <ModelLabel />
          </span>
        </header>

        <Input
          ref={askRef}
          value={askDraft}
          onChange={(event) => onAskDraftChange(event.target.value)}
          placeholder="Ask about your work, projects, or meetings…"
          aria-label="Ask the work mode assistant"
          className="h-9 text-[13px]"
        />

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {ASSISTANT_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={`workmode-assistant-${action.id}`}
                onClick={() => runAssistant(action.id)}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
              >
                <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                <span className="min-w-0 truncate text-[11px] font-medium text-ink-2">{action.label}</span>
              </button>
            );
          })}
        </div>

        {answer != null ? (
          <p
            data-testid="workmode-assistant-answer"
            className="mt-2 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
          >
            {answer}
          </p>
        ) : null}
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="workmode-assistant-credits">
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
      </section>

      <section
        aria-label="Focus Timer"
        data-testid="workmode-focus-timer"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Timer className="size-4 text-accent-ink" aria-hidden="true" />
            Focus Timer
          </h2>
          <select
            value={preset}
            onChange={(event) => {
              setPreset(event.target.value);
              if (sessionId == null) {
                const minutes = event.target.value === "Deep work" ? 50 : event.target.value === "Quick focus" ? 15 : 25;
                setRemaining(minutes * 60_000);
              }
            }}
            aria-label="Focus timer preset"
            disabled={sessionId != null}
            className="rounded-lg border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-2"
          >
            <option value="Pomodoro">Pomodoro</option>
            <option value="Deep work">Deep work</option>
            <option value="Quick focus">Quick focus</option>
          </select>
        </header>

        <div className="flex items-center gap-4">
          <div className="relative grid size-32 shrink-0 place-items-center">
            <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
              <circle cx={60} cy={60} r={ringRadius} fill="none" strokeWidth={9} className="stroke-surface-3" />
              <circle
                cx={60}
                cy={60}
                r={ringRadius}
                fill="none"
                strokeWidth={9}
                strokeLinecap="round"
                className="stroke-accent"
                strokeDasharray={`${ratio * circumference} ${circumference}`}
              />
            </svg>
            <span className="absolute grid place-items-center text-center">
              <span className="block text-2xl font-bold tabular-nums text-ink" data-testid="workmode-timer">
                {formatTimer(remaining)}
              </span>
              <span className="block text-[10px] text-ink-3">Focus Time</span>
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            {sessionId != null ? (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                data-testid="workmode-timer-pause"
                onClick={paused ? resumeTimer : pauseTimer}
              >
                {paused ? "Resume" : "Pause"}
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              data-testid="workmode-timer-toggle"
              onClick={sessionId != null ? stopTimer : startTimer}
            >
              {sessionId != null ? (
                <>
                  <Square className="size-3.5" aria-hidden="true" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="size-3.5" aria-hidden="true" />
                  Start
                </>
              )}
            </Button>
            <p className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <span className="size-1.5 rounded-full bg-info" aria-hidden="true" />
              Short Break Â· 5 minutes
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <span className="size-1.5 rounded-full bg-chart-7" aria-hidden="true" />
              Long Break Â· 15 minutes
            </p>
            <Settings className="size-3.5 text-ink-3" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section
        aria-label="Work Insights"
        data-testid="workmode-insights"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <BarChart3 className="size-4 text-accent-ink" aria-hidden="true" />
            Work Insights
          </h2>
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-2">This Week</span>
        </header>

        <div className="flex items-end gap-3">
          <div className="flex h-24 min-w-0 flex-1 items-end gap-1" data-testid="workmode-insights-chart">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => {
              const height = 18 + ((index * 17) % 70);
              return (
                <div key={label} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className="w-full rounded-t bg-chart-5"
                    style={{ height: `${height}%` }}
                    aria-hidden="true"
                  />
                  <span className="text-[9px] text-ink-3">{label}</span>
                </div>
              );
            })}
          </div>
          <ul className="w-28 shrink-0 space-y-2.5">
            <li>
              <p className="text-[13px] font-bold tabular-nums text-ink">{formatHours(focusWeekMinutes)}</p>
              <p className="text-[10px] text-ink-3">Total Focus</p>
            </li>
            <li>
              <p className="text-[13px] font-bold tabular-nums text-ink">
                {Math.round(focusWeekRatio * 100)}%
              </p>
              <p className="text-[10px] text-ink-3">Productive Time</p>
            </li>
            <li>
              <p className="text-[13px] font-bold tabular-nums text-ink">{focusWeekSessions}</p>
              <p className="text-[10px] text-ink-3">Focus Sessions</p>
            </li>
          </ul>
        </div>
      </section>

      <section
        aria-label="Quick Actions"
        data-testid="workmode-quick-actions"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Target className="size-4 text-accent-ink" aria-hidden="true" />
            Quick Actions
          </h2>
          <button
            type="button"
            onClick={onLoadDefaults}
            className="text-[11px] font-medium text-accent-ink hover:underline"
          >
            Load default data
          </button>
        </header>

        <ul className="space-y-0.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.id}>
                <button
                  type="button"
                  data-testid={`workmode-quick-${action.id}`}
                  onClick={() => runQuick(action.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{action.label}</span>
                  <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-3">
                    {action.shortcut}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export { cn };

