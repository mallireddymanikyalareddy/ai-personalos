import type { Timestamp } from "../../types/common";
import type { FocusAmbient, FocusMode, FocusPhase, FocusRound } from "../../types/engagement";

export interface FocusTimerConfig {
  mode: FocusMode;
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  roundsBeforeLongBreak: number;
  totalRounds: number;
  ambient: FocusAmbient;
}

export interface FocusPreset {
  id: string;
  label: string;
  hint: string;
  config: Omit<FocusTimerConfig, "ambient">;
}

export const FOCUS_PRESETS: FocusPreset[] = [
  {
    id: "stopwatch",
    label: "Stopwatch",
    hint: "Count up with no fixed end — good for open-ended work.",
    config: { mode: "stopwatch", workMin: 0, breakMin: 0, longBreakMin: 0, roundsBeforeLongBreak: 0, totalRounds: 0 },
  },
  {
    id: "countdown",
    label: "Countdown",
    hint: "A single block of deep work.",
    config: { mode: "countdown", workMin: 45, breakMin: 0, longBreakMin: 0, roundsBeforeLongBreak: 0, totalRounds: 0 },
  },
  {
    id: "pomodoro",
    label: "Pomodoro",
    hint: "25 minutes on, 5 off, long break every fourth round.",
    config: { mode: "pomodoro", workMin: 25, breakMin: 5, longBreakMin: 15, roundsBeforeLongBreak: 4, totalRounds: 0 },
  },
  {
    id: "interval",
    label: "Interval",
    hint: "20 seconds on, 10 off — tabata style.",
    config: { mode: "interval", workMin: 0.33, breakMin: 0.17, longBreakMin: 0, roundsBeforeLongBreak: 0, totalRounds: 8 },
  },
  {
    id: "flow",
    label: "Flow",
    hint: "60-minute deep work block with no breaks.",
    config: { mode: "flow", workMin: 60, breakMin: 0, longBreakMin: 0, roundsBeforeLongBreak: 0, totalRounds: 0 },
  },
  {
    id: "deep_work",
    label: "Deep Work",
    hint: "50 minutes on, 10 off.",
    config: { mode: "pomodoro", workMin: 50, breakMin: 10, longBreakMin: 20, roundsBeforeLongBreak: 3, totalRounds: 0 },
  },
  {
    id: "quick_focus",
    label: "Quick Focus",
    hint: "15 minutes on, 5 off — clear a small task fast.",
    config: { mode: "pomodoro", workMin: 15, breakMin: 5, longBreakMin: 10, roundsBeforeLongBreak: 4, totalRounds: 0 },
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Set your own focus and break length.",
    config: { mode: "countdown", workMin: 40, breakMin: 10, longBreakMin: 15, roundsBeforeLongBreak: 4, totalRounds: 0 },
  },
];

const SECOND = 1000;

export interface FocusTimerState {
  config: FocusTimerConfig;
  phase: FocusPhase;
  round: number;
  startedAt: Timestamp;
  phaseStartedAt: Timestamp;
  roundEndsAt: Timestamp | null;
  phaseElapsedMs: number;
  totalElapsedMs: number;
  workMs: number;
  breakMs: number;
  activeMs: number;
  completedRounds: number;
  rounds: FocusRound[];
  pausedAt: Timestamp | null;
  pausedMs: number;
  pausedTotalMs: number;
  status: "running" | "paused" | "completed" | "aborted";
  distractions: FocusDistractionSnapshot[];
}

export interface FocusDistractionSnapshot {
  at: Timestamp;
  resumedAt: Timestamp | null;
  durationMs: number | null;
  reason: string;
}

export function resolvePreset(id: string, ambient: FocusAmbient = "none"): FocusTimerConfig {
  const preset = FOCUS_PRESETS.find((entry) => entry.id === id) ?? FOCUS_PRESETS[2]!;
  return { ...preset.config, ambient };
}

export function presetForMode(mode: FocusMode, ambient: FocusAmbient = "none"): FocusTimerConfig {
  const byMode = FOCUS_PRESETS.find((preset) => preset.config.mode === mode);
  return byMode ? { ...byMode.config, ambient } : resolvePreset("countdown", ambient);
}

export function createTimer(
  config: FocusTimerConfig,
  startedAt: Timestamp,
): FocusTimerState {
  const workMs = Math.max(0, Math.round(config.workMin * 60 * SECOND));
  const isOpen = config.mode === "stopwatch" || workMs === 0;

  const firstRound: FocusRound = {
    index: 1,
    phase: "work",
    startedAt,
    endsAt: isOpen ? null : startedAt + workMs,
    completed: false,
  };

  return {
    config,
    phase: "work",
    round: 1,
    startedAt,
    phaseStartedAt: startedAt,
    roundEndsAt: isOpen ? null : startedAt + workMs,
    phaseElapsedMs: 0,
    totalElapsedMs: 0,
    activeMs: 0,
    workMs,
    breakMs: 0,
    completedRounds: 0,
    rounds: [firstRound],
    pausedAt: null,
    pausedMs: 0,
    pausedTotalMs: 0,
    status: "running",
    distractions: [],
  };
}

function activeMs(timer: FocusTimerState, now: Timestamp): number {
  const end = timer.status === "completed" || timer.status === "aborted" ? timer.phaseStartedAt : now;
  void end;
  return Math.max(0, now - timer.startedAt - timer.pausedTotalMs);
}

