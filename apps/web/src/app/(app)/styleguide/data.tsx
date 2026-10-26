"use client";

import * as React from "react";

import { CalendarDays, FileText, Flag, Inbox, ListChecks, Repeat, Target } from "lucide-react";

import {
  createAIObject,
  createGoal,
  createHabit,
  createHabitCheckIn,
  createNote,
  type HabitCheckIn,
} from "@personalos/core";

import { cn } from "@/lib/cn";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";
import { HabitCard } from "@/components/entities/habit-card";
import { GoalCard } from "@/components/entities/goal-card";
import { NoteCard } from "@/components/entities/note-card";
import { AIObjectCard } from "@/components/entities/ai-object-card";
import { useToast } from "@/components/ui/toast";
import { Block, Row, Section } from "./section";

const TS = new Date(2026, 9, 8, 12).getTime();
const TS_PREV = (days: number) => new Date(2026, 9, 8 - days, 12).getTime();

const demoHabit = createHabit(
  { title: "Morning walk", cadence: "daily", color: "#0d9488", icon: null },
  TS,
);
const demoCheckins: HabitCheckIn[] = [0, 1, 2, 3].map((offset) =>
  createHabitCheckIn("habit-demo", TS_PREV(offset), null, TS),
);

const demoGoal = createGoal(
  {
    title: "Run a half marathon",
    description: "Hold a steady pace through 21.1 km — build from 5k to race distance.",
    horizon: "quarter",
    metrics: [{ label: "Distance", current: 34, target: 50, unit: "km" }],
    progress: 68,
  },
  TS,
);

const demoNote = createNote(
  {
    title: "Focus patterns",
    body: "Deep work before 11am, shallow tasks after lunch. Screen-share pressure makes the next Pomodoro honest. Keep the phone in another room—the opening ritual matters more than the timer.",
    tags: ["focus", "deep-work"],
    source: "ai",
  },
  TS,
);

const demoAI = createAIObject(
  {
    kind: "suggestion",
    title: "Turn Thursday notes into a weekly plan",
    body: "I found 3 open loops in your meeting notes. Schedule a 20-minute block Friday 10:00 to draft next week's plan before the weekend.",
    refs: [
      { entityType: "note", entityId: "n1" },
      { entityType: "task", entityId: "t2" },
    ],
    model: "OpenAI",
    status: "pending",
  },
  TS,
);

function TaskPreviewRow({
  title,
  done,
  meta,
  checked,
  onToggle,
}: {
  title: string;
  done?: boolean;
  meta?: React.ReactNode;
  checked: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <li className="group">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150",
          done ? "opacity-60" : "hover:bg-surface-2/60",
        )}
      >
        <Checkbox
          label={title}
          checked={checked}
          onChange={onToggle}
          size={done ? "md" : "md"}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm", done ? "text-ink-3 line-through" : "font-medium text-ink")}>
            {title}
          </p>
          {meta && <div className="mt-1 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
      </div>
    </li>
  );
}

