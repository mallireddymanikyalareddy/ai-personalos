"use client";

import * as React from "react";

import { Pause, Play, SkipForward, Square, Volume2, VolumeX } from "lucide-react";

import { FOCUS_PRESETS, formatClock } from "@personalos/core";
import type { FocusAmbient, FocusSession } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

import { AMBIENT_OPTIONS, useAmbientSound } from "./use-ambient";
import { useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

type TimerPhase = "idle" | "running" | "paused";

const PHASE_LABEL: Record<string, string> = {
  work: "Focus",
  break: "Break",
  long_break: "Long break",
};

export function FocusTimer({
  onFinished,
  presetId: presetIdProp,
  onPresetIdChange,
  ambient: ambientProp,
  onAmbientChange,
  hidePresetPicker = false,
  className,
}: {
  onFinished?: (session: FocusSession) => void;
  presetId?: string;
  onPresetIdChange?: (id: string) => void;
  ambient?: FocusAmbient;
  onAmbientChange?: (ambient: FocusAmbient) => void;
  hidePresetPicker?: boolean;
  className?: string;
}) {
  const os = useOS();
  const { toast } = useToast();
  const session = os.activeFocusSession();

  const [internalPresetId, setInternalPresetId] = React.useState("pomodoro");
  const [internalAmbient, setInternalAmbient] = React.useState<FocusAmbient>("none");
  const presetId = presetIdProp ?? internalPresetId;
  const ambient = ambientProp ?? internalAmbient;

  const setPresetId = (id: string) => {
    if (onPresetIdChange) onPresetIdChange(id);
    else setInternalPresetId(id);
  };
  const setAmbient = (next: FocusAmbient) => {
    if (onAmbientChange) onAmbientChange(next);
    else setInternalAmbient(next);
  };

  const [volume, setVolume] = React.useState(0.35);
  const [phase, setPhase] = React.useState<TimerPhase>("idle");
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [roundPhase, setRoundPhase] = React.useState<string>("work");
  const [distracted, setDistracted] = React.useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = React.useState(false);
  const [soundOn, setSoundOn] = React.useState(true);
  const [finishOpen, setFinishOpen] = React.useState(false);
  const [finishSessionId, setFinishSessionId] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState<number | null>(null);
  const [note, setNote] = React.useState("");

  const { setVolume: applyVolume } = useAmbientSound(ambient, phase !== "idle" && soundOn && ambient !== "none");

  React.useEffect(() => {
    applyVolume(volume);
  }, [volume, applyVolume]);

  React.useEffect(() => {
    if (session) setPhase(session.status === "paused" ? "paused" : "running");
    else setPhase("idle");
  }, [session?.id, session?.status, session]);

  React.useEffect(() => {
    if (phase === "idle" || !session) return;
    if (session.status === "completed" || session.status === "aborted") {
      setPhase("idle");
      return;
    }

    const tickWindow = () => {
      const now = Date.now();
      if (session.status === "paused") {
        setElapsed(Math.max(0, (session.pausedAt ?? now) - session.startedAt - (session.pausedMs ?? 0)));
        return;
      }
      const active = Math.max(0, now - session.startedAt - (session.pausedMs ?? 0));
      setElapsed(active);
      const last = session.rounds[session.rounds.length - 1];
      setRoundPhase(last?.phase ?? "work");
      setRemaining(last?.endsAt != null ? Math.max(0, last.endsAt - now) : null);
    };

    tickWindow();
    const id = window.setInterval(tickWindow, 250);
    return () => window.clearInterval(id);
  }, [phase, session]);

  const start = () => {
    const preset = FOCUS_PRESETS.find((entry) => entry.id === presetId) ?? FOCUS_PRESETS[0]!;
    const started = os.startFocusSession({
      startedAt: Date.now(),
      mode: preset.config.mode,
      plannedMin: preset.config.workMin > 0 ? preset.config.workMin : null,
      ambient,
    });
    setPhase("running");
    setRoundPhase("work");
    setRemaining(preset.config.workMin > 0 ? Math.round(preset.config.workMin * 60_000) : null);
    toast(preset.label === "Stopwatch" ? "Focus started — counting up" : "Focus started", { tone: "success" });
    return started;
  };

  const stop = (status: "completed" | "aborted") => {
    if (!session) return;
    const id = session.id;
    const result = status === "completed" ? os.completeFocusSession(id) : os.abortFocusSession(id);
    if (result) onFinished?.(result);
    setPhase("idle");
    setElapsed(0);
    setRemaining(null);
    if (status === "completed") {
      setFinishSessionId(id);
      setRating(null);
      setNote("");
      setFinishOpen(true);
    }
    toast(status === "completed" ? "Session recorded" : "Session discarded");
  };

  const saveFeedback = () => {
    if (finishSessionId) {
      os.updateFocusSession(finishSessionId, {
        rating,
        note: note.trim(),
      });
      toast("Feedback saved");
    }
    setFinishOpen(false);
    setFinishSessionId(null);
    setRating(null);
    setNote("");
  };

  const preset = FOCUS_PRESETS.find((entry) => entry.id === presetId)!;
  const workMs = preset.config.workMin > 0 ? Math.round(preset.config.workMin * 60_000) : null;
  const phaseMin = roundPhase === "work" ? preset.config.workMin : preset.config.breakMin;
  const phaseMs = phaseMin > 0 ? Math.round(phaseMin * 60_000) : null;
  const ratio =
    phase !== "idle" && phaseMs != null && remaining != null
      ? 1 - remaining / phaseMs
      : Math.min(1, elapsed / 3_600_000);

  const task = session?.taskId ? os.getTask(session.taskId) : null;
  const goal = session?.goalId ? os.getGoal(session.goalId) : null;

  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className={cn("flex flex-wrap gap-1.5", hidePresetPicker && "hidden")} role="radiogroup" aria-label="Timer mode">
          {FOCUS_PRESETS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={presetId === entry.id}
              disabled={phase !== "idle"}
              onClick={() => setPresetId(entry.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                presetId === entry.id
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-ink-3 hover:text-ink",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={ambient}
            onChange={(event) => setAmbient(event.target.value as FocusAmbient)}
            aria-label="Ambient sound"
            className="w-32"
            disabled={phase !== "idle"}
          >
            {AMBIENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {ambient !== "none" && phase !== "idle" && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={soundOn ? "Mute ambient sound" : "Unmute ambient sound"}
              onClick={() => setSoundOn((value) => !value)}
            >
              {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Ambient volume"
              className="w-24 accent-[var(--accent)]"
            />
          </>
        )}
      </div>

      <div className="flex flex-col items-center py-4">
        <div className="mb-3 flex items-center gap-2">
          <Badge tone="accent">{preset.label}</Badge>
          {phase !== "idle" && <Badge tone="neutral">{PHASE_LABEL[roundPhase] ?? roundPhase}</Badge>}
          {session && session.rounds.length > 1 && <Badge tone="outline">Round {session.rounds.length}</Badge>}
        </div>
        <div
          className={cn(
            "text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl",
            phase === "running" ? "text-ink" : "text-ink-2",
          )}
          aria-live="off"
        >
          {formatClock(phase === "idle" ? (workMs ?? 0) : (remaining ?? elapsed))}
        </div>
        <p className="mt-2 text-sm text-ink-3">
          {phase === "idle"
            ? preset.hint
            : phase === "paused"
              ? "Paused"
              : remaining != null
                ? "remaining in this block"
                : "elapsed"}
        </p>

        <div className="mt-4 w-full max-w-md">
          <ProgressBar
            value={Math.round(ratio * 100)}
            max={100}
            tone={roundPhase === "work" ? "accent" : "success"}
            className="h-1.5"
          />
        </div>
      </div>

      {task && (
        <p className="mb-3 truncate text-center text-sm text-ink-2">
          Working on <span className="font-medium text-ink">{task.title}</span>
        </p>
      )}
      {goal && (
        <p className="mb-3 text-center text-xs text-ink-3">
          toward <span className="font-medium">{goal.title}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === "idle" && (
          <>
            <Button variant="primary" size="lg" onClick={start}>
              <Play className="size-4" />
              Start Focus
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setTaskPickerOpen(true)}>
              Start with a task
            </Button>
          </>
        )}

        {phase === "running" && (
          <>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                if (!distracted) {
                  os.logFocusDistraction(session!.id, "");
                  setDistracted(true);
                  toast("Distraction logged");
                } else {
                  os.resumeFromFocusDistraction(session!.id);
                  setDistracted(false);
                }
              }}
            >
              {distracted ? "Back to focus" : "I got distracted"}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => os.pauseFocusSession(session!.id)}>
              <Pause className="size-4" />
              Pause
            </Button>
            {workMs != null && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Skip to next round"
                onClick={() => {
                  const next = os.updateFocusSession(session!.id, {
                    rounds: advanceRounds(session!, preset.config.workMin, preset.config.breakMin),
                  });
                  if (next) {
                    const last = next.rounds[next.rounds.length - 1]!;
                    setRoundPhase(last.phase);
                    setRemaining(last.endsAt != null ? Math.max(0, last.endsAt - Date.now()) : null);
                  }
                }}
              >
                <SkipForward className="size-4" />
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={() => stop("completed")}>
              <Square className="size-4" />
              Complete
            </Button>
          </>
        )}

        {phase === "paused" && (
          <>
            <Button variant="primary" size="lg" onClick={() => os.resumeFocusSession(session!.id)}>
              <Play className="size-4" />
              Resume
            </Button>
            <Button variant="primary" size="lg" onClick={() => stop("completed")}>
              <Square className="size-4" />
              Complete
            </Button>
            <Button variant="ghost" size="lg" onClick={() => stop("aborted")}>
              Discard
            </Button>
          </>
        )}
      </div>

      {session && distracted && (
        <p className="mt-3 text-center text-xs text-warning">
          Logged as distracted — press “Back to focus” when you return.
        </p>
      )}

      <Modal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="How did it go?"
        description="Rate the session and add a note — it is stored with your focus history."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFinishOpen(false)}>
              Skip
            </Button>
            <Button variant="primary" onClick={saveFeedback}>
              Save feedback
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Session rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} out of 5`}
                onClick={() => setRating((current) => (current === value ? null : value))}
                className={cn(
                  "text-xl transition-colors",
                  rating != null && value <= rating ? "text-warning" : "text-ink-3/50 hover:text-warning",
                )}
              >
                ★
              </button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What worked? What got in the way?"
            aria-label="Session note"
            className="min-h-20"
          />
        </div>
      </Modal>

      <TaskPicker
        open={taskPickerOpen}
        onClose={() => setTaskPickerOpen(false)}
        onPick={(taskId) => {
          const chosen = os.startFocusSession({
            startedAt: Date.now(),
            taskId,
            mode: preset.config.mode,
            plannedMin: preset.config.workMin > 0 ? preset.config.workMin : null,
            ambient,
          });
          setTaskPickerOpen(false);
          setPhase("running");
          toast("Focus started on that task", { tone: "success" });
          return chosen;
        }}
      />
    </div>
  );
}

function advanceRounds(
  session: FocusSession,
  workMin: number,
  breakMin: number,
): FocusSession["rounds"] {
  const rounds = [...session.rounds];
  const last = rounds[rounds.length - 1];
  if (!last) return rounds;
  const now = Date.now();
  rounds[rounds.length - 1] = { ...last, endsAt: now, completed: true };
  const phase = last.phase === "work" ? "break" : "work";
  const minutes = phase === "break" ? breakMin : workMin;
  rounds.push({
    index: rounds.length + 1,
    phase,
    startedAt: now,
    endsAt: minutes > 0 ? now + Math.round(minutes * 60_000) : null,
    completed: false,
  });
  return rounds;
}

function TaskPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (taskId: string) => void;
}) {
  const os = useOS();
  const tasks = React.useMemo(
    () =>
      Object.values(os.getState().tasks)
        .filter(
          (task) =>
            task.status === "open" ||
            task.status === "in_progress" ||
            task.status === "inbox" ||
            task.status === "review",
        )
        .sort((a, b) => b.priority - a.priority || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
        .slice(0, 30),
    [os],
  );

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start focus on a task"
      description="The session is linked to the task and feeds its estimate accuracy."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      {tasks.length === 0 ? (
        <p className="text-sm text-ink-3">No open tasks to focus on.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onPick(task.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
                {task.estimateMin != null && <span className="text-xs text-ink-3">{task.estimateMin} min</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}