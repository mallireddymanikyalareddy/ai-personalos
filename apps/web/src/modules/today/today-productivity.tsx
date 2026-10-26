"use client";
import * as React from "react";

import {
  BookOpen,
  CalendarPlus,
  Camera,
  ChevronRight,
  ClipboardList,
  ListTodo,
  NotebookPen,
  Pause,
  Play,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import { aiProvider, endOfDay, startOfDay } from "@personalos/core";
import type { AIResult, TodayInsight, TodayStats } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { formatCountdown } from "./use-today-now";

const HOUR = 3_600_000;

const AI_ACTIONS = [
  { label: "Plan my day", prompt: "Plan my day" },
  { label: "Summarize meetings", prompt: "Summarize my meetings" },
  { label: "Extract tasks", prompt: "Extract tasks from my notes" },
  { label: "Review my goals", prompt: "Review my goals" },
  { label: "Analyze my week", prompt: "Analyze my week" },
  { label: "Ask anything", prompt: "" },
] as const;

export function TodayAiPanel() {
  const os = useOS();
  const state = useAppState();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [question, setQuestion] = React.useState("");
  const [result, setResult] = React.useState<AIResult | null>(null);
  const provider = aiProvider(state.settings.aiProvider);

  const ask = (prompt: string): void => {
    if (prompt.trim().length === 0) {
      inputRef.current?.focus();
      return;
    }
    setResult(os.aiRun(prompt.trim()));
  };

  return (
    <section
      aria-label="AI Assistant"
      data-testid="today-ai"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent" aria-hidden="true" />
          AI Assistant
        </h2>
        <Badge tone={provider.available ? "accent" : "warning"}>{provider.label}</Badge>
      </header>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <Input
          ref={inputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="How can I help you today?"
          aria-label="Ask the assistant"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!question.trim()}>
          Ask
        </Button>
      </form>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {AI_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => ask(action.prompt)}
            className="rounded-lg border border-line px-2 py-1.5 text-left text-[11px] font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent-ink"
          >
            {action.label}
          </button>
        ))}
      </div>

      {result ? (
        <div
          role="status"
          data-testid="today-ai-answer"
          className="mt-2 rounded-lg bg-surface-2 p-2.5 text-[13px] leading-relaxed text-ink-2"
        >
          {result.message}
        </div>
      ) : null}

      <a
        href="/ai"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
      >
        Open the full assistant
        <ChevronRight className="size-3" aria-hidden="true" />
      </a>
    </section>
  );
}

export const FOCUS_PRESETS: ReadonlyArray<{ id: string; label: string; minutes: number }> = [
  { id: "deep", label: "Deep Work", minutes: 50 },
  { id: "quick", label: "Quick Focus", minutes: 15 },
  { id: "meeting", label: "Meeting", minutes: 30 },
  { id: "study", label: "Study", minutes: 45 },
];

