import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import { buildDayView } from "../calendar/views";
import { findPlanningWindows, totalPlanningFreeMinutes } from "../planner/windows";
import {
  applyPlan,
  diffPlan,
  findPlanConflicts,
  generatePlan,
  recalculatePlan,
  summarizePlan,
  type PlanProposal,
  type PlanSummary,
} from "../planner";
import type { AIProposal, AIResult } from "../ai/types";
import { formatMinutes } from "./format";

export interface ScheduleAnalysis {
  from: Timestamp;
  to: Timestamp;
  freeMin: number;
  plannedMin: number;
  conflicts: number;
  unplanned: number;
  summary: PlanSummary | null;
}

export function analyzeSchedule(state: AppState, from: Timestamp, to: Timestamp): ScheduleAnalysis {
  const prefs = state.settings.planning;
  const freeSlots = findPlanningWindows(state, prefs, from, to, 30);
  const freeMin = totalPlanningFreeMinutes(state, prefs, from, to, 30);
  const conflicts = findPlanConflicts(state, from, to);
  const proposal = prefs.enabled ? generatePlan(state, from, to, { prefs, now: Date.now() }) : null;

  void freeSlots;

  return {
    from,
    to,
    freeMin,
    plannedMin: proposal?.plannedMin ?? 0,
    conflicts: conflicts.length,
    unplanned: proposal?.unplanned.length ?? 0,
    summary: proposal ? summarizePlan(state, proposal, prefs) : null,
  };
}

function planProposal(from: Timestamp, to: Timestamp, proposal: PlanProposal, label: string): AIProposal {
  return {
    capability: "plan_day",
    title: `Plan ${label}`,
    summary: `${proposal.slots.length} time blocks · ${formatMinutes(proposal.plannedMin)} scheduled · ${proposal.unplanned.length} unscheduled`,
    risk: "high",
    requiresConfirmation: true,
    reasoning:
      proposal.unplanned.length > 0
        ? `${proposal.unplanned.length} task(s) did not fit — the window has ${formatMinutes(
            proposal.plannedMin,
          )} of planning time.`
        : "Every candidate fits in the available planning windows.",
    preview: proposal.slots.slice(0, 12).map((slot) => ({
      label: slot.title,
      detail: `${slot.kind} · ${formatMinutes((slot.endsAt - slot.startsAt) / 60000)} · ${slot.reason ?? ""}`.trim(),
    })),
    refs: proposal.slots
      .filter((slot) => slot.taskId != null)
      .map((slot) => ({ entityType: "task" as const, entityId: slot.taskId! })),
    payload: {
      kind: "plan",
      from,
      to,
      proposal: proposal as unknown as Record<string, unknown>,
    },
  };
}

export function planDayResult(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): AIResult {
  const prefs = state.settings.planning;
  const day = buildDayView(state, from, now);
  const label = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(from);

  if (!prefs.enabled) {
    return {
      kind: "answer",
      message: "Daily planning is turned off. Enable it in Settings → Planning to let me build your day.",
      capability: "plan_day",
      citations: [],
      proposals: [],
      data: { enabled: false },
    };
  }

  const proposal = generatePlan(state, from, to, { prefs, now });
  const events = day.events.length;

  return {
    kind: "proposal",
    message: `I drafted a plan for ${label}: ${proposal.slots.length} blocks covering ${formatMinutes(
      proposal.plannedMin,
    )} around ${events} calendar event${events === 1 ? "" : "s"}.`,
    capability: "plan_day",
    citations: proposal.slots
      .filter((slot) => slot.taskId != null)
      .slice(0, 10)
      .map((slot) => ({
        entityType: "task" as const,
        entityId: slot.taskId!,
        title: slot.title,
        quote: slot.reason ?? "planned in this window",
      })),
    proposals: [planProposal(from, to, proposal, label)],
    data: { slots: proposal.slots.length, plannedMin: proposal.plannedMin, unplanned: proposal.unplanned.length },
  };
}

export function optimizeScheduleResult(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): AIResult {
  const prefs = state.settings.planning;
  const conflicts = findPlanConflicts(state, from, to);
  const analysis = analyzeSchedule(state, from, to);

  if (conflicts.length === 0) {
    return {
      kind: "answer",
      message: `No conflicts in this window. ${formatMinutes(analysis.freeMin)} is still free — you could plan more into it.`,
      capability: "optimize_schedule",
      citations: [],
      proposals: [],
      data: analysis,
    };
  }

  const proposal = recalculatePlan(state, from, to, prefs, now);

  return {
    kind: "proposal",
    message: `Found ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}. I can move the AI-scheduled blocks out of the way and re-plan ${formatMinutes(
      proposal.plannedMin,
    )} of work.`,
    capability: "optimize_schedule",
    citations: conflicts.slice(0, 10).map((conflict) => ({
      entityType: "time_block" as const,
      entityId: conflict.blockId,
      title: conflict.title,
      quote: conflict.reason,
    })),
    proposals: [
      {
        capability: "optimize_schedule",
        title: `Re-plan ${proposal.slots.length} block${proposal.slots.length === 1 ? "" : "s"}`,
        summary: `Resolves ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} by relocating blocks I scheduled.`,
        risk: "high",
        requiresConfirmation: true,
        reasoning:
          "Only blocks tagged as AI-scheduled get moved, so anything you placed yourself stays put.",
        preview: conflicts.slice(0, 12).map((conflict) => ({
          label: conflict.title,
          detail: `${new Date(conflict.startsAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })} — ${conflict.reason}`,
        })),
        refs: conflicts.map((conflict) => ({ entityType: "time_block" as const, entityId: conflict.blockId })),
        payload: {
          kind: "plan",
          from,
          to,
          proposal: proposal as unknown as Record<string, unknown>,
        },
      },
    ],
    data: { conflicts: conflicts.length, freeMin: analysis.freeMin },
  };
}

export function rescheduleResult(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): AIResult {
  return optimizeScheduleResult(state, from, to, now);
}

export function applyPlanProposal(
  store: Parameters<typeof applyPlan>[0],
  proposal: PlanProposal,
) {
  return applyPlan(store, diffPlan(store.getState(), proposal));
}