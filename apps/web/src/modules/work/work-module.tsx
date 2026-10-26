"use client";

import * as React from "react";

import { Briefcase, Repeat, Search } from "lucide-react";

import type { Project, Routine, RoutineSlot, RoutineStep, HabitCadence } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Segmented } from "@/components/ui/segmented";

import { ProgressBar } from "@/components/ui/progress";
import { TaskDetailSheet } from "@/modules/tasks/task-detail-sheet";
import { useToast } from "@/components/ui/toast";

import { MemberDialog } from "./member-dialog";
import { MilestoneDialog, type MilestoneDialogTarget } from "./milestone-dialog";
import { ProjectCard } from "./project-card";
import { ProjectDetailSheet } from "./project-detail-sheet";
import { ProjectDialog, type ProjectFormInput } from "./project-dialog";
import { ProjectOverview } from "./project-overview";
import { ProjectTimeline } from "./project-timeline";
import { RoutineDetailSheet } from "./routine-detail-sheet";
import { RoutineDialog } from "./routine-dialog";
import { WorkActivity, WorkTeam } from "./work-side-panels";
import { WorkProjectBoard } from "./work-project-board";
import { seedSampleProjects } from "./sample-projects";
import { useAppState, useOS } from "@/store/use-os";

type Tab = "projects" | "routines";

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "projects", label: "Projects" },
  { value: "routines", label: "Routines" },
];

function RoutineCard({ routine, onOpen }: { routine: Routine; onOpen: () => void }) {
  const os = useOS();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = today.getTime();
  const dueToday = os.routineDueOnDay(routine.id, dayStart);
  const stats = dueToday ? os.routineStatsFor(routine.id, dayStart) : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop"
    >
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-ink">
          {routine.title}
        </span>
        <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-3">
          {routine.slot}
        </span>
      </div>
      {routine.description && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-3">
          {routine.description}
        </p>
      )}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-3">
            {routine.steps.length} step{routine.steps.length === 1 ? "" : "s"}
          </span>
          <span className="font-semibold tabular-nums text-ink">
            {stats
              ? `${stats.doneToday}/${stats.total} today`
              : dueToday
                ? "Not started"
                : "Not scheduled today"}
          </span>
        </div>
        <ProgressBar
          value={stats && stats.total > 0 ? Math.round((stats.doneToday / stats.total) * 100) : 0}
          max={100}
          tone={stats?.completeToday ? "success" : "accent"}
          className="h-1.5"
        />
      </div>
    </button>
  );
}

function SummaryTile({
  id,
  icon: Icon,
  value,
  label,
  detail,
  active,
  onClick,
}: {
  id: string;
  icon: typeof Briefcase;
  value: number;
  label: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`work-stat-${id}`}
      onClick={onClick}
      aria-pressed={active}
      className="flex min-w-[10rem] flex-1 items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-2/60"
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold tabular-nums leading-tight text-ink">{value}</span>
        <span className="block truncate text-[11px] font-medium text-ink-2">{label}</span>
        <span className="block truncate text-[10px] text-ink-3">{detail}</span>
      </span>
    </button>
  );
}