export function DataSection() {
  const { toast } = useToast();
  const [oneDone, setOneDone] = React.useState(false);
  const [twoDone, setTwoDone] = React.useState(false);

  return (
    <>
      <Section
        id="cards"
        title="Cards & surfaces"
        blurb="Cards compose from header, content and footer primitives. Resting state is quiet; hover lifts border and shadow together."
      >
        <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Weekly review</CardTitle>
                <CardDescription>Close the loop every Friday.</CardDescription>
              </div>
              <Badge tone="accent">Automated</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-ink-2">
                Review goals, clear the inbox, reschedule what slipped and capture what&apos;s driving this week.
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="secondary">
                Start now
              </Button>
            </CardFooter>
          </Card>
          <Card hover>
            <CardHeader>
              <CardTitle>Hoverable card</CardTitle>
              <CardDescription>Border and shadow lift on hover.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-ink-2">
                Interactive cards opt in with the <code>hover</code> prop so static cards stay still.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        id="badges"
        title="Badges & chips"
        blurb="Badges label states and tags; chips are static metadata like cadence or priority. Both stay compact and never wrap into actions."
      >
        <Block title="Badge tones">
          <Row>
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="outline">Outline</Badge>
          </Row>
        </Block>
        <Block title="Chips">
          <Row>
            <Chip>Daily</Chip>
            <Chip>Weekdays</Chip>
            <Chip active>Active</Chip>
            <Chip>#deep-work</Chip>
          </Row>
        </Block>
        <Block title="Priority markers">
          <Row>
            <span className="flex items-center gap-1.5 text-xs font-medium text-p1">P1</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-p2">P2</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-p3">P3</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-p4">P4 urgent</span>
          </Row>
        </Block>
      </Section>

      <Section
        id="navigation"
        title="Navigation"
        blurb="The shell uses grouped side navigation with live count badges, a compact bottom bar on mobile, and a global command shortcut. Row styles below are the reusable pattern."
      >
        <div className="w-60 rounded-xl border border-line bg-bg p-3">
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Plan</p>
          <nav className="space-y-0.5">
            <a className="group flex h-9 items-center gap-2.5 rounded-lg bg-accent-soft px-3 text-sm font-medium text-accent-ink">
              <CalendarDays className="size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" /> Today
            </a>
            <a className="group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              <Inbox className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" /> Inbox
              <span className="ml-auto rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-3 tnum">
                3
              </span>
            </a>
            <a className="group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              <ListChecks className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" /> Tasks
            </a>
          </nav>
          <p className="mb-1.5 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Grow</p>
          <a className="group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            <Target className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" /> Goals
          </a>
          <a className="group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            <Repeat className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" /> Habits
          </a>
        </div>
      </Section>

      <Section
        id="timeline"
        title="Timeline"
        blurb="Events, activity and focus sessions render as a quiet vertical timeline with tone-coded markers."
      >
        <div className="max-w-md">
          <Timeline
            items={[
              {
                title: "Focus session · 50 min",
                time: "09:30",
                tone: "accent",
                icon: <Target className="size-3.5" />,
                description: "Deep work on the design system tokens.",
              },
              {
                title: "Capture batch cleared",
                time: "13:05",
                tone: "success",
                description: "Scheduled 4 tasks, filed 2 notes, archived 1 idea.",
              },
              {
                title: "Weekly review",
                time: "Fri",
                tone: "info",
                description: "Auto-scheduled every Friday at 15:00.",
              },
            ]}
          />
        </div>
      </Section>

      <Section
        id="tasks"
        title="Task components"
        blurb="The task row is the most-used surface — checkbox complete with undo, due-state coloring, priority and metadata. Production rows live in modules/tasks; this is their anatomy."
      >
        <div className="max-w-xl rounded-2xl border border-line bg-surface shadow-card">
          <ul className="divide-y divide-line py-1">
            <TaskPreviewRow
              title="Ship the command palette"
              checked={twoDone}
              onToggle={setTwoDone}
              done={twoDone}
              meta={
                <>
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">
                    Today · 14:00
                  </span>
                  <span className="flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-ink-3">
                    <Flag className="size-3 text-p3" aria-hidden="true" /> High
                  </span>
                </>
              }
            />
            <TaskPreviewRow
              title="Capture follow-ups from today's notes"
              checked={oneDone}
              onToggle={setOneDone}
              done={oneDone}
              meta={
                <>
                  <span className="rounded-md px-1.5 py-0.5 text-xs font-medium text-danger">Overdue</span>
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-ink-3">#planning</span>
                </>
              }
            />
            <TaskPreviewRow
              title="Review backup file schema"
              checked={false}
              onToggle={() => void 0}
              meta={<span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-ink-3">Next week</span>}
            />
          </ul>
        </div>
        <Button size="sm" variant="secondary" onClick={() => toast("Opened task detail sheet", { tone: "success" })}>
          Open task detail
        </Button>
      </Section>

      <Section
        id="habits"
        title="Habit components"
        blurb="A habit is a promise with a cadence. The card surfaces cadence, streak, and the trailing 7 days for one-tap check-ins."
      >
        <div className="max-w-xl">
          <HabitCard
            habit={demoHabit}
            checkins={demoCheckins}
            onToggle={() => toast("Check-in toggled", { tone: "success" })}
            onOpen={() => toast("Opened habit")}
          />
        </div>
      </Section>

      <Section
        id="goals"
        title="Goal components"
        blurb="Goals carry a horizon, a status and a single measurable outcome; the card condenses all three into one glance."
      >
        <div className="max-w-xl">
          <GoalCard goal={demoGoal} onOpen={() => toast("Opened goal")} />
        </div>
        <Block title="Completed state">
          <div className="max-w-sm">
            <GoalCard
              goal={createGoal(
                { title: "Zero inbox by Friday", horizon: "week", status: "completed", progress: 100 },
                TS,
              )}
            />
          </div>
        </Block>
      </Section>

      <Section
        id="notes"
        title="Note components"
        blurb="Notes are cards first — title, snippet, updated date and tags. The editor opens in a large modal."
      >
        <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <NoteCard note={demoNote} onOpen={() => toast("Opened note")} />
          <NoteCard
            note={createNote(
              { title: "", body: "A note without a title still earns its card.", source: "manual" },
              TS,
            )}
            onOpen={() => toast("Opened note")}
          />
        </div>
      </Section>

      <Section
        id="ai"
        title="AI components"
        blurb="AI never pretends to be a system message — it's clearly an AI object with kind, provenance and explicit accept/dismiss actions."
      >
        <div className="max-w-xl">
          <AIObjectCard
            object={demoAI}
            onAccept={() => toast("Accepted and scheduled", { tone: "success" })}
            onDismiss={() => toast("Dismissed")}
            onOpen={() => toast("Opened AI object")}
          />
        </div>
        <Block title="Compact variant content">
          <div className="max-w-xl">
            <AIObjectCard
              object={createAIObject(
                {
                  kind: "insight",
                  title: "Mornings are your peak",
                  body: "You complete 62% of tasks before noon. Consider scheduling deep work earlier.",
                  model: null,
                },
                TS,
              )}
            />
          </div>
        </Block>
      </Section>

      <Section
        id="layout"
        title="Layout & workspace"
        blurb="Fixed 256px sidebar on desktop, content centre-column max-width, bottom-bar navigation under 32in viewports. Page headers carry title, count and actions."
      >
        <div className="flex items-center gap-3">
          <FileText className="size-4 text-ink-3" aria-hidden="true" />
          <h3 className="text-[15px] font-semibold tracking-tight">Page header anatomy</h3>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-bg px-5 py-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">Notes</p>
            <p className="text-xs text-ink-3">12 notes · autosaved on this device</p>
          </div>
          <Button variant="primary" size="sm">
            New note
          </Button>
        </div>
      </Section>
    </>
  );
}