export function tick(timer: FocusTimerState, now: Timestamp): FocusTimerState {
  if (timer.status !== "running") return timer;

  const elapsed = now - timer.phaseStartedAt;
  const total = now - timer.startedAt - timer.pausedTotalMs;
  const next: FocusTimerState = {
    ...timer,
    phaseElapsedMs: Math.max(0, elapsed),
    totalElapsedMs: Math.max(0, total),
    activeMs: activeMs(timer, now),
  };

  if (timer.roundEndsAt != null && now >= timer.roundEndsAt) {
    return advanceRound(next, now);
  }
  return next;
}

export function remainingMs(timer: FocusTimerState, now: Timestamp): number | null {
  if (timer.roundEndsAt == null) return null;
  return Math.max(0, timer.roundEndsAt - now);
}

export function progressRatio(timer: FocusTimerState, now: Timestamp): number {
  if (timer.roundEndsAt == null) return 0;
  const total = timer.roundEndsAt - timer.phaseStartedAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - timer.phaseStartedAt) / total));
}

function breakDurationMs(timer: FocusTimerState): number {
  const { config } = timer;
  if (config.breakMin <= 0) return 0;
  const isLong =
    config.roundsBeforeLongBreak > 0 && timer.completedRounds > 0 && timer.completedRounds % config.roundsBeforeLongBreak === 0;
  return Math.round((isLong ? config.longBreakMin : config.breakMin) * 60 * SECOND);
}

export function advanceRound(timer: FocusTimerState, now: Timestamp): FocusTimerState {
  const finishedIndex = timer.rounds.length - 1;
  const rounds = timer.rounds.map((round, index) =>
    index === finishedIndex ? { ...round, endsAt: now, completed: true } : round,
  );

  const { config } = timer;
  const completedWorkRound = timer.phase === "work";
  const completedRounds = timer.completedRounds + (completedWorkRound ? 1 : 0);

  if (config.totalRounds > 0 && completedRounds >= config.totalRounds) {
    return {
      ...timer,
      rounds,
      completedRounds,
      status: "completed",
      phaseStartedAt: now,
      phaseElapsedMs: 0,
      totalElapsedMs: now - timer.startedAt - timer.pausedTotalMs,
    };
  }

  const nextPhase: FocusPhase = timer.phase === "work" ? (breakDurationMs(timer) > 0 ? "break" : "work") : "work";
  const durationMs =
    nextPhase === "work"
      ? Math.round(config.workMin * 60 * SECOND)
      : breakDurationMs(timer);

  const isLongBreak = nextPhase === "break" && breakDurationMs(timer) === Math.round(config.longBreakMin * 60 * SECOND);

  if (nextPhase === "work" && durationMs <= 0) {
    return { ...timer, rounds, completedRounds, roundEndsAt: null, phase: "work", phaseStartedAt: now };
  }

  const nextRound: FocusRound = {
    index: timer.rounds.length + 1,
    phase: nextPhase,
    startedAt: now,
    endsAt: durationMs > 0 ? now + durationMs : null,
    completed: false,
  };

  return {
    ...timer,
    rounds: [...rounds, nextRound],
    round: nextRound.index,
    phase: nextPhase === "break" && isLongBreak ? "long_break" : nextPhase,
    phaseStartedAt: now,
    roundEndsAt: durationMs > 0 ? now + durationMs : null,
    phaseElapsedMs: 0,
    completedRounds,
    breakMs: nextPhase === "work" ? timer.breakMs : timer.breakMs,
  };
}

export function skipToNextRound(timer: FocusTimerState, now: Timestamp): FocusTimerState {
  const moved: FocusTimerState = {
    ...timer,
    phase: timer.phase === "work" ? "break" : "work",
  };
  return advanceRound({ ...moved, rounds: timer.rounds }, now);
}

export function pause(timer: FocusTimerState, now: Timestamp): FocusTimerState {
  if (timer.status !== "running") return timer;
  return { ...timer, status: "paused", pausedAt: now, phaseElapsedMs: Math.max(0, now - timer.phaseStartedAt) };
}

export function resume(timer: FocusTimerState, now: Timestamp): FocusTimerState {
  if (timer.status !== "paused") return timer;
  const gap = timer.pausedAt != null ? Math.max(0, now - timer.pausedAt) : 0;
  if (timer.roundEndsAt != null) {
    return {
      ...timer,
      status: "running",
      roundEndsAt: timer.roundEndsAt + gap,
      pausedAt: null,
    };
  }
  return { ...timer, status: "running", pausedAt: null };
}

export function pauseAccumulated(timer: FocusTimerState, now: Timestamp): number {
  if (timer.pausedAt == null) return timer.pausedTotalMs;
  return timer.pausedTotalMs + Math.max(0, now - timer.pausedAt);
}

export function logDistraction(
  timer: FocusTimerState,
  now: Timestamp,
  reason = "",
): FocusTimerState {
  return {
    ...timer,
    distractions: [...timer.distractions, { at: now, resumedAt: null, durationMs: null, reason }],

  };
}

export function resumeFromDistraction(timer: FocusTimerState, now: Timestamp): FocusTimerState {
  const distractions = timer.distractions.map((distraction, index) =>
    index === timer.distractions.length - 1 && distraction.resumedAt == null
      ? { ...distraction, resumedAt: now, durationMs: Math.max(0, now - distraction.at) }
      : distraction,
  );
  return { ...timer, distractions };
}

export function focusRatio(timer: FocusTimerState, now: Timestamp): number {
  const total = now - timer.startedAt - pauseAccumulated(timer, now);
  if (total <= 0) return 1;
  const distracted = timer.distractions.reduce((sum, distraction) => sum + (distraction.durationMs ?? 0), 0);
  return Math.max(0, Math.min(1, 1 - distracted / total));
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}