export function WorkModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("projects");
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
  const [routineDialogOpen, setRoutineDialogOpen] = React.useState(false);
  const [projectDetailId, setProjectDetailId] = React.useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [projectFilter, setProjectFilter] = React.useState<"active" | "archived" | "all">("active");
  const [projectQuery, setProjectQuery] = React.useState("");
  const [milestoneTarget, setMilestoneTarget] = React.useState<MilestoneDialogTarget | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = React.useState(false);
  const [routineDetailId, setRoutineDetailId] = React.useState<string | null>(null);
  const [editingProject, setEditingProject] = React.useState<Project | null>(null);
  const [editingRoutine, setEditingRoutine] = React.useState<Routine | null>(null);
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null);

  const allProjects = Object.values(state.projects).sort((a, b) => a.order - b.order);
  const projects = allProjects.filter((project) =>
    projectFilter === "all"
      ? true
      : projectFilter === "archived"
        ? project.status === "archived"
        : project.status !== "archived",
  );
  const query = projectQuery.trim().toLowerCase();
  const visibleProjects = query
    ? projects.filter((project) => `${project.name} ${project.summary}`.toLowerCase().includes(query))
    : projects;
  const routines = Object.values(state.routines).filter((r) => r.status === "active");

  const selected =
    (selectedProjectId != null
      ? (visibleProjects.find((project) => project.id === selectedProjectId) ?? null)
      : null) ?? visibleProjects[0] ?? null;

  const handleSaveProject = (input: ProjectFormInput) => {
    if (editingProject) {
      os.updateProject(editingProject.id, input);
      setSelectedProjectId(editingProject.id);
    } else {
      const created = os.addProject(input);
      setSelectedProjectId(created.id);
    }
    setEditingProject(null);
  };

  const loadSamples = () => {
    const ids = seedSampleProjects(os);
    if (ids.length === 0) {
      toast("Sample projects are already loaded");
      return;
    }
    setSelectedProjectId(ids[0]!);
    setProjectFilter("active");
    toast(`Added ${ids.length} sample project${ids.length === 1 ? "" : "s"} - edit or delete them any time`);
  };

  const handleSaveRoutine = (input: {
    title: string;
    description: string;
    slot: RoutineSlot;
    cadence: HabitCadence;
    daysOfWeek: number[];
    steps: Array<RoutineStep>;
  }) => {
    if (editingRoutine) {
      os.updateRoutine(editingRoutine.id, input);
    } else {
      os.addRoutine(input);
    }
    setEditingRoutine(null);
  };

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectDialogOpen(true);
  };

  const openEditRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setRoutineDialogOpen(true);
  };

  return (
    <>
      <div className="mb-4 space-y-3">
        <PageHeader
          icon={Briefcase}
          title="Projects & Workspaces"
          subtitle="Plan, execute and track everything in one place. Turn ideas into reality."
          actions={
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (tab === "projects") {
                    setEditingProject(null);
                    setProjectDialogOpen(true);
                  } else {
                    setEditingRoutine(null);
                    setRoutineDialogOpen(true);
                  }
                }}
              >
                {tab === "projects" ? "New project" : "New routine"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.assign("/workmode")}
              >
                Work mode
              </Button>
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Work",
                    items: [
                      { label: "Load sample projects", onSelect: loadSamples },
                      { label: "Open work mode", onSelect: () => window.location.assign("/workmode") },
                    ],
                  },
                ]}
                trigger={
                  <Button variant="secondary" size="icon" aria-label="Work options">
                    <span aria-hidden="true">&#8942;</span>
                  </Button>
                }
              />
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-3" data-testid="work-summary">
          <SummaryTile
            id="projects"
            icon={Briefcase}
            value={allProjects.filter((project) => project.status !== "archived").length}
            label="Projects"
            detail={`${allProjects.filter((project) => project.status === "active").length} active`}
            active={tab === "projects"}
            onClick={() => setTab("projects")}
          />
          <SummaryTile
            id="routines"
            icon={Repeat}
            value={routines.length}
            label="Routines"
            detail={`${routines.filter((routine) => routine.cadence === "daily").length} daily`}
            active={tab === "routines"}
            onClick={() => setTab("routines")}
          />
        </div>

        <Segmented options={TAB_OPTIONS} value={tab} onChange={setTab} label="Work view" />
      </div>

      {tab === "projects" ? (
        allProjects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No projects yet"
            description="Group tasks, milestones, and goals into focused efforts."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => { setEditingProject(null); setProjectDialogOpen(true); }}
                >
                  Create a project
                </Button>
                <Button variant="secondary" size="md" onClick={loadSamples}>
                  Load sample projects
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-40 flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
                  aria-hidden="true"
                />
                <input
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder="Search projects"
                  aria-label="Search projects"
                  className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-2 text-[12px] text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>
              {(["active", "archived", "all"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`work-filter-${value}`}
                  aria-pressed={projectFilter === value}
                  onClick={() => setProjectFilter(value)}
                  className={
                    projectFilter === value
                      ? "rounded-lg border border-accent bg-accent px-2.5 py-1 text-[11px] font-medium text-white"
                      : "rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
                  }
                >
                  {value === "active" ? "Active" : value === "archived" ? "Archived" : "All"}
                </button>
              ))}
            </div>

            {visibleProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-3">
                No projects match these filters.
                <button
                  type="button"
                  onClick={() => {
                    setProjectQuery("");
                    setProjectFilter("all");
                  }}
                  className="ml-2 font-medium text-accent-ink hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        stats={os.projectStats(project.id)}
                        selected={project.id === selected?.id}
                        onSelect={() => setSelectedProjectId(project.id)}
                        onDetails={() => setProjectDetailId(project.id)}
                      />
                    ))}
                  </div>

                  {selected ? (
                    <div className="space-y-3">
                      <WorkProjectBoard
                        os={os}
                        project={selected}
                        onOpenTask={setOpenTaskId}
                        onToast={toast}
                      />
                      <ProjectTimeline os={os} projectId={selected.id} />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-3">
                      Select a project above to open its board.
                    </div>
                  )}
                </div>

                {selected ? (
                  <aside className="space-y-3" aria-label="Project details">
                    <ProjectOverview
                      stats={os.projectStats(selected.id)}
                      milestones={os.projectUpcomingMilestones(selected.id, 5, Date.now())}
                      teamCount={os.projectTeam(selected.id).length}
                      projectId={selected.id}
                      onAddMilestone={() => setMilestoneTarget({ projectId: selected.id })}
                      onEditMilestone={(milestoneId) =>
                        setMilestoneTarget({ projectId: selected.id, milestoneId })
                      }
                    />
                    <WorkTeam
                      team={os.projectTeam(selected.id)}
                      onAddMember={() => setMemberDialogOpen(true)}
                    />
                    <WorkActivity entries={os.projectActivity(selected.id, 6, Date.now())} />
                  </aside>
                ) : null}
              </div>
            )}
          </div>
        )
      ) : (
        <>
          {routines.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No routines yet"
              description="Build repeatable sequences of actions for morning, evening, or work."
              action={
                <Button variant="primary" size="md" onClick={() => { setEditingRoutine(null); setRoutineDialogOpen(true); }}>
                  Create a routine
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {routines.map((routine) => (
                <RoutineCard key={routine.id} routine={routine} onOpen={() => setRoutineDetailId(routine.id)} />
              ))}
            </div>
          )}
        </>
      )}

      <ProjectDialog
        open={projectDialogOpen}
        onClose={() => { setProjectDialogOpen(false); setEditingProject(null); }}
        onSave={handleSaveProject}
        initial={
          editingProject
            ? {
                name: editingProject.name,
                summary: editingProject.summary,
                status: editingProject.status,
                color: editingProject.color,
                goalIds: editingProject.goalIds,
                wipLimits: editingProject.wipLimits,
              }
            : undefined
        }
      />
      <ProjectDetailSheet
        projectId={projectDetailId}
        onClose={() => setProjectDetailId(null)}
        onAddMilestone={() => {
          if (projectDetailId) setMilestoneTarget({ projectId: projectDetailId });
        }}
        onEditMilestone={(milestoneId) => {
          if (projectDetailId) setMilestoneTarget({ projectId: projectDetailId, milestoneId });
        }}
        onEdit={() => {
          if (projectDetailId) {
            const project = state.projects[projectDetailId];
            if (project) openEditProject(project);
          }
        }}
      />

      <RoutineDialog
        open={routineDialogOpen}
        onClose={() => { setRoutineDialogOpen(false); setEditingRoutine(null); }}
        onSave={handleSaveRoutine}
        initial={
          editingRoutine
            ? {
                title: editingRoutine.title,
                description: editingRoutine.description,
                slot: editingRoutine.slot,
                cadence: editingRoutine.cadence,
                daysOfWeek: editingRoutine.daysOfWeek,
                steps: editingRoutine.steps,
              }
            : undefined
        }
      />
      <RoutineDetailSheet
        routineId={routineDetailId}
        onClose={() => setRoutineDetailId(null)}
        onEdit={() => {
          if (routineDetailId) {
            const routine = state.routines[routineDetailId];
            if (routine) openEditRoutine(routine);
          }
        }}
      />

      <MilestoneDialog target={milestoneTarget} onClose={() => setMilestoneTarget(null)} />\n      <MemberDialog open={memberDialogOpen} onClose={() => setMemberDialogOpen(false)} />
      <TaskDetailSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}
