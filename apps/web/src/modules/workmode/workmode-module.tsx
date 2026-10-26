"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock,
  Folder,
  MoreHorizontal,
  Plus,
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import type { ID, Project } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAppState, useOS } from "@/store/use-os";

import { ModeSwitcher } from "@/modules/collaboration/mode-switcher";
import { useFocusNow } from "@/modules/focus/use-focus-now";

import { seedWorkModeData } from "./sample-workmode";
import { WorkModeRail } from "./workmode-rail";

const DAY = 86_400_000;
const HOUR = 3_600_000;

type WorkTab = "overview" | "tasks" | "projects" | "meetings" | "documents" | "team" | "analytics";

const TABS: { value: WorkTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "tasks", label: "Tasks" },
  { value: "projects", label: "Projects" },
  { value: "meetings", label: "Meetings" },
  { value: "documents", label: "Documents" },
  { value: "team", label: "Team" },
  { value: "analytics", label: "Analytics" },
];

function startOfToday(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function formatClock(at: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(at));
}

function relative(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface TaskRow {
  id: ID;
  title: string;
  done: boolean;
  tags: string[];
  dueAt: number | null;
  projectName: string | null;
  projectColor: string | null;
}

interface MeetingRow {
  id: ID;
  title: string;
  startsAt: number;
  endsAt: number | null;
  location: string;
  attendeeCount: number;
  minutes: number;
}

interface DocRow {
  id: ID;
  title: string;
  updatedAt: number;
  tags: string[];
}

export function WorkModeModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<WorkTab>("overview");
  const [taskDraft, setTaskDraft] = React.useState("");
  const [askDraft, setAskDraft] = React.useState("");

  const now = useFocusNow(30_000);
  const today = startOfToday(now);
  const tomorrow = today + DAY;

  const projects = Object.values(state.projects).filter((project) => project.status === "active");

  const tasks = React.useMemo<TaskRow[]>(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    return Object.values(state.tasks)
      .filter((task) => task.status !== "archived" && task.status !== "cancelled")
      .filter((task) => task.source !== "habit")
      .map((task) => {
        const project = task.projectId != null ? projectById.get(task.projectId) : undefined;
        return {
          id: task.id,
          title: task.title,
          done: task.status === "done",
          tags: task.tags,
          dueAt: task.dueAt,
          projectName: project?.name ?? null,
          projectColor: project?.color ?? null,
        };
      })
      .filter((task) => task.dueAt == null || (task.dueAt >= today - DAY && task.dueAt < tomorrow))
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  }, [state.tasks, projects, today, tomorrow]);

  const allMeetings = React.useMemo<MeetingRow[]>(() => {
    return Object.values(state.meetings)
      .filter((meeting) => meeting.status !== "archived")
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        location: meeting.location || "Work session",
        attendeeCount: meeting.attendees?.length || meeting.attendeeIds.length,
        minutes:
          meeting.endsAt != null
            ? Math.max(0, Math.round((meeting.endsAt - meeting.startsAt) / 60_000))
            : 30,
      }));
  }, [state.meetings]);

  const meetings = React.useMemo<MeetingRow[]>(
    () => allMeetings.filter((meeting) => meeting.startsAt >= today && meeting.startsAt < tomorrow),
    [allMeetings, today, tomorrow],
  );

  const allTasks = React.useMemo<TaskRow[]>(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    return Object.values(state.tasks)
      .filter((task) => task.status !== "archived" && task.status !== "cancelled")
      .filter((task) => task.source !== "habit")
      .map((task) => {
        const project = task.projectId != null ? projectById.get(task.projectId) : undefined;
        return {
          id: task.id,
          title: task.title,
          done: task.status === "done",
          tags: task.tags,
          dueAt: task.dueAt,
          projectName: project?.name ?? null,
          projectColor: project?.color ?? null,
        };
      })
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  }, [state.tasks, projects]);

  const documents = React.useMemo<DocRow[]>(() => {
    return Object.values(state.notes)
      .filter((note) => note.status === "active")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6)
      .map((note) => ({ id: note.id, title: note.title, updatedAt: note.updatedAt, tags: note.tags }));
  }, [state.notes]);

  const focusToday = os.focusStats(today, tomorrow, now);
  const focusWeek = os.focusStats(today - 6 * DAY, tomorrow, now);
  const focusYesterday = os.focusStats(today - DAY, today, now);
  const weeklyGoalMin = 20 * 60;
  const weeklyPct = Math.min(100, Math.round((focusWeek.totalFocusMin / weeklyGoalMin) * 100));
  const focusDelta =
    focusYesterday.totalFocusMin > 0
      ? Math.round(((focusToday.totalFocusMin - focusYesterday.totalFocusMin) / focusYesterday.totalFocusMin) * 100)
      : null;

  const doneToday = tasks.filter((task) => task.done).length;
  const nextMeeting = meetings.find((meeting) => meeting.endsAt == null || meeting.endsAt > now) ?? null;
  const nextIn = nextMeeting != null ? nextMeeting.startsAt - now : null;
  const newProjects = projects.filter((project) => project.createdAt >= now - 7 * DAY).length;

  const activity = os.todayActivity(now, 8);

  const addTask = () => {
    const title = taskDraft.trim();
    if (title.length === 0) {
      toast("Type a task title first");
      return;
    }
    os.addTask({ title, dueAt: today + 9 * HOUR, tags: ["work"], mode: "work" });
    setTaskDraft("");
    toast("Task added to today's work list");
  };

  const toggleTask = (id: ID) => {
    const task = os.getTask(id);
    if (!task) return;
    if (task.status === "done") os.reopenTask(id);
    else os.completeTask(id);
  };

  const loadDefaults = () => {
    const ids = seedWorkModeData(os, now);
    toast(`Added ${ids.length} work items — edit or delete them any time`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        testId="workmode-header"
        icon={Briefcase}
        title="Work Mode"
        subtitle="Stay focused, organized and productive at work. Manage your projects, tasks, meetings and documents in one place."
        actions={
          <>
            <ModeSwitcher />
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Work Mode",
                  items: [
                    { label: "Load default data", onSelect: loadDefaults },
                    {
                      label: "New project",
                      onSelect: () => {
                        const name = window.prompt("Project name");
                        if (name == null || name.trim().length === 0) return;
                        os.addProject({ name: name.trim(), mode: "work" });
                        setTab("projects");
                        toast("Project created");
                      },
                    },
                    {
                      label: "Add teammate",
                      onSelect: () => {
                        const name = window.prompt("Teammate name");
                        if (name == null || name.trim().length === 0) return;
                        os.addMember({
                          userId: `user_${crypto.randomUUID()}`,
                          role: "member",
                          displayName: name.trim(),
                        });
                        setTab("team");
                        toast("Teammate added");
                      },
                    },
                    { label: "Open analytics", onSelect: () => setTab("analytics") },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Work Mode options">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="workmode-stats">
        <StatTile
          id="tasks"
          icon={CheckCircle2}
          tone="bg-success-soft text-success"
          value={String(tasks.length)}
          label="Tasks Today"
          detail={`↑ ${doneToday} completed`}
        />
        <StatTile
          id="projects"
          icon={Folder}
          tone="bg-info-soft text-info"
          value={String(projects.length)}
          label="Active Projects"
          detail={`↑ ${newProjects} new`}
        />
        <StatTile
          id="meetings"
          icon={CalendarDays}
          tone="bg-accent-soft text-accent-ink"
          value={String(meetings.length)}
          label="Meetings Today"
          detail={
            nextIn == null
              ? "No more today"
              : nextIn > 0
                ? `In ${formatHours(Math.round(nextIn / 60_000))}`
                : "In progress"
          }
        />
        <StatTile
          id="focus"
          icon={Clock}
          tone="bg-accent-soft text-accent-ink"
          value={formatHours(focusToday.totalFocusMin)}
          label="Focused Time"
          detail={focusDelta != null ? `↑ ${Math.abs(focusDelta)}%` : "—"}
        />
        <StatTile
          id="goal"
          icon={Target}
          tone="bg-success-soft text-success"
          value={`${weeklyPct}%`}
          label="Weekly Goal"
          detail={weeklyPct >= 70 ? "✓ On track" : "Behind pace"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Work mode sections">
        {TABS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            data-testid={`workmode-tab-${entry.value}`}
            aria-selected={tab === entry.value}
            onClick={() => setTab(entry.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
              tab === entry.value ? "bg-accent text-white" : "border border-line bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-4">
          {tab === "overview" ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <WorkTasksPanel
                  tasks={tasks}
                  draft={taskDraft}
                  onDraftChange={setTaskDraft}
                  onAdd={addTask}
                  onToggle={toggleTask}
                />
                <WorkMeetingsPanel meetings={meetings} />
              </div>
              <WorkProjectsPanel projects={projects} />
              <div className="grid gap-4 lg:grid-cols-2">
                <WorkDocumentsPanel documents={documents} />
                <WorkActivityPanel entries={activity} />
              </div>
            </>
          ) : null}

          {tab === "tasks" ? (
            <WorkTasksPanel
              tasks={allTasks}
              draft={taskDraft}
              onDraftChange={setTaskDraft}
              onAdd={addTask}
              onToggle={toggleTask}
              title="All work tasks"
              emptyLabel="No work tasks yet."
            />
          ) : null}

          {tab === "projects" ? <WorkProjectsPanel projects={projects} /> : null}

          {tab === "meetings" ? (
            <WorkMeetingsPanel meetings={allMeetings} title="All meetings" emptyLabel="No meetings yet." />
          ) : null}

          {tab === "documents" ? <WorkDocumentsPanel documents={documents} title="Recent work documents" /> : null}

          {tab === "team" ? (
            <WorkTeamPanel members={os.members()} entries={activity} />
          ) : null}

          {tab === "analytics" ? (
            <section
              aria-label="Work analytics"
              data-testid="workmode-analytics"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <h2 className="text-sm font-semibold text-ink">This week</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <StatTile
                  id="week-focus"
                  icon={Clock}
                  tone="bg-accent-soft text-accent-ink"
                  value={formatHours(focusWeek.totalFocusMin)}
                  label="Total Focus"
                  detail={`${focusWeek.sessionCount} sessions`}
                />
                <StatTile
                  id="week-ratio"
                  icon={TrendingUp}
                  tone="bg-success-soft text-success"
                  value={`${Math.round(focusWeek.focusRatio * 100)}%`}
                  label="Productive Time"
                  detail={`${focusWeek.distractionCount} distractions`}
                />
                <StatTile
                  id="week-tasks"
                  icon={CircleDashed}
                  tone="bg-info-soft text-info"
                  value={String(tasks.length)}
                  label="Tasks Today"
                  detail={`${doneToday} done`}
                />
              </div>
            </section>
          ) : null}
        </div>

        <WorkModeRail
          askDraft={askDraft}
          onAskDraftChange={setAskDraft}
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          documents={documents}
          focusWeekMinutes={focusWeek.totalFocusMin}
          focusWeekRatio={focusWeek.focusRatio}
          focusWeekSessions={focusWeek.sessionCount}
          onCreateTask={addTask}
          onLoadDefaults={loadDefaults}
        />
      </div>
    </div>
  );
}

function StatTile({
  id,
  icon: Icon,
  tone,
  value,
  label,
  detail,
}: {
  id: string;
  icon: LucideIcon;
  tone: string;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div data-testid={`workmode-stat-${id}`} className="rounded-2xl border border-line bg-surface p-3 shadow-card">
      <div className="flex items-center gap-2">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`} aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-medium text-ink-3">{label}</span>
          <span className="block text-lg font-bold tabular-nums leading-tight text-ink">{value}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-success">{detail}</p>
    </div>
  );
}

function PanelShell({
  title,
  icon: Icon,
  testId,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  testId: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon className="size-4 text-accent-ink" aria-hidden="true" />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function WorkTasksPanel({
  tasks,
  draft,
  onDraftChange,
  onAdd,
  onToggle,
  title = "Today's Work Tasks",
  emptyLabel = "No work tasks for today.",
}: {
  tasks: TaskRow[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onToggle: (id: ID) => void;
  title?: string;
  emptyLabel?: string;
}) {
  return (
    <PanelShell
      title={title}
      icon={CheckCircle2}
      testId="workmode-tasks"
      action={
        <a href="/tasks" className="text-[11px] font-medium text-accent-ink hover:underline">
          View all
        </a>
      }
    >
      {tasks.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-3">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-surface-2/70">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => onToggle(task.id)}
                aria-label={`Complete ${task.title}`}
                className="size-4 shrink-0 accent-[var(--accent)]"
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px]",
                  task.done ? "text-ink-3 line-through" : "text-ink",
                )}
              >
                {task.title}
              </span>
              {task.projectName ? (
                <span className="hidden shrink-0 items-center gap-1 text-[10px] text-ink-3 sm:inline-flex">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: task.projectColor ?? "var(--ink-3)" }}
                    aria-hidden="true"
                  />
                  {task.projectName}
                </span>
              ) : null}
              {task.tags[0] ? (
                <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-ink">
                  {task.tags[0]}
                </span>
              ) : null}
              {task.dueAt != null ? (
                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-3">
                  {formatClock(task.dueAt)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd();
        }}
      >
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-1.5">
          <Plus className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          <Input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onAdd();
            }}
            placeholder="Add a work task…"
            aria-label="Add a work task"
            className="h-7 border-0 bg-transparent px-0 text-[13px] focus:ring-0"
          />
        </div>
      </form>
    </PanelShell>
  );
}

const MEETING_TONES = [
  "bg-chart-5",
  "bg-chart-4",
  "bg-chart-6",
  "bg-chart-3",
  "bg-chart-7",
];

function WorkMeetingsPanel({
  meetings,
  title = "Today's Meetings",
  emptyLabel = "No meetings scheduled today.",
}: {
  meetings: MeetingRow[];
  title?: string;
  emptyLabel?: string;
}) {
  return (
    <PanelShell
      title={title}
      icon={CalendarDays}
      testId="workmode-meetings"
      action={
        <a href="/meetings" className="text-[11px] font-medium text-accent-ink hover:underline">
          View all
        </a>
      }
    >
      {meetings.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-3">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {meetings.map((meeting, index) => (
            <li key={meeting.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-2/70">
              <span className="w-20 shrink-0 text-right">
                <span className="block text-[12px] font-medium tabular-nums text-ink">
                  {formatClock(meeting.startsAt)}
                </span>
                <span className="block text-[10px] tabular-nums text-ink-3">{meeting.minutes} min</span>
              </span>
              <span
                className={cn("h-9 w-1 shrink-0 rounded-full", MEETING_TONES[index % MEETING_TONES.length])}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{meeting.title}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {meeting.location} · {meeting.attendeeCount} attendees
                </span>
              </span>
              <a
                href="/meetings"
                className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                Join
              </a>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function WorkProjectsPanel({ projects }: { projects: Project[] }) {
  const os = useOS();
  return (
    <PanelShell
      title="Projects"
      icon={Folder}
      testId="workmode-projects"
      action={
        <a href="/work" className="text-[11px] font-medium text-accent-ink hover:underline">
          View all
        </a>
      }
    >
      {projects.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-3">No active projects.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {projects.map((project) => {
            const stats = os.projectStats(project.id);
            const team = os.projectTeam(project.id);
            return (
              <li key={project.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg"
                    style={{ backgroundColor: "var(--surface-2)" }}
                    aria-hidden="true"
                  >
                    <Folder className="size-3.5" style={{ color: project.color ?? undefined }} />
                  </span>
                  <a
                    href="/work"
                    className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink hover:text-accent-ink hover:underline"
                  >
                    {project.name}
                  </a>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-ink-3">{project.summary}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${stats.progress}%` }}
                    />
                  </span>
                  <span className="text-[11px] tabular-nums text-ink-3">{stats.progress}%</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {team.slice(0, 4).map((entry) => (
                    <span
                      key={entry.member.id}
                      title={entry.displayName}
                      className="grid size-5 place-items-center rounded-full bg-surface-2 text-[9px] font-bold text-ink-3"
                    >
                      {entry.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                  {team.length > 4 ? (
                    <span className="text-[10px] text-ink-3">+{team.length - 4}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

function WorkDocumentsPanel({ documents, title = "Recent Work Documents" }: { documents: DocRow[]; title?: string }) {
  const now = Date.now();
  return (
    <PanelShell
      title={title}
      icon={BarChart3}
      testId="workmode-documents"
      action={
        <a href="/notes" className="text-[11px] font-medium text-accent-ink hover:underline">
          View all
        </a>
      }
    >
      {documents.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-3">No documents yet.</p>
      ) : (
        <ul className="space-y-1">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-surface-2/70">
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3"
                aria-hidden="true"
              >
                <Folder className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <a
                  href="/notes"
                  className="block truncate text-[13px] font-medium text-ink hover:text-accent-ink hover:underline"
                >
                  {doc.title}
                </a>
                <span className="block text-[10px] text-ink-3">Updated {relative(doc.updatedAt, now)}</span>
              </span>
              {doc.tags[0] ? (
                <Badge tone="outline" className="shrink-0">
                  {doc.tags[0]}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function WorkActivityPanel({
  entries,
}: {
  entries: { id: string; title: string; detail: string; when: number }[];
}) {
  const now = Date.now();
  return (
    <PanelShell
      title="Team Activity"
      icon={Users}
      testId="workmode-activity"
      action={
        <a href="/work" className="text-[11px] font-medium text-accent-ink hover:underline">
          View all
        </a>
      }
    >
      {entries.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-3">No recent activity.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2.5 rounded-lg px-1 py-1">
              <span
                className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-bold text-ink-3"
                aria-hidden="true"
              >
                {entry.title.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-ink">{entry.title}</span>
                <span className="block truncate text-[10px] text-ink-3">
                  {entry.detail} · {relative(entry.when, now)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function WorkTeamPanel({
  members,
  entries,
}: {
  members: { id: ID; displayName: string; role: string }[];
  entries: { id: string; title: string; detail: string; when: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PanelShell title="Team" icon={Users} testId="workmode-team">
        {members.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-ink-3">
            No teammates yet. Add one from Work Mode options.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-2.5">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-ink"
                  aria-hidden="true"
                >
                  {member.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{member.displayName}</span>
                <span className="shrink-0 text-[11px] text-ink-3">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>
      <WorkActivityPanel entries={entries} />
    </div>
  );
}

export { Star };
