import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Goal } from "../../types/goal";
import type { AIProposal, AIResult } from "../ai/types";

export interface GoalDecompositionStep {
  kind: "project" | "milestone" | "task" | "habit";
  title: string;
  detail: string;
  estimateMin: number | null;
  metricIndex: number | null;
}

export interface GoalDecomposition {
  goalId: ID;
  steps: GoalDecompositionStep[];
  rationale: string;
}

function horizonLabel(goal: Goal): string {
  switch (goal.horizon) {
    case "life":
      return "long-term";
    case "year":
      return "this year";
    case "quarter":
      return "this quarter";
    case "month":
      return "this month";
    case "week":
      return "this week";
  }
}

function findMatchingProject(state: AppState, goal: Goal, keyword: string) {
  return Object.values(state.projects).find(
    (project) => project.name.toLowerCase().includes(keyword) && project.goalIds.includes(goal.id),
  );
}

export function decomposeGoal(state: AppState, goal: Goal, now: Timestamp = Date.now()): GoalDecomposition {
  const steps: GoalDecompositionStep[] = [];
  const horizon = horizonLabel(goal);
  const metricTargets = goal.metrics.filter((metric) => metric.target > 0);

  steps.push({
    kind: "task",
    title: `Define success criteria for "${goal.title}"`,
    detail: `Write down what done means ${horizon}.`,
    estimateMin: 30,
    metricIndex: null,
  });

  if (metricTargets.length > 0) {
    for (const [index, metric] of metricTargets.entries()) {
      const gap = Math.max(0, metric.target - metric.current);
      const share = metric.target > 0 ? gap / metric.target : 1;

      steps.push({
        kind: "project",
        title: `${metric.label}: ${metric.current} → ${metric.target} ${metric.unit}`,
        detail:
          share >= 0.5
            ? `Most of the target is still open (${Math.round(share * 100)}% remaining).`
            : `Close to the target — ${Math.round(share * 100)}% remaining.`,
        estimateMin: null,
        metricIndex: index,
      });

      steps.push({
        kind: "milestone",
        title: `Halfway: ${Math.round((metric.current + metric.target) / 2)} ${metric.unit}`,
        detail: `A checkpoint between today and the full ${metric.target} ${metric.unit}.`,
        estimateMin: null,
        metricIndex: index,
      });

      steps.push({
        kind: "task",
        title: `Weekly action toward ${metric.label}`,
        detail: `One repeatable action that moves ${metric.label} forward.`,
        estimateMin: 45,
        metricIndex: index,
      });

      if (metric.current === 0) {
        steps.push({
          kind: "task",
          title: `Establish the baseline for ${metric.label}`,
          detail: `Record where ${metric.label} starts so progress is measurable.`,
          estimateMin: 20,
          metricIndex: index,
        });
      }
    }
  } else {
    steps.push({
      kind: "task",
      title: `Break "${goal.title}" into 3 concrete outcomes`,
      detail: "No metrics are defined yet — define them so progress can be tracked.",
      estimateMin: 30,
      metricIndex: null,
    });
  }

  steps.push({
    kind: "task",
    title: `Weekly review of "${goal.title}"`,
    detail: "Check progress and adjust the plan.",
    estimateMin: 20,
    metricIndex: null,
  });

  if (/(habit|daily|every day|streak|consisten|practice|exercise|read|write|meditat|sleep|learn)/i.test(goal.title)) {
    steps.push({
      kind: "habit",
      title: `Daily habit supporting "${goal.title}"`,
      detail: "A small repeatable action that compounds toward this goal.",
      estimateMin: null,
      metricIndex: null,
    });
  }

  void findMatchingProject;
  void state;
  void now;

  return {
    goalId: goal.id,
    steps,
    rationale: `Goal "${goal.title}" (${goal.horizon}) decomposed from ${
      metricTargets.length > 0 ? `${metricTargets.length} metric(s)` : "its title"
    }.`,
  };
}

export function decomposeGoalResult(
  state: AppState,
  goal: Goal,
  now: Timestamp = Date.now(),
): AIResult {
  const decomposition = decomposeGoal(state, goal, now);
  const projects = decomposition.steps.filter((step) => step.kind === "project");
  const milestones = decomposition.steps.filter((step) => step.kind === "milestone");

  const proposals: AIProposal[] = [];

  if (projects.length > 0) {
    proposals.push({
      capability: "decompose_goal",
      title: `Create ${projects.length} project${projects.length === 1 ? "" : "s"} for "${goal.title}"`,
      summary: "One project per metric, linked to the goal.",
      risk: "medium",
      requiresConfirmation: true,
      reasoning: projects.map((p) => p.title).join("; "),
      preview: projects.map((p) => ({ label: p.title, detail: p.detail })),
      refs: [{ entityType: "goal", entityId: goal.id }],
      payload: {
        goalId: goal.id,
        projects: projects.map((p) => ({ name: p.title, goalIds: [goal.id] })),
      },
    });
  }

  if (milestones.length > 0 && projects.length > 0) {
    proposals.push({
      capability: "decompose_goal",
      title: `Add ${milestones.length} milestone${milestones.length === 1 ? "" : "s"} to the first project`,
      summary: "Checkpoints so progress is visible before the deadline.",
      risk: "medium",
      requiresConfirmation: true,
      reasoning: "Milestones give the goal measurable gates.",
      preview: milestones.map((m) => ({ label: m.title, detail: m.detail })),
      refs: [{ entityType: "goal", entityId: goal.id }],
      payload: {
        goalId: goal.id,
        milestones: milestones.map((m) => ({ title: m.title })),
        projectIndex: 0,
      },
    });
  }

  const taskSteps = decomposition.steps.filter((step) => step.kind === "task");
  if (taskSteps.length > 0) {
    proposals.push({
      capability: "decompose_goal",
      title: `Add ${taskSteps.length} supporting task${taskSteps.length === 1 ? "" : "s"}`,
      summary: "Concrete next actions tied to the goal.",
      risk: "medium",
      requiresConfirmation: true,
      reasoning: taskSteps.map((t) => t.title).join("; "),
      preview: taskSteps.map((t) => ({ label: t.title, detail: t.detail })),
      refs: [{ entityType: "goal", entityId: goal.id }],
      payload: {
        goalId: goal.id,
        tasks: taskSteps.map((t) => ({
          title: t.title,
          priority: 2,
          durationMin: t.estimateMin,
          goalIds: [goal.id],
        })),
      },
    });
  }

  const habitSteps = decomposition.steps.filter((step) => step.kind === "habit");
  if (habitSteps.length > 0) {
    proposals.push({
      capability: "decompose_goal",
      title: `Add a daily habit supporting "${goal.title}"`,
      summary: "Consistency compounds toward the goal.",
      risk: "low",
      requiresConfirmation: true,
      reasoning: "The goal language suggests a repeatable daily action.",
      preview: habitSteps.map((h) => ({ label: h.title, detail: h.detail })),
      refs: [{ entityType: "goal", entityId: goal.id }],
      payload: {
        goalId: goal.id,
        habits: habitSteps.map((h) => ({ title: h.title, cadence: "daily", goalId: goal.id })),
      },
    });
  }

  return {
    kind: "proposal",
    message: `Decomposed "${goal.title}" into ${decomposition.steps.length} steps across ${new Set(
      decomposition.steps.map((s) => s.kind),
    ).size} categories.`,
    capability: "decompose_goal",
    citations: [
      {
        entityType: "goal",
        entityId: goal.id,
        title: goal.title,
        quote: decomposition.rationale,
      },
    ],
    proposals,
  };
}