export function TodayFocusTimer() {
  const os = useOS();
  const { toast } = useToast();
  const [preset, setPreset] = React.useState(FOCUS_PRESETS[0]!);
  const [elapsed, setElapsed] = React.useState(0);

  const session = os.activeFocusSession();

  React.useEffect(() => {
    if (!session) {
      setElapsed(0);
      return;
    }
    const tick = () => {
      if (session.status === "paused") return;
      setElapsed(Math.max(0, Math.round((Date.now() - session.startedAt - session.pausedMs) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session]);

  const totalSeconds = (session?.plannedMin ?? preset.minutes) * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);

  const start = () => {
    os.startFocusSession({ startedAt: Date.now(), plannedMin: preset.minutes, mode: "countdown" });
    toast(`${preset.label} session started`);
  };

  const stop = () => {
    if (!session) return;
    os.completeFocusSession(session.id, {});
    toast("Focus session saved");
  };

  const pause = () => {
    if (!session) return;
    os.pauseFocusSession(session.id);
    toast("Focus session paused");
  };

  const resume = () => {
    if (!session) return;
    os.resumeFocusSession(session.id);
    toast("Focus session resumed");
  };

  const cancel = () => {
    if (!session) return;
    os.abortFocusSession(session.id);
    toast("Session discarded");
  };

  return (
    <section
      aria-label="Focus Timer"
      data-testid="today-focus"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Play className="size-4 text-accent" aria-hidden="true" />
          Focus Timer
        </h2>
        <DropdownMenu
          align="end"
          sections={[
            {
              label: "Presets",
              items: [
                ...FOCUS_PRESETS.map((entry) => ({
                  label: entry.label,
                  icon: <ClipboardList className="size-3.5" />,
                  selected: preset.id === entry.id,
                  onSelect: () => setPreset(entry),
                })),
                {
                  label: "Custom",
                  icon: <Target className="size-3.5" />,
                  selected: false,
                  onSelect: () => setPreset({ id: "custom", label: "Custom", minutes: 25 }),
                },
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent-ink"
              aria-label={`Focus preset: ${preset.label}. Change preset`}
            >
              {preset.label}
            </button>
          }
        />
      </header>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <CircularProgress
            value={elapsed}
            max={totalSeconds}
            size={104}
            stroke={10}
            tone="accent"
            label={`${formatCountdown(remaining)} remaining`}
          />
          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span
              className="text-lg font-semibold tabular-nums text-ink"
              data-testid="today-focus-countdown"
            >
              {formatCountdown(remaining)}
            </span>
            <span className="text-[10px] font-medium text-ink-3">
              {session ? (session.status === "paused" ? "Paused" : "Focusing") : "Start Focus"}
            </span>
          </span>
          <Button
            size="icon"
            variant="primary"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2"
            onClick={session ? stop : start}
            aria-label={session ? "Complete focus session" : `Start ${preset.label}`}
          >
            {session ? (
              <Square className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {FOCUS_PRESETS.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setPreset(entry)}
                aria-pressed={preset.id === entry.id}
                className={cn(
                  "flex w-full items-center gap-1.5 text-left text-[12px] transition-colors",
                  preset.id === entry.id ? "font-semibold text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 shrink-0 rounded-full border-2",
                    preset.id === entry.id ? "border-accent bg-accent" : "border-line-strong",
                  )}
                />
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {session ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={session.status === "paused" ? resume : pause}
          >
            {session.status === "paused" ? (
              <Play className="size-3.5" aria-hidden="true" />
            ) : (
              <Pause className="size-3.5" aria-hidden="true" />
            )}
            {session.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Button variant="ghost" size="sm" onClick={cancel}>
            Discard
          </Button>
        </div>
      ) : null}
    </section>
  );
}

const CAPTURE_KINDS = [
  { id: "task", label: "Task", icon: ListTodo },
  { id: "note", label: "Note", icon: NotebookPen },
  { id: "event", label: "Event", icon: CalendarPlus },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "habit", label: "Habit", icon: TrendingUp },
  { id: "photo", label: "Photo", icon: Camera },
] as const;

export function TodayQuickCapture({ day }: { day: number }) {
  const os = useOS();
  const { toast } = useToast();
  const [text, setText] = React.useState("");

  const capture = (kind: (typeof CAPTURE_KINDS)[number]["id"]) => {
    const body = text.trim();
    if (body.length === 0) {
      toast("Type something to capture first");
      return;
    }

    if (kind === "task") os.addTask({ title: body, dueAt: endOfDay(day) });
    else if (kind === "note") os.addNote({ title: body });
    else if (kind === "event") {
      const selectedStart = startOfDay(day);
      const startsAt =
        selectedStart === startOfDay(Date.now()) ? Date.now() + HOUR : selectedStart + 9 * HOUR;
      os.addEvent({ title: body, startsAt, endsAt: startsAt + HOUR });
    } else if (kind === "journal") {
      const entry = os.journalEntryFor(day);
      if (entry) os.updateJournalEntry(entry.id, { body });
      else os.addJournalEntry({ entryDate: day, body });
    } else if (kind === "habit") os.addHabit(body);
    else {
      toast("Open Life Memory to attach a photo");
      if (typeof window !== "undefined") window.location.assign("/memory");
      return;
    }

    setText("");
    toast(`${CAPTURE_KINDS.find((entry) => entry.id === kind)?.label} captured`);
  };

  return (
    <section
      aria-label="Quick Capture"
      data-testid="today-capture"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Zap className="size-4 text-accent" aria-hidden="true" />
          Quick Capture
        </h2>
        <a href="/notes" className="text-xs font-medium text-accent-ink hover:underline">Write</a>
      </header>

      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Capture a thought, task, or note."
        aria-label="Capture a thought, task, or note"
      />

      <div className="mt-2 grid grid-cols-6 gap-1">
        {CAPTURE_KINDS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => capture(entry.id)}
              className="flex flex-col items-center gap-1 rounded-lg border border-line px-1 py-1.5 transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <Icon className="size-3.5 text-accent" aria-hidden="true" />
              <span className="text-[10px] text-ink-2">{entry.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const INSIGHT_TONE: Record<TodayInsight["tone"], string> = {
  positive: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  action: "bg-accent-soft text-accent-ink",
  neutral: "bg-info-soft text-info",
};

export function TodayInsightsPanel({
  insights,
  stats,
}: {
  insights: TodayInsight[];
  stats: TodayStats;
}) {
  const fallback: TodayInsight[] = [
    {
      id: "fallback",
      tone: "neutral",
      title:
        stats.tasksTotal > 0
          ? `You're ${Math.round((stats.tasksDone / stats.tasksTotal) * 100)}% through today's tasks.`
          : "Nothing is due today.",
      detail:
        stats.tasksTotal > 0
          ? `${stats.tasksDone} of ${stats.tasksTotal} complete.`
          : "Capture a task to start building the day.",
    },
  ];

  const rows = insights.length > 0 ? insights : fallback;

  return (
    <section
      aria-label="Today's Insights"
      data-testid="today-insights"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <TrendingUp className="size-4 text-accent" aria-hidden="true" />
          Today&apos;s Insights
        </h2>
        <a href="/insights" className="text-xs font-medium text-accent-ink hover:underline">
          View more
        </a>
      </header>

      <ul className="space-y-1.5">
        {rows.map((insight) => (
          <li key={insight.id} data-testid="today-insight-row">
            <div className="flex items-center gap-2 rounded-lg px-1 py-1.5">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md",
                  INSIGHT_TONE[insight.tone],
                )}
                aria-hidden="true"
              >
                <ChevronRight className="size-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-ink">{insight.title}</span>
                <span className="block text-[11px] text-ink-3">{insight.detail